import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { LandRecord } from '../models/LandRecord';

// ---------------------------------------------------------------------------
// Sprint D: GET /api/records?documentId=...
// List LandRecord rows. Optional query parameters:
//   - documentId — only rows belonging to that document
//   - status     — only rows in that status
// Returns the rows in { pageNo, rowIndex } order.
// ---------------------------------------------------------------------------

// Helper — applies a single human-corrected field value (mirrors the
// helper in documentsController — kept local to avoid an awkward
// circular import).
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
  if (Array.isArray(record.lowConfidenceFields)) {
    record.lowConfidenceFields = record.lowConfidenceFields.filter(
      (f: string) => f !== fieldName,
    );
  }
}

export const listRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRole = req.user.user_metadata?.role;
    const userId = req.user.id;
    const { documentId, status } = req.query;

    const query: Record<string, unknown> = {};

    // Officers only see their own uploads.
    if (userRole === 'officer') {
      query.uploadedBy = userId;
    }

    if (documentId && typeof documentId === 'string') {
      query.documentId = documentId;
    }
    if (status && typeof status === 'string') {
      query.status = status;
    }

    const docs = await LandRecord.find(query)
      .sort({ documentId: 1, pageNo: 1, rowIndex: 1 })
      .lean();

    const records = docs.map((d: any) => ({
      recordId: d._id?.toString?.() || d.id,
      documentId: d.documentId ?? null,
      rowIndex: d.rowIndex ?? null,
      pageNo: d.pageNo ?? null,
      filename: d.filename,
      village: d.village,
      district: d.district,
      extractedFields: d.extractedFields || {},
      extractionSource: d.extractionSource || null,
      validationFlags: d.validationFlags || [],
      validationResults: d.validationResults || [],
      lowConfidenceFields: d.lowConfidenceFields || [],
      status: d.status,
      reviewedBy: d.reviewedBy || null,
      reviewedAt: d.reviewedAt || null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    res.status(200).json({
      records,
      total: records.length,
    });
  } catch (error) {
    console.error('listRecords error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// ---------------------------------------------------------------------------
// Sprint D: GET /api/records/:id — single row detail.
// ---------------------------------------------------------------------------

export const getRecordById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const doc: any = await LandRecord.findById(id).lean();

    if (!doc) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Officers can only see their own records.
    const userRole = req.user.user_metadata?.role;
    const userId = req.user.id;
    if (userRole === 'officer' && doc.uploadedBy !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json({
      recordId: doc._id?.toString?.() || doc.id,
      documentId: doc.documentId ?? null,
      rowIndex: doc.rowIndex ?? null,
      pageNo: doc.pageNo ?? null,
      filename: doc.filename,
      village: doc.village,
      district: doc.district,
      extractedFields: doc.extractedFields || {},
      extractionSource: doc.extractionSource || null,
      validationFlags: doc.validationFlags || [],
      validationResults: doc.validationResults || [],
      lowConfidenceFields: doc.lowConfidenceFields || [],
      status: doc.status,
      reviewedBy: doc.reviewedBy || null,
      reviewedAt: doc.reviewedAt || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error('getRecordById error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// ---------------------------------------------------------------------------
// Sprint D: PATCH /api/records/:id — edit a single field of a row.
// Request body:
//   { fieldName: 'ownerName', value: 'Ram Singh' }
// Behaviour:
//   - Sets record.extractedFields[fieldName].value = value
//   - Sets record.extractedFields[fieldName].confidence = 1.0
//   - Sets record.extractedFields[fieldName].source = 'human_corrected'
//   - Removes fieldName from record.lowConfidenceFields
//   - Saves and returns the updated record.
// Auth: requireAuth (any role). RBAC for reviewer-only can be applied
// at the route layer if needed.
// ---------------------------------------------------------------------------

export const updateRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { fieldName, value } = req.body || ({} as any);

    if (!fieldName || typeof fieldName !== 'string') {
      res.status(400).json({
        error: 'Request body must include `fieldName` (string).',
      });
      return;
    }
    if (value === undefined || value === null) {
      res.status(400).json({
        error: 'Request body must include `value` (non-null string).',
      });
      return;
    }

    const record = await LandRecord.findById(id);
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Officers can only edit their own records.
    const userRole = req.user.user_metadata?.role;
    const userId = req.user.id;
    if (userRole === 'officer' && record.uploadedBy !== userId) {
      res.status(403).json({ error: 'Forbidden: You can only edit your own records.' });
      return;
    }

    // Apply the human correction.
    applyHumanCorrection(record, fieldName, String(value));
    await record.save();

    res.status(200).json({
      message: 'Field updated successfully.',
      recordId: record._id,
      fieldName,
      extractedFields: record.extractedFields,
      lowConfidenceFields: record.lowConfidenceFields || [],
    });
  } catch (error) {
    console.error('updateRecord error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};
