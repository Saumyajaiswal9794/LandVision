# Sprint 2 Setup & Testing Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

This will install the new Sprint 2 packages:

- `@google/generative-ai@^0.3.0` - Gemini API SDK
- `tesseract.js@^4.1.1` - OCR fallback (adds ~5-15MB to node_modules)

### 2. Configure Environment

Create/update `.env` file in server root:

```bash
# NEW for Sprint 2
GEMINI_API_KEY=your-gemini-api-key-here
CONFIDENCE_THRESHOLD=0.75  # Optional, default is 0.75

# Existing (from Sprint 1)
MONGODB_URI=mongodb://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
PG_CONNECTION_STRING=postgresql://...
```

**Get Gemini API Key:**

1. Visit https://aistudio.google.com
2. Click "Get API Key"
3. Create new API key for your project
4. Copy and paste into `.env`

### 3. Start Server

```bash
npm run dev
# or
npm start
```

Verify server starts without errors. Check logs for:

```
Server running on port 4000
MongoDB connected
```

---

## 🧪 Testing Scenarios

### Scenario 1: Basic Extraction (Happy Path)

**Prerequisites:**

- Officer account created (from Sprint 1)
- Land record image (any image with text works for testing)

**Steps:**

1. **Upload Document**

   ```bash
   curl -X POST http://localhost:4000/api/documents/upload \
     -H "Authorization: Bearer <officer-token>" \
     -F "file=@land-record.jpg" \
     -F "village=Dhanora" \
     -F "district=Jind"
   ```

   Response (save `recordId`):

   ```json
   {
     "recordId": "507f1f77bcf86cd799439011",
     "filename": "land-record.jpg",
     "status": "uploaded"
   }
   ```

2. **Trigger Extraction**

   ```bash
   curl -X POST http://localhost:4000/api/documents/507f1f77bcf86cd799439011/extract \
     -H "Authorization: Bearer <officer-token>"
   ```

   Response (should show extracted fields):

   ```json
   {
     "recordId": "507f1f77bcf86cd799439011",
     "status": "auto_approved",
     "extractedFields": {
       "ownerName": { "value": "...", "confidence": 0.92 },
       "khasraNumber": { "value": "...", "confidence": 0.88 },
       ...
     },
     "extractionSource": "gemini"
   }
   ```

3. **Verify Status Updated**

   ```bash
   curl http://localhost:4000/api/documents/507f1f77bcf86cd799439011/status \
     -H "Authorization: Bearer <officer-token>"
   ```

   Should show `status: "auto_approved"` and extracted fields

---

### Scenario 2: Low Confidence (Routing to Review)

**Steps:**

1. Upload a low-quality/blurry image
2. Trigger extraction
3. Verify response has `status: "needs_review"` if any field confidence < 0.75
4. Check `validationFlags: []` (no flags, but low confidence)

**Why:** Gemini returns lower confidence scores for unclear images

---

### Scenario 3: Duplicate Detection

**Steps:**

1. Upload document with unique values (e.g., khasraNumber "123/45", village "Dhanora")
2. Trigger extraction → `status: "auto_approved"`
3. Upload ANOTHER document with same values
4. Trigger extraction on second document
5. Verify response has:
   ```json
   {
     "status": "needs_review",
     "validationFlags": ["duplicate_detected"]
   }
   ```

---

### Scenario 4: Gemini Rate Limit → Tesseract Fallback

**Steps (Manual Testing):**

1. Edit `.env`: Set `GEMINI_API_KEY=invalid-key-to-trigger-error`
2. Upload document
3. Trigger extraction
4. Check server logs for:
   ```
   [Extraction] Gemini error: ...
   [Extraction] Starting Tesseract fallback...
   ```
5. Response should have:
   ```json
   {
     "extractionSource": "tesseract",
     "extractedFields": { ... with 0.4 confidence }
   }
   ```

**Note:** Tesseract confidence is fixed at 0.4, so status will be "needs_review"

---

### Scenario 5: Confidence Threshold Configuration

**Steps:**

1. Edit `.env`: Set `CONFIDENCE_THRESHOLD=0.95` (very high)
2. Upload document and trigger extraction
3. Verify even high-confidence Gemini extractions get `status: "needs_review"`
   - Because at least one field will be < 0.95

4. Reset `.env`: `CONFIDENCE_THRESHOLD=0.75`

---

### Scenario 6: Missing Gemini API Key

**Test:**

```bash
# Remove GEMINI_API_KEY from .env
# Restart server
# Try extraction
```

Expected:

- Server logs warning: `[Warning] Missing environment variables: GEMINI_API_KEY`
- Extraction fails: `error: "Extraction failed", details: "GEMINI_API_KEY not configured"`

---

## ✅ Verification Checklist

Run through each scenario and verify:

- [ ] **Upload works** - Document stored, recordId returned
- [ ] **Extraction starts** - POST /extract accepted
- [ ] **Gemini extracts** - extractedFields populated, extractionSource "gemini"
- [ ] **Confidence scores** - All fields have 0-1 confidence values
- [ ] **Auto-approval works** - High-confidence records get status "auto_approved"
- [ ] **Manual review routing** - Low-confidence records get status "needs_review"
- [ ] **Duplicate detection** - Second record with same khasraNumber+village flagged
- [ ] **Fallback works** - Invalid Gemini key triggers Tesseract
- [ ] **Tesseract extraction** - OCR results with 0.4 confidence
- [ ] **Status endpoint** - GET /status shows extracted fields
- [ ] **Authorization** - Without auth token, request returns 401
- [ ] **No auth error** - Extraction doesn't break if GEMINI_API_KEY missing (graceful error)

---

## 🔍 Server Logs to Watch

During extraction, you should see logs like:

```
[Extraction] Downloading file from: https://...
[Extraction] Downloaded 245823 bytes, MIME: image/jpeg
[Extraction] Starting extraction...
[Extraction] Attempting Gemini extraction...
[Routing] All confidence checks passed → auto_approved
[Extraction] Extraction complete (source: gemini)
```

Or on fallback:

```
[Extraction] Gemini error: ..., falling back to Tesseract...
[Extraction] Starting Tesseract fallback...
[Tesseract] Started OCR extraction...
[Tesseract] Progress: 25%
[Tesseract] Progress: 50%
...
[Routing] plotArea confidence (0.40) below threshold (0.75) → needs_review
```

---

## 🛠️ Troubleshooting

| Issue                                  | Cause                          | Fix                                                        |
| -------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `error: GEMINI_API_KEY not configured` | Missing env var                | Set GEMINI_API_KEY in .env                                 |
| `extraction_failed` status             | Network error downloading file | Check Supabase signed URL validity (refresh if > 1 hr old) |
| `extractedFields` empty                | Tesseract only (fallback)      | Check Gemini API key validity                              |
| `needs_review` for clear documents     | Threshold too high             | Lower CONFIDENCE_THRESHOLD in .env                         |
| Tesseract takes 30+ seconds            | First run (WASM module load)   | Subsequent runs faster; consider caching                   |
| `duplicate_detected` but unique doc    | Database has old test data     | Clear test records from MongoDB                            |
| 401 on extraction                      | Auth token invalid             | Refresh token with login                                   |

---

## 📊 Performance Expectations

| Operation            | Time     | Notes                                |
| -------------------- | -------- | ------------------------------------ |
| Gemini extraction    | 2-5 sec  | Depends on image size + API response |
| Tesseract extraction | 5-15 sec | First run slower (WASM load)         |
| Duplicate check      | <100ms   | Single MongoDB query                 |
| Area sum check       | <200ms   | MongoDB aggregation                  |
| Total /extract       | 3-20 sec | Gemini + validation + DB save        |

---

## 🎯 Next Steps After Testing

1. **Pass all verification checks** ✓
2. **Adjust confidence threshold** - Based on your domain expertise
3. **Extend extraction fields** - If you need more than the 6 fields
4. **Build reviewer UI** (Sprint 3) - Interface to review "needs_review" documents
5. **Batch processing** (Sprint 4+) - Process multiple documents in parallel

---

## 🔗 Quick Reference: Endpoints

| Method | Path                         | Auth         | Description                                 |
| ------ | ---------------------------- | ------------ | ------------------------------------------- |
| POST   | `/api/documents/upload`      | Bearer token | Upload document (Sprint 1)                  |
| GET    | `/api/documents/:id/status`  | Bearer token | Get document status + extracted fields      |
| POST   | `/api/documents/:id/extract` | Bearer token | **NEW:** Trigger AI extraction + validation |

---

## 📚 Documentation

- **SPRINT2_IMPLEMENTATION.md** - Full architecture, design decisions, examples
- **SPRINT1_IMPLEMENTATION.md** - Auth, upload pipeline (Sprint 1)
- **This file** - Setup & testing guide
ok for that change