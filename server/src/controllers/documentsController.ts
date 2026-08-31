import { Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from '../middleware/auth';
import { uploadDocument as uploadToStorage, deleteDocument, regenerateSignedUrl } from '../services/storage/supabaseStorage';
import { LandRecord } from '../models/LandRecord';
import { extractLandRecord } from '../services/extraction/extractLandRecord';
import { checkAreaSum } from '../services/validation/areaSumCheck';
import { detectDuplicates } from '../services/validation/duplicateDetection';
import { routeByConfidence } from '../services/validation/confidenceRouting';
import { env } from '../config/env';

/**
 * Returns true if a Supabase signed URL has expired.
 * Supabase signed URLs contain a "token" JWT whose "exp" claim is the expiry Unix timestamp.
 * We detect expiry by checking if the URL's query-string token has elapsed — or, simpler,
 * we parse the "expires_in" embedded in the URL path segment issued by Supabase v2+.
 * As a conservative fallback we also treat an age of >55 minutes as stale.
 */
function isSignedUrlExpired(storageUrl: string): boolean {
  try {
    // Supabase v2 signed URLs include an "expires_in" param or a JWT "token" query param.
    // We decode the token's "exp" claim to get the exact expiry.
    const url = new URL(storageUrl);
    const token = url.searchParams.get('token');
    if (token) {
      // JWT is base64url encoded; payload is the second segment
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (payload.exp) {
          // Add a 60-second grace window to avoid edge-case races
          return Date.now() / 1000 > payload.exp - 60;
        }
      }
    }
    // No token found — conservatively treat as potentially expired (refresh it)
    return false;
  } catch {
    // If we can't parse, don't block extraction; attempt download as-is
    return false;
  }
}

export const uploadDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let savedStoragePath: string | null = null;

  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get file and form data
    const file = (req as any).file;
    const { village, district } = req.body;

    // Validate inputs
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    if (!village || !district) {
      res.status(400).json({ error: 'Missing village or district' });
      return;
    }

    // Validate village and district are non-empty strings
    if (typeof village !== 'string' || typeof district !== 'string') {
      res.status(400).json({ error: 'Village and district must be text' });
      return;
    }

    // Upload to Supabase Storage — now returns both URL and path
    const { signedUrl, storagePath } = await uploadToStorage(file.buffer, file.originalname);
    savedStoragePath = storagePath;

    // Create LandRecord in MongoDB — persist storagePath alongside storageUrl
    const landRecord = new LandRecord({
      filename: file.originalname,
      village: village.trim(),
      district: district.trim(),
      uploadedBy: req.user.id,
      storagePath,    // raw path — needed if we must regenerate the signed URL later
      storageUrl: signedUrl,
      status: 'uploaded',
      createdAt: new Date(),
    });

    const savedRecord = await landRecord.save();

    res.status(201).json({
      recordId: savedRecord._id,
      filename: savedRecord.filename,
      village: savedRecord.village,
      district: savedRecord.district,
      status: savedRecord.status,
    });
  } catch (error) {
    // If storage upload succeeded but MongoDB failed, delete the orphaned file
    if (savedStoragePath) {
      console.warn(`MongoDB save failed after storage upload. Cleaning up orphaned file: ${savedStoragePath}`);
      await deleteDocument(savedStoragePath);
    }

    console.error('uploadDocument error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getDocumentStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const record = await LandRecord.findById(id);

    if (!record) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(200).json({
      recordId: record._id,
      filename: record.filename,
      status: record.status,
      village: record.village,
      district: record.district,
      uploadedAt: record.createdAt,
      extractedFields: record.extractedFields || {},
      extractionSource: record.extractionSource || null,
      validationFlags: record.validationFlags || [],
    });
  } catch (error) {
    console.error('getDocumentStatus error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

/**
 * Triggers AI extraction and validation on a land record
 * POST /api/documents/:id/extract
 */
export const triggerExtraction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Fetch the LandRecord
    const record = await LandRecord.findById(id);
    if (!record) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Check if already extracted
    if (record.status === 'extracted' || record.status === 'needs_review' || record.status === 'auto_approved') {
      res.status(400).json({ error: 'Document already extracted' });
      return;
    }

    // Update status to "extracting"
    record.status = 'extracting';
    await record.save();

    // -----------------------------------------------------------------------
    // STEP 1: Resolve the download URL — regenerate if expired
    // -----------------------------------------------------------------------
    let downloadUrl = record.storageUrl;
    let urlWasRefreshed = false;

    if (isSignedUrlExpired(downloadUrl)) {
      console.log('[Extraction] Signed URL appears expired — regenerating...');
      if (!record.storagePath) {
        // Can't regenerate without the path; fail early with a clear message
        record.status = 'extraction_failed';
        record.extractionError = 'Signed URL expired and storagePath not available for regeneration';
        await record.save();
        res.status(500).json({ error: 'Signed URL expired and cannot be refreshed (missing storagePath)' });
        return;
      }

      try {
        downloadUrl = await regenerateSignedUrl(record.storagePath);
        record.storageUrl = downloadUrl; // persist the refreshed URL
        await record.save();
        urlWasRefreshed = true;
        console.log('[Extraction] Signed URL regenerated successfully.');
      } catch (refreshError) {
        console.error('[Extraction] Failed to regenerate signed URL:', refreshError);
        record.status = 'extraction_failed';
        record.extractionError = `Failed to regenerate expired signed URL: ${(refreshError as Error).message}`;
        await record.save();
        res.status(500).json({ error: 'Signed URL expired and regeneration failed', details: (refreshError as Error).message });
        return;
      }
    }

    // -----------------------------------------------------------------------
    // STEP 2: Download file from Supabase (with one retry after URL refresh)
    // -----------------------------------------------------------------------
    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg'; // Default

    try {
      console.log(`[Extraction] Downloading file from: ${downloadUrl}`);
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      imageBuffer = Buffer.from(response.data);
      mimeType = response.headers['content-type'] || 'image/jpeg';
      console.log(`[Extraction] Downloaded ${imageBuffer.length} bytes, MIME: ${mimeType}`);
    } catch (downloadError) {
      console.error('[Extraction] Failed to download file:', downloadError);

      // If we haven't tried a URL refresh yet, attempt it once more
      if (!urlWasRefreshed && record.storagePath) {
        console.log('[Extraction] Retrying after refreshing signed URL...');
        try {
          downloadUrl = await regenerateSignedUrl(record.storagePath);
          record.storageUrl = downloadUrl;
          await record.save();

          const retryResponse = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          imageBuffer = Buffer.from(retryResponse.data);
          mimeType = retryResponse.headers['content-type'] || 'image/jpeg';
          console.log(`[Extraction] Retry download succeeded: ${imageBuffer.length} bytes`);
        } catch (retryError) {
          // Distinguish URL-refresh-then-fail from simple download failure
          console.error('[Extraction] Download failed even after URL refresh:', retryError);
          record.status = 'extraction_failed';
          record.extractionError = `File download failed after URL refresh: ${(retryError as Error).message}`;
          await record.save();
          res.status(500).json({
            error: 'File download failed after URL refresh',
            details: (retryError as Error).message,
          });
          return;
        }
      } else {
        record.status = 'extraction_failed';
        record.extractionError = `Failed to download file: ${(downloadError as Error).message}`;
        await record.save();
        res.status(500).json({ error: 'Failed to download document from storage' });
        return;
      }
    }

    // -----------------------------------------------------------------------
    // STEP 3: Extract fields using Gemini/Tesseract
    // -----------------------------------------------------------------------
    let extractedFields;
    try {
      console.log('[Extraction] Starting extraction...');
      const result = await extractLandRecord(imageBuffer, mimeType);

      extractedFields = {
        ownerName: result.ownerName,
        khasraNumber: result.khasraNumber,
        plotArea: result.plotArea,
        village: result.village,
        district: result.district,
        landClass: result.landClass,
      };

      record.extractedFields = extractedFields;
      record.extractionSource = result.extractionSource;
      console.log(`[Extraction] Extraction succeeded (source: ${result.extractionSource})`);
    } catch (extractionError) {
      console.error('[Extraction] Extraction failed:', extractionError);
      record.status = 'extraction_failed';
      record.extractionError = (extractionError as Error).message;
      await record.save();
      res.status(500).json({ error: 'Extraction failed', details: (extractionError as Error).message });
      return;
    }

    // -----------------------------------------------------------------------
    // STEP 4: Run validation checks
    // -----------------------------------------------------------------------
    const validationFlags: string[] = [];

    try {
      // Check for duplicates — scope by district to avoid cross-district false positives
      const khasraNumber = extractedFields.khasraNumber?.value || null;
      const duplicateFlags = await detectDuplicates(
        khasraNumber,
        record.village,
        record._id.toString(),
        record.district,   // new: pass district for narrower matching
      );
      validationFlags.push(...duplicateFlags);

      // Check area sum — limit comes from env.VILLAGE_AREA_LIMIT_HECTARES (no hardcoded 500)
      const areaFlags = await checkAreaSum(record.village, undefined, record._id.toString());
      validationFlags.push(...areaFlags);

      record.validationFlags = validationFlags;
      console.log(`[Extraction] Validation complete (${validationFlags.length} flags)`);
    } catch (validationError) {
      console.warn('[Extraction] Validation warning (non-fatal):', validationError);
      // Continue even if validation fails (don't fail the extraction)
    }

    // -----------------------------------------------------------------------
    // STEP 5: Route by confidence
    // -----------------------------------------------------------------------
    const routingStatus = routeByConfidence(extractedFields, validationFlags, env.CONFIDENCE_THRESHOLD);
    record.status = routingStatus === 'needs_review' ? 'needs_review' : 'auto_approved';

    // Save the updated record
    await record.save();

    res.status(200).json({
      recordId: record._id,
      status: record.status,
      extractedFields: record.extractedFields,
      extractionSource: record.extractionSource,
      validationFlags: record.validationFlags,
      confidenceThreshold: env.CONFIDENCE_THRESHOLD,
    });
  } catch (error) {
    console.error('[Extraction] Unexpected error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};
