import axios from 'axios';
import { LandRecord } from '../../models/LandRecord';
import { extractLandRecord } from './extractLandRecord';
import { checkAreaSumFlags } from '../validation/areaSumCheck';
import { detectDuplicateFlags } from '../validation/duplicateDetection';
import { routeRowByConfidence } from '../validation/confidenceRouting';
import { regenerateSignedUrl } from '../storage/supabaseStorage';
import { ReviewQueue } from '../../models/ReviewQueue';
import { notifyUser, notifyRole } from '../notificationService';
import { env } from '../../config/env';
import { ValidationFlag } from '@landvision/types';

/**
 * Returns true if a Supabase signed URL has expired (based on the `exp` claim
 * embedded in its JWT `token` query parameter).
 */
function isSignedUrlExpired(storageUrl: string): boolean {
  try {
    const url = new URL(storageUrl);
    const token = url.searchParams.get('token');
    if (token) {
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (payload.exp) {
          return Date.now() / 1000 > payload.exp - 60;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface ExtractionPipelineResult {
  documentId: string;
  status: 'extracted' | 'needs_review' | 'extraction_failed';
  extractionSource: 'gemini' | 'tesseract' | null;
  rowsExtracted: number;
  error?: string;
}

/**
 * Runs the FULL extraction pipeline for one uploaded document:
 *
 *   1. Download the scan from Supabase Storage (refreshing the signed URL
 *      once if it has expired).
 *   2. Extract fields via Gemini (multi-row, structured output) with an
 *      automatic Tesseract fallback.
 *   3. Persist ONE child LandRecord per extracted row (documentId / rowIndex
 *      / pageNo / extractionSource propagated).
 *   4. Run per-row validation (duplicate detection + area-sum) and route
 *      each row to `needs_review` / `auto_approved` by confidence.
 *   5. Set the parent document's status to the worst child status.
 *   6. Enqueue review-queue entries + notifications as side-effects.
 *
 * Designed to run inside the extraction queue worker (fire-and-forget) — it
 * NEVER throws; all failures land in the parent record's `extraction_failed`
 * status + `extractionError` message and a notification to the uploader.
 */
export async function runExtractionForDocument(
  recordId: string,
  requestedBy?: string | null,
): Promise<ExtractionPipelineResult> {
  let record: any = null;

  try {
    record = await LandRecord.findById(recordId);
    if (!record) {
      console.warn(`[ExtractionPipeline] Record ${recordId} not found`);
      return { documentId: recordId, status: 'extraction_failed', extractionSource: null, rowsExtracted: 0, error: 'Record not found' };
    }

    // ---------------------------------------------------------------------
    // STEP 1: Download the file from Supabase Storage (refresh URL once).
    // ---------------------------------------------------------------------
    let downloadUrl = record.storageUrl as string | undefined;
    if (!downloadUrl || isSignedUrlExpired(downloadUrl)) {
      if (!record.storagePath) {
        throw new Error('Signed URL expired and storagePath not available for regeneration');
      }
      console.log('[ExtractionPipeline] Signed URL missing/expired — regenerating...');
      downloadUrl = await regenerateSignedUrl(record.storagePath);
      record.storageUrl = downloadUrl;
      await record.save();
    }

    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg';
    try {
      console.log('[ExtractionPipeline] Downloading file from storage...');
      const response = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 30000 });
      imageBuffer = Buffer.from(response.data as ArrayBuffer);
      const contentTypeHeader = response.headers['content-type'];
      mimeType = (typeof contentTypeHeader === 'string' && contentTypeHeader) || 'image/jpeg';
      console.log(`[ExtractionPipeline] Downloaded ${imageBuffer.length} bytes, MIME: ${mimeType}`);
    } catch (downloadError) {
      // One retry with a freshly-generated signed URL.
      if (record.storagePath) {
        console.log('[ExtractionPipeline] Download failed — retrying with a fresh signed URL...');
        downloadUrl = await regenerateSignedUrl(record.storagePath);
        record.storageUrl = downloadUrl;
        await record.save();
        const retryResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 30000 });
        imageBuffer = Buffer.from(retryResponse.data as ArrayBuffer);
        const retryContentType = retryResponse.headers['content-type'];
        mimeType = (typeof retryContentType === 'string' && retryContentType) || 'image/jpeg';
      } else {
        throw downloadError;
      }
    }

    // ---------------------------------------------------------------------
    // STEP 2: Extract — Gemini (multi-row) with Tesseract fallback.
    // For now each upload is treated as a single-page document (pageNo=1);
    // multi-page PDF support is a future extension.
    // ---------------------------------------------------------------------
    const pageNo = 1;
    const extractionResult = await extractLandRecord(imageBuffer, mimeType, pageNo, {
      userId: record.uploadedBy ?? null,
      documentId: recordId,
    });
    console.log(
      `[ExtractionPipeline] Extraction succeeded (source: ${extractionResult.extractionSource}, ` +
        `${extractionResult.rows.length} row(s)).`,
    );

    // ---------------------------------------------------------------------
    // STEP 3+4: Persist one child record per row with validation + routing.
    // ---------------------------------------------------------------------
    const documentId = record._id.toString();
    const village = record.village;
    const district = record.district;

    const persisted: Array<{ recordId: string; status: string }> = [];

    for (let i = 0; i < extractionResult.rows.length; i++) {
      const row = extractionResult.rows[i];

      const extractedFields = {
        ownerName: row.ownerName,
        khasraNumber: row.khasraNumber,
        plotArea: row.plotArea,
        village: row.village,
        district: row.district,
        landClass: row.landClass,
        khataNumber: row.khataNumber,
        tehsil: row.tehsil,
        subSurveyNumber: row.subSurveyNumber,
        fatherOrHusbandName: row.fatherOrHusbandName,
        remarks: row.remarks,
      };

      // --- Per-row structured validation -------------------------------
      const validationResults: ValidationFlag[] = [];
      try {
        const duplicateFlags = await detectDuplicateFlags({
          khasraNumber: row.khasraNumber?.value || null,
          subSurveyNumber: row.subSurveyNumber?.value || null,
          village,
          documentId,
          excludeRecordId: undefined, // child record not yet saved
          district,
        });
        validationResults.push(...duplicateFlags);

        const areaResult = await checkAreaSumFlags({
          village,
          villageAreaLimit: undefined,
          excludeRecordId: undefined,
          currentPlotArea: row.plotArea?.value || null,
          documentId,
        });
        validationResults.push(...areaResult.flags);
      } catch (validationError) {
        console.warn(`[ExtractionPipeline] Row ${i} validation warning (non-fatal):`, validationError);
        validationResults.push({
          rule: 'validation_exception',
          severity: 'warning',
          message: `Validation threw: ${(validationError as Error).message}`,
        });
      }

      // --- Per-row confidence routing ----------------------------------
      const routing = routeRowByConfidence(row, validationResults, env.CONFIDENCE_THRESHOLD);
      const childStatus: 'needs_review' | 'auto_approved' = routing.status;
      const legacyFlagStrings = validationResults.map((f) => f.rule);

      const childRecord = new LandRecord({
        documentId,
        rowIndex: row.rowIndex,
        pageNo: row.pageNo,
        filename: record.filename,
        village,
        district,
        uploadedBy: record.uploadedBy,
        storagePath: record.storagePath,
        storageUrl: record.storageUrl,
        extractedFields,
        extractionSource: row.extractionSource,
        validationFlags: legacyFlagStrings,
        validationResults,
        lowConfidenceFields: routing.lowConfidenceFields,
        status: childStatus,
      });

      const saved = await childRecord.save();
      persisted.push({ recordId: saved._id.toString(), status: childStatus });
    }

    // ---------------------------------------------------------------------
    // STEP 5: Parent status = worst child status.
    // ---------------------------------------------------------------------
    const anyChildNeedsReview = persisted.some((r) => r.status === 'needs_review');
    record.status = anyChildNeedsReview ? 'needs_review' : 'extracted';
    record.extractionSource = extractionResult.extractionSource;
    record.extractionError = null;
    await record.save();

    // ---------------------------------------------------------------------
    // STEP 6: Side-effects — review queue entries + notifications.
    // ---------------------------------------------------------------------
    try {
      if (anyChildNeedsReview) {
        const existing = await ReviewQueue.findOneOpen(documentId);
        if (!existing) {
          await ReviewQueue.create({
            landRecordId: documentId,
            priority: 'high',
            status: 'pending',
            reason: 'Low confidence fields require review',
          });
        }
        await notifyRole(['reviewer', 'admin'], {
          type: 'review_requested',
          title: 'Document needs review',
          message: `A document${record.filename ? ` (${record.filename})` : ''} in village "${village}" was extracted with low-confidence fields and needs review.`,
          metadata: { documentId },
        });
      }
      await notifyUser({
        userId: record.uploadedBy || '',
        type: 'extraction_complete',
        title: 'Extraction complete',
        message: `Extraction finished for "${record.filename || 'your document'}" — ${persisted.length} row(s) extracted${anyChildNeedsReview ? ', review required' : ' and auto-approved'}.`,
        metadata: { documentId, rows: persisted.length },
      });
    } catch (sideEffectErr) {
      console.warn('[ExtractionPipeline] Side-effect warning (non-fatal):', sideEffectErr);
    }

    return {
      documentId,
      status: record.status,
      extractionSource: extractionResult.extractionSource,
      rowsExtracted: persisted.length,
    };
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[ExtractionPipeline] Extraction failed for ${recordId}:`, error);
    try {
      if (record) {
        record.status = 'extraction_failed';
        record.extractionError = message;
        await record.save();
      }
    } catch (saveErr) {
      console.error('[ExtractionPipeline] Failed to persist extraction_failed status:', saveErr);
    }
    await notifyUser({
      userId: record?.uploadedBy || requestedBy || '',
      type: 'extraction_failed',
      title: 'Extraction failed',
      message: `AI extraction failed for "${record?.filename || 'your document'}": ${message}`,
      metadata: { documentId: recordId },
    });
    return {
      documentId: recordId,
      status: 'extraction_failed',
      extractionSource: null,
      rowsExtracted: 0,
      error: message,
    };
  }
}
