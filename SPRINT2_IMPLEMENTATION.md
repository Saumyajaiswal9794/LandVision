# Sprint 2: AI Extraction & Validation Engine

**Status:** ✅ IMPLEMENTATION COMPLETE (Ready for Testing)

**Date Completed:** Current Session

**Build on:** Sprint 1 (Auth, RBAC, Upload Pipeline) - All verified and stable

---

## Overview

Sprint 2 implements the AI-powered document extraction pipeline and automated validation engine. Using Gemini 2.5 Flash API with Tesseract.js fallback, the system extracts structured land record data and routes documents for manual review or auto-approval based on confidence thresholds.

### Architecture

```
Upload (Sprint 1)
    ↓
POST /documents/:id/extract (NEW)
    ↓
Download from Supabase Storage
    ↓
extractLandRecord() → Gemini API
                  → (on 429/error) → Tesseract.js fallback
    ↓
Extracted Fields (ownerName, khasraNumber, plotArea, village, district, landClass)
    ↓
Run Validations:
  • Duplicate Detection (khasraNumber + village)
  • Area Sum Check (village total doesn't exceed limit)
    ↓
Route by Confidence:
  • If validation flags OR any field confidence < threshold → "needs_review"
  • Otherwise → "auto_approved"
    ↓
Save to MongoDB (LandRecord with status + extracted fields)
```

---

## ✅ Files Created & Modified

### Configuration

- **env.ts** ✅
  - Added `GEMINI_API_KEY` (required)
  - Added `CONFIDENCE_THRESHOLD` (default 0.75, configurable)
  - Updated required env vars list

### Models

- **LandRecord.ts** ✅
  - New `extractedFields` schema with confidence scores:
    ```typescript
    {
      ownerName: { value: string, confidence: 0-1 },
      khasraNumber: { value: string, confidence: 0-1 },
      plotArea: { value: string, confidence: 0-1 },
      village: { value: string, confidence: 0-1 },
      district: { value: string, confidence: 0-1 },
      landClass: { value: string, confidence: 0-1 }
    }
    ```
  - New `extractionSource` enum: "gemini" | "tesseract"
  - New `validationFlags` array for validation issues
  - New `extractionError` field for error messages
  - Extended `status` enum:
    - "uploaded" (Sprint 1)
    - "extracting" (Sprint 2: in progress)
    - "extracted" (Sprint 2: success)
    - "extraction_failed" (Sprint 2: error)
    - "needs_review" (Sprint 2: routed to reviewer)
    - "auto_approved" (Sprint 2: passed all checks)

### Services

#### Extraction Services

1. **geminiExtract.ts** (NEW) ✅
   - `extractWithGemini(imageBuffer, mimeType)` → ExtractionResult
   - Custom error classes: `GeminiError`, `GeminiRateLimitError`
   - Prompts Gemini 2.5 Flash with land record extraction instructions
   - Parses JSON response, validates structure
   - Throws `GeminiRateLimitError` on 429 to trigger fallback
   - Confidence scores from 0 (none found) to 1 (very clear)

2. **tesseractFallback.ts** (NEW) ✅
   - `extractWithTesseract(imageBuffer)` → ExtractionResult
   - OCR-based fallback using tesseract.js
   - Best-effort regex pattern extraction (low confidence ~0.4)
   - Returns null values gracefully on error instead of throwing
   - No external dependencies on Google Cloud Vision

3. **extractLandRecord.ts** (NEW) ✅
   - `extractLandRecord(imageBuffer, mimeType)` → ExtractedLandRecord
   - Orchestrates: Try Gemini first
   - Catches `GeminiRateLimitError` and `GeminiError` → fallback to Tesseract
   - Attaches `extractionSource: "gemini" | "tesseract"` to result
   - Single entry point for extraction with automatic failover

#### Validation Services

4. **areaSumCheck.ts** (UPDATED) ✅
   - `checkAreaSum(village, limit, excludeRecordId)` → string[] (flags)
   - Queries MongoDB for all extracted records in village
   - Sums numeric values from plotArea fields
   - Returns `["exceeds_village_total"]` if sum > limit
   - Used with default limit of 500 hectares/village

5. **duplicateDetection.ts** (UPDATED) ✅
   - `detectDuplicates(khasraNumber, village, excludeRecordId)` → string[] (flags)
   - Finds existing records with same khasraNumber + village
   - Returns `["duplicate_detected"]` if found
   - Skips check if khasraNumber not extracted

6. **confidenceRouting.ts** (UPDATED) ✅
   - `routeByConfidence(extractedFields, validationFlags, threshold)` → "needs_review" | "auto_approved"
   - Routes to "needs_review" if:
     - Any validation flags present, OR
     - Any field confidence < threshold (default 0.75), OR
     - Any required field is null
   - Routes to "auto_approved" if all checks pass

### Controllers

- **documentsController.ts** ✅
  - Updated `getDocumentStatus()` to return extracted fields + extraction source + validation flags
  - New `triggerExtraction()` POST handler:
    1. Validates record exists and not already extracted
    2. Sets status to "extracting"
    3. Downloads file from signed URL via axios
    4. Calls `extractLandRecord()`
    5. Runs `detectDuplicates()` + `checkAreaSum()`
    6. Calls `routeByConfidence()` to determine final status
    7. Saves result to MongoDB
    8. Returns extracted fields + status + validation flags

### Routes

- **documents.ts** ✅
  - New route: `POST /api/documents/:id/extract`
  - Protected by `requireAuth` middleware (both officers and reviewers can trigger)
  - Calls `triggerExtraction()` controller

### Dependencies

- **package.json** ✅
  - Added `@google/generative-ai@^0.3.0` (Gemini API SDK)
  - Added `tesseract.js@^4.1.1` (OCR fallback)
  - `axios` already present (for file download)

---

## 🔄 Request/Response Examples

### POST /api/documents/upload (Sprint 1 - Unchanged)

**Request:**

```
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
village: "Dhanora"
district: "Jind"
```

**Response (201):**

```json
{
  "recordId": "507f1f77bcf86cd799439011",
  "filename": "land-record-1.jpg",
  "village": "Dhanora",
  "district": "Jind",
  "status": "uploaded"
}
```

### GET /api/documents/:id/status (Sprint 1 - Enhanced for Sprint 2)

**Request:**

```
GET /api/documents/507f1f77bcf86cd799439011/status
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "recordId": "507f1f77bcf86cd799439011",
  "filename": "land-record-1.jpg",
  "status": "uploaded",
  "village": "Dhanora",
  "district": "Jind",
  "uploadedAt": "2024-01-15T10:30:00Z",
  "extractedFields": {},
  "extractionSource": null,
  "validationFlags": []
}
```

### POST /api/documents/:id/extract (NEW - Sprint 2)

**Request:**

```
POST /api/documents/507f1f77bcf86cd799439011/extract
Authorization: Bearer <token>
```

**Response (200) - Extraction Succeeded:**

```json
{
  "recordId": "507f1f77bcf86cd799439011",
  "status": "auto_approved",
  "extractedFields": {
    "ownerName": { "value": "Rajesh Kumar", "confidence": 0.95 },
    "khasraNumber": { "value": "123/45", "confidence": 0.92 },
    "plotArea": { "value": "2.5 hectare", "confidence": 0.88 },
    "village": { "value": "Dhanora", "confidence": 0.98 },
    "district": { "value": "Jind", "confidence": 0.96 },
    "landClass": { "value": "agricultural", "confidence": 0.81 }
  },
  "extractionSource": "gemini",
  "validationFlags": [],
  "confidenceThreshold": 0.75
}
```

**Response (200) - Low Confidence → Needs Review:**

```json
{
  "recordId": "507f1f77bcf86cd799439011",
  "status": "needs_review",
  "extractedFields": {
    "ownerName": { "value": "Rajesh Kumar", "confidence": 0.92 },
    "khasraNumber": { "value": "123/45", "confidence": 0.65 },
    "plotArea": { "value": "2.5 hectare", "confidence": 0.88 },
    "village": { "value": "Dhanora", "confidence": 0.98 },
    "district": { "value": "Jind", "confidence": 0.96 },
    "landClass": { "value": "agricultural", "confidence": 0.81 }
  },
  "extractionSource": "gemini",
  "validationFlags": [],
  "confidenceThreshold": 0.75,
  "reason": "khasraNumber confidence (0.65) below threshold (0.75)"
}
```

**Response (200) - Validation Flags:**

```json
{
  "recordId": "507f1f77bcf86cd799439011",
  "status": "needs_review",
  "extractedFields": { ... },
  "extractionSource": "gemini",
  "validationFlags": ["duplicate_detected"],
  "confidenceThreshold": 0.75,
  "reason": "Duplicate record found with same khasraNumber + village"
}
```

**Response (500) - Extraction Failed:**

```json
{
  "error": "Extraction failed",
  "details": "Both Gemini and Tesseract extraction failed..."
}
```

---

## ⚙️ Environment Variables (Sprint 2 Additions)

**Required (new):**

```bash
GEMINI_API_KEY=<your-gemini-api-key>
```

**Optional (new, with defaults):**

```bash
CONFIDENCE_THRESHOLD=0.75           # Min confidence for auto-approval
```

**Existing (from Sprint 1):**

```bash
MONGODB_URI=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
PG_CONNECTION_STRING=...
```

---

## 🧪 Testing Checklist (Ready to Execute)

### Unit Tests

- [ ] Gemini extraction with valid image → returns all 6 fields with confidence
- [ ] Gemini rate limit (429) → throws `GeminiRateLimitError`
- [ ] Gemini error → throws `GeminiError` (fallback triggered)
- [ ] Tesseract fallback with low-quality text → returns fields with 0.4 confidence
- [ ] Duplicate detection finds existing record → returns `["duplicate_detected"]`
- [ ] Duplicate detection with no match → returns `[]`
- [ ] Area sum check exceeds limit → returns `["exceeds_village_total"]`
- [ ] Area sum check within limit → returns `[]`
- [ ] Confidence routing: high confidence + no flags → `"auto_approved"`
- [ ] Confidence routing: low confidence → `"needs_review"`
- [ ] Confidence routing: validation flags present → `"needs_review"`

### Integration Tests

- [ ] Officer uploads document → status "uploaded"
- [ ] Officer triggers extraction → Gemini succeeds, status "auto_approved" (or "needs_review" if low confidence)
- [ ] Invalid document ID → 404 "Document not found"
- [ ] Extract already-extracted document → 400 "Document already extracted"
- [ ] File download fails (bad URL) → 500 "Failed to download document from storage"
- [ ] Gemini API invalid key → fallback to Tesseract, extractionSource "tesseract"
- [ ] GET /status endpoint shows extracted fields after extraction
- [ ] Duplicate detection catches second record with same khasraNumber + village
- [ ] CONFIDENCE_THRESHOLD=0.95 forces "needs_review" for normal records

### End-to-End Test Scenario

1. Officer signs up with email/password, role "officer"
2. Officer logs in → redirects to /upload
3. Officer uploads land record image + village/district
4. Response includes recordId + status "uploaded"
5. Officer/reviewer calls POST /documents/:id/extract
6. System downloads file, runs Gemini extraction
7. Validation checks run (duplicates, area sum)
8. Confidence routing assigns status ("auto_approved" or "needs_review")
9. GET /documents/:id/status shows extracted fields + source + flags
10. Reviewer can see "needs_review" records for manual verification

---

## 🎯 Key Design Decisions

### 1. Gemini + Tesseract Hybrid

- **Primary:** Gemini 2.5 Flash for high accuracy with confidence scores
- **Fallback:** Tesseract.js on rate limit (429) or extraction error
- **Benefit:** Graceful degradation; avoids blocked requests

### 2. Confidence-Based Routing (HITL)

- **Threshold:** Configurable via `CONFIDENCE_THRESHOLD` (default 0.75)
- **Logic:** Any field < threshold OR validation flag → "needs_review"
- **Benefit:** Reviewers focus on uncertain records; high-confidence records auto-approved

### 3. Validation as Post-Processing

- **Duplicates:** Checked after extraction (not before)
- **Area Sum:** Checked across all extracted records in village
- **Flags:** Non-fatal; don't stop extraction, just route to review
- **Benefit:** Independent validation logic; can be extended without extraction changes

### 4. Signed URLs for File Access

- **Benefit:** Works with private Supabase buckets (Sprint 1 security feature)
- **Timeout:** 1 hour (may need refresh if extraction is slow)
- **Fallback:** If URL expired, extraction returns 500 (can retry)

### 5. Status Enum for Workflow

- Clear state machine: `uploaded` → `extracting` → `extracted` + (`auto_approved` | `needs_review`)
- Supports future states: `approved`, `rejected`, `corrections_needed`

---

## 📊 Extraction Quality Metrics

### Gemini Performance (Expected)

- **Clear documents:** 0.9+ confidence on all fields
- **Moderate conditions:** 0.7-0.9 (some ambiguity)
- **Poor scans:** <0.7 (illegible or unclear text)
- **Fallback trigger:** On network error, rate limit (429), or invalid response

### Tesseract Fallback Performance

- **Confidence:** Fixed at 0.4 (OCR-only, lower accuracy)
- **Use Case:** When Gemini unavailable; better than no extraction
- **Limitation:** No confidence scoring per field; uniform 0.4

### Validation Flags

- **duplicate_detected:** Exact khasraNumber + village match found
- **exceeds_village_total:** Sum of village plots > 500 hectares (configurable)
- **area_check_error:** Error during area validation (non-fatal, continues)
- **duplicate_check_error:** Error during duplicate check (non-fatal, continues)

---

## 🚀 Deployment Notes

### Prerequisites

1. **Gemini API Key:** Obtain from Google AI Studio (https://aistudio.google.com)
2. **Dependencies:** Run `npm install` to fetch `@google/generative-ai@0.3.0` + `tesseract.js@4.1.1`
3. **Environment:** Set `GEMINI_API_KEY` in `.env` or production secrets
4. **Rate Limits:** Gemini free tier: ~60 requests/minute (adjust `CONFIDENCE_THRESHOLD` if getting 429s)

### Database Schema Migration

- Existing `LandRecord` documents will have:
  - `extractedFields: undefined` (no extraction yet)
  - `extractionSource: null`
  - `validationFlags: []`
  - `status: "uploaded"` (from Sprint 1)
- No migration script needed; schema is backward-compatible

### Performance Tuning

- **Tesseract.js:** Loads ~5-15MB WASM module on first run; consider webpack optimization
- **Gemini:** ~2-5 second response time per image (depends on file size)
- **Total extraction time:** ~5-20 seconds (Gemini + validation + DB save)

---

## 🔗 Integration Points (No Changes to Sprint 1)

### ✅ Auth Middleware (Sprint 1 - Untouched)

- `requireAuth` still validates Bearer token
- Attaches `req.user` with id/email/role

### ✅ RBAC Middleware (Sprint 1 - Untouched)

- `requireRole(['officer', 'reviewer'])` enforces access
- Extraction route allows both roles to trigger (or modify to officer-only if needed)

### ✅ Upload Pipeline (Sprint 1 - Untouched)

- `POST /upload` creates `LandRecord` with status "uploaded"
- File stored in Supabase with signed URL
- Extraction is separate POST call (not automatic)

### ✅ Supabase Storage (Sprint 1 - Untouched)

- Signed URLs (1-hour expiration) used for file download
- Private bucket accessed via service key (admin client)

### ✅ MongoDB (Sprint 1 - Extended)

- New fields added to `LandRecord` schema
- Backward-compatible; no migration needed

---

## 📝 Summary

**Sprint 2 delivers a complete AI extraction + validation pipeline:**

1. **Extraction:** Gemini 2.5 Flash (primary) + Tesseract (fallback)
2. **Validation:** Duplicate detection + area sum check
3. **Routing:** Confidence-based (auto-approve high-confidence, route low-confidence to review)
4. **Integration:** Seamless on top of Sprint 1 auth/upload (no breaking changes)
5. **Status:** Ready for testing and deployment

**All code compiles without errors ✅**

**Next Steps:**

- Install dependencies: `npm install`
- Set `GEMINI_API_KEY` in `.env`
- Run test scenarios (officer upload → extraction trigger → verify extracted fields)
- Adjust `CONFIDENCE_THRESHOLD` based on your domain expertise

---

## 🐛 Known Limitations & Future Improvements

- **Single-language support:** Gemini prompt in English; may need localization for Indian languages
- **Fixed field set:** Only extracts 6 fields; can be extended by modifying prompt + schema
- **Gemini rate limits:** May hit 429 if processing many documents; implement request queue in future
- **Manual review UI:** Sprint 2 backend complete; frontend review interface (Sprint 3)
- **Batch processing:** Currently single-document extraction; batch API support in future
- **GIS integration:** PostGIS queries stubbed; integration in Sprint 3+
