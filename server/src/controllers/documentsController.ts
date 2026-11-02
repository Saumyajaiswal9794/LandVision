import { Response } from 'express';
import axios from 'axios';
import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { uploadDocument as uploadToStorage, deleteDocument, regenerateSignedUrl } from '../services/storage/supabaseStorage';
import { LandRecord } from '../models/LandRecord';
import { extractLandRecord } from '../services/extraction/extractLandRecord';
import { checkAreaSumFlags } from '../services/validation/areaSumCheck';
import { detectDuplicateFlags } from '../services/validation/duplicateDetection';
import { routeRowByConfidence } from '../services/validation/confidenceRouting';
import { env } from '../config/env';
import { ValidationFlag } from '@landvision/types';

import { extractionQueue } from '../queues/extractionQueue';
import { notifyUser } from '../services/notificationService';
/**
 * Returns true if a Supabase signed URL has expired.
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

// ---------------------------------------------------------------------------
// Sprint 3: GET /documents — list documents for the authenticated user
// ---------------------------------------------------------------------------
export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userRole = user.user_metadata?.role;
    const userId = user.id;
    const { status: statusFilter } = req.query;

    // Build the query
    const query: Record<string, unknown> = {};

    if (userRole === 'officer') {
      // Officers only see their own uploads
      query.uploadedBy = userId;
    }
    // Reviewers see all documents (no uploadedBy filter)

    if (statusFilter && typeof statusFilter === 'string') {
      query.status = statusFilter;
    }

    const records = await LandRecord.find(query)
      .sort({ createdAt: -1 })
      .select('id filename village district status extractionSource createdAt')
      .lean();

    // Map _id to id for the response
    const mapped = records.map((r: any) => ({
      recordId: r._id?.toString?.() || r.id,
      filename: r.filename,
      village: r.village,
      district: r.district,
      status: r.status,
      extractionSource: r.extractionSource,
      createdAt: r.createdAt,
    }));

    res.status(200).json({ documents: mapped });
  } catch (error) {
    console.error('listDocuments error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// ---------------------------------------------------------------------------
// Sprint 3 + Sprint D: GET /documents/:id — full document detail
// Sprint D: also returns the child row records that belong to this document
//           (rows where documentId == this document's _id). The document
//           itself is the upload record; child rows are the extracted plots.
// ---------------------------------------------------------------------------
export const getDocumentDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const userRole = user.user_metadata?.role;
    const userId = user.id;

    const record = await LandRecord.findById(id);

    if (!record) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Officers can only view their own documents
    if (userRole === 'officer' && record.uploadedBy !== userId) {
      res.status(403).json({ error: 'Forbidden: You can only view your own documents' });
      return;
    }

    // Refresh the signed URL if expired
    if (record.storageUrl && record.storagePath && isSignedUrlExpired(record.storageUrl)) {
      try {
        const freshUrl = await regenerateSignedUrl(record.storagePath);
        record.storageUrl = freshUrl;
        await record.save();
      } catch (refreshErr) {
        console.warn('Failed to refresh signed URL:', refreshErr);
        // Continue anyway — the old URL might still work
      }
    }

    const r = record as any;

    // -----------------------------------------------------------------------
    // Sprint D: fetch all child row records (rows belonging to this document).
    // A row is any LandRecord whose documentId == this document's _id AND
    // whose _id is NOT this document's _id (the upload record itself has
    // documentId === null until it's been promoted to a parent; we filter
    // it out by requiring _id != id).
    // -----------------------------------------------------------------------
    let rows: any[] = [];
    try {
      const childDocs = await LandRecord.find({
        documentId: id,
        _id: { $ne: id },
      })
        .sort({ pageNo: 1, rowIndex: 1 })
        .lean();

      rows = childDocs.map((c: any) => ({
        recordId: c._id?.toString?.() || c.id,
        documentId: c.documentId,
        rowIndex: c.rowIndex ?? null,
        pageNo: c.pageNo ?? null,
        filename: c.filename,
        village: c.village,
        district: c.district,
        extractedFields: c.extractedFields || {},
        extractionSource: c.extractionSource || null,
        validationFlags: c.validationFlags || [],
        validationResults: c.validationResults || [],
        lowConfidenceFields: c.lowConfidenceFields || [],
        status: c.status,
        reviewedBy: c.reviewedBy || null,
        reviewedAt: c.reviewedAt || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    } catch (rowsErr) {
      console.warn('Failed to load child rows for document:', rowsErr);
      // Continue without rows — the document itself is still returnable.
    }

    res.status(200).json({
      recordId: r._id,
      filename: r.filename,
      village: r.village,
      district: r.district,
      tehsil: r.tehsil,
      state: r.state,
      owners: r.owners,
      areaTotal: r.areaTotal,
      areaUnit: r.areaUnit,
      documentId: r.documentId,
      khataNumber: r.khataNumber,
      khasraNumber: r.khasraNumber,
      khatoniNumber: r.khatoniNumber,
      extractedFields: r.extractedFields || {},
      extractionSource: r.extractionSource,
      validationFlags: r.validationFlags || [],
      // Sprint C: structured flags + low-confidence fields
      validationResults: r.validationResults || [],
      lowConfidenceFields: r.lowConfidenceFields || [],
      status: r.status,
      storageUrl: r.storageUrl,
      storagePath: r.storagePath,
      uploadedBy: r.uploadedBy,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      extractionError: r.extractionError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      // Sprint D: all child rows belonging to this document
      rows,
    });
  } catch (error) {
    console.error('getDocumentDetail error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// ---------------------------------------------------------------------------
// Sprint 3 + Sprint D: PATCH /documents/:id/review — reviewer actions
//
// Sprint D: now operates per-row as well as per-document.
//   action: 'approve' | 'reject' | 'edit'
//     - Per-document  (no rowId in body): operates on the document itself.
//     - Per-row        (rowId in body):    operates on the row LandRecord
//                                          identified by rowId.
//   action: 'approve_all_high_confidence'
//     - Iterates ALL child rows of the document; any row currently in
//       'needs_review' but with NO error-severity validationResults
//       AND no lowConfidenceFields is auto-approved in batch.
// ---------------------------------------------------------------------------

// Helper — normalises a single extracted field with a human-corrected value.
function applyHumanCorrection(record: any, fieldName: string, newValue: string): void {
  if (!record.extractedFields) {
    record.extractedFields = {} as any;
  }
  const fields = record.extractedFields as any;
  if (!fields[fieldName]) {
    fields[fieldName] = { value: null, confidence: 0 };
  }
  fields[fieldName].value = newValue;
  fields[fieldName].confidence = 1.0;
  fields[fieldName].source = 'human_corrected';
  // Remove from lowConfidenceFields (if present) since the field has
  // just been corrected to confidence 1.0.
  if (Array.isArray(record.lowConfidenceFields)) {
    record.lowConfidenceFields = record.lowConfidenceFields.filter(
      (f: string) => f !== fieldName,
    );
  }
}

export const reviewDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const { action, correctedFields, reason, rowId } = req.body;

    const validActions = ['approve', 'reject', 'edit', 'approve_all_high_confidence'];
    if (!validActions.includes(action)) {
      res.status(400).json({
        error: 'Invalid action. Must be "approve", "reject", "edit", or "approve_all_high_confidence".',
      });
      return;
    }

    // -----------------------------------------------------------------------
    // Sprint D: "approve all high-confidence rows" — batch action.
    // -----------------------------------------------------------------------
    if (action === 'approve_all_high_confidence') {
      const childDocs = await LandRecord.find({
        documentId: id,
        _id: { $ne: id },
        status: 'needs_review',
      });

      let approvedCount = 0;
      for (const child of childDocs) {
        const hasErrorFlag = (child.validationResults || []).some(
          (f: any) => f.severity === 'error',
        );
        const hasLowConfidence = (child.lowConfidenceFields || []).length > 0;
        if (!hasErrorFlag && !hasLowConfidence) {
          child.status = 'reviewed_approved';
          child.reviewedBy = user.id;
          child.reviewedAt = new Date();
          await child.save();
          approvedCount++;
        }
      }
      res.status(200).json({
        documentId: id,
        approvedCount,
        message: `${approvedCount} row(s) auto-approved.`,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // Per-row vs per-document: pick the record to operate on.
    // -----------------------------------------------------------------------
    let record: any;
    if (rowId) {
      // Per-row review: the row must belong to this document.
      record = await LandRecord.findOne({ _id: rowId, documentId: id });
      if (!record) {
        res.status(404).json({
          error: `Row ${rowId} not found under document ${id}.`,
        });
        return;
      }
    } else {
      // Per-document review: operate on the document itself.
      record = await LandRecord.findById(id);
      if (!record) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
    }

    if (record.status !== 'needs_review') {
      res.status(400).json({
        error: `Status is "${record.status}". Only "needs_review" records can be reviewed.`,
      });
      return;
    }

    if (action === 'approve') {
      record.status = 'reviewed_approved';
      record.reviewedBy = user.id;
      record.reviewedAt = new Date();
      await record.save();

      void notifyUser({
        userId: record.uploadedBy || '',
        type: 'review_completed',
        title: 'Record approved',
        message: rowId
          ? `A row of "${record.filename || 'your document'}" was approved by a reviewer.`
          : `"${record.filename || 'Your document'}" was approved by a reviewer.`,
        metadata: { documentId: id, rowId: rowId || null, action: 'approved' },
      });

      res.status(200).json({
        recordId: record._id,
        rowId: rowId || null,
        status: record.status,
        message: rowId ? 'Row approved successfully.' : 'Document approved successfully.',
      });
      return;
    }

    if (action === 'reject') {
      record.status = 'reviewed_rejected';
      record.reviewedBy = user.id;
      record.reviewedAt = new Date();
      if (reason) {
        record.extractionError = reason;
      }
      await record.save();

      void notifyUser({
        userId: record.uploadedBy || '',
        type: 'review_completed',
        title: 'Record rejected',
        message: rowId
          ? `A row of "${record.filename || 'your document'}" was rejected by a reviewer.${reason ? ` Reason: ${reason}` : ''}`
          : `"${record.filename || 'Your document'}" was rejected by a reviewer.${reason ? ` Reason: ${reason}` : ''}`,
        metadata: { documentId: id, rowId: rowId || null, action: 'rejected', reason: reason || null },
      });

      res.status(200).json({
        recordId: record._id,
        rowId: rowId || null,
        status: record.status,
        message: rowId ? 'Row rejected.' : 'Document rejected.',
      });
      return;
    }

    if (action === 'edit') {
      if (!correctedFields || typeof correctedFields !== 'object') {
        res.status(400).json({ error: 'correctedFields object is required for "edit" action.' });
        return;
      }

      // Apply each corrected field individually — source=human_corrected,
      // confidence=1.0. Removes the field from lowConfidenceFields.
      for (const [fieldName, newValue] of Object.entries(correctedFields)) {
        applyHumanCorrection(record, fieldName, String(newValue));
      }

      record.status = 'reviewed_approved';
      record.reviewedBy = user.id;
      record.reviewedAt = new Date();
      await record.save();

      res.status(200).json({
        recordId: record._id,
        rowId: rowId || null,
        status: record.status,
        extractedFields: record.extractedFields,
        lowConfidenceFields: record.lowConfidenceFields || [],
        message: rowId
          ? 'Row corrections saved and approved.'
          : 'Corrections saved and document approved.',
      });
      return;
    }
  } catch (error) {
    console.error('reviewDocument error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// ---------------------------------------------------------------------------
// Sprint 1 & 2: Original controller functions (unchanged)
// ---------------------------------------------------------------------------

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  let savedStoragePath: string | null = null;

  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
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

    // Create the LandRecord — persist storagePath alongside storageUrl
    const landRecord = new LandRecord({
      filename: file.originalname,
      village: village.trim(),
      district: district.trim(),
      uploadedBy: user.id,
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
    // If the DB insert failed after the storage upload, delete the orphaned file
    if (savedStoragePath) {
      console.warn(`MongoDB save failed after storage upload. Cleaning up orphaned file: ${savedStoragePath}`);
      await deleteDocument(savedStoragePath);
    }

    console.error('uploadDocument error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getDocumentStatus = async (req: Request, res: Response): Promise<void> => {
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
 * Triggers AI extraction on an uploaded land record.
 *
 * The heavy lifting (download → Gemini/Tesseract → per-row validation →
 * persist child records → status routing → review queue + notifications)
 * runs asynchronously in the extraction queue worker — see
 * services/extraction/extractionPipeline.ts. This endpoint:
 *   1. validates ownership,
 *   2. guards against double extraction,
 *   3. flips the document to `extracting`,
 *   4. enqueues the job and returns 202 immediately.
 *
 * Clients poll GET /api/documents/:id/status (or GET /:id/extraction-status)
 * to observe progress.
 *
 * POST /api/documents/:id/extract
 */
export const triggerExtraction = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;

    // Fetch the LandRecord (this acts as the "document" — many child records
    // will be created from it via documentId).
    const record = await LandRecord.findById(id);
    if (!record) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Officers can only extract their own documents
    const userRole = user?.role || user?.app_metadata?.role || user?.user_metadata?.role;
    const userId = user?.id;
    if (userRole === 'officer' && record.uploadedBy !== userId) {
      res.status(403).json({ error: 'Forbidden: You can only extract your own documents' });
      return;
    }

    // Check if already extracted / in flight
    if (
      ['extracting', 'extracted', 'needs_review', 'auto_approved', 'reviewed_approved'].includes(
        record.status,
      )
    ) {
      res.status(400).json({ error: `Document already extracted (status: ${record.status})` });
      return;
    }

    // Update status to "extracting", then enqueue the background job.
    record.status = 'extracting';
    await record.save();
    await extractionQueue.addJob({ id: record._id.toString(), requestedBy: userId ?? null });

    res.status(202).json({ recordId: record._id, status: 'extracting' });
  } catch (error) {
    console.error('[Extraction] Unexpected error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};
