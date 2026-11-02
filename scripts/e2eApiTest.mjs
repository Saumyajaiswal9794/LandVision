// scripts/e2eApiTest.mjs — end-to-end API smoke test against a locally
// running server (http://localhost:4000) using REAL Supabase accounts.
//
// Covers: login (officer/reviewer/admin) → profile sync → upload → extract
// (background queue) → status polling → document detail w/ rows → records
// API → field PATCH → review actions → GIS → notifications → admin (users,
// audit, usage) → RBAC negative checks.
const API = process.env.API_URL || 'http://localhost:4000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const results = [];
let failures = 0;

function check(name, cond, extra = '') {
  const ok = !!cond;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function api(token, method, path, body, isForm = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// A valid 200x60 PNG (white background, black bands) generated here with
// zlib so the upload exercises a real, decodable image through the pipeline.
import zlib from 'zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function tinyPng() {
  const W = 200, H = 60;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour RGB
  // raw scanlines with filter byte 0 + black/white bands
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < W; x++) {
      const v = x % 20 < 10 ? 0 : 255;
      const p = rowStart + 1 + x * 3;
      raw[p] = v; raw[p + 1] = v; raw[p + 2] = v;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  // --- Auth ---------------------------------------------------------------
  const officerToken = await login('officer@landvision.test', 'Test1234!');
  const reviewerToken = await login('reviewer@landvision.test', 'Test1234!');
  const adminToken = await login('admin@landvision.test', 'Test1234!');
  check('login: officer + reviewer + admin', officerToken && reviewerToken && adminToken);

  // --- Profile / sync -----------------------------------------------------
  const prof = await api(officerToken, 'GET', '/api/auth/profile');
  check('GET /api/auth/profile', prof.status === 200 && prof.json?.user?.role === 'officer', `role=${prof.json?.user?.role}`);

  // --- Upload -------------------------------------------------------------
  const form = new FormData();
  form.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'e2e-scan.png');
  form.append('village', 'Rampur');
  form.append('district', 'Hamirpur');
  const up = await api(officerToken, 'POST', '/api/documents/upload', form, true);
  check('POST /api/documents/upload (201)', up.status === 201 && up.json?.recordId, JSON.stringify(up.json));
  const recordId = up.json?.recordId;

  // Upload as reviewer → must be 403 (officer-only)
  const form2 = new FormData();
  form2.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'x.png');
  form2.append('village', 'Rampur');
  form2.append('district', 'Hamirpur');
  const upReviewer = await api(reviewerToken, 'POST', '/api/documents/upload', form2, true);
  check('upload by reviewer → 403', upReviewer.status === 403, `got ${upReviewer.status}`);

  // --- Extraction (background queue) --------------------------------------
  const ex = await api(officerToken, 'POST', `/api/documents/${recordId}/extract`);
  check('POST /:id/extract (202 accepted)', ex.status === 202, `status=${ex.status} body=${JSON.stringify(ex.json)}`);
  const ex2 = await api(officerToken, 'POST', `/api/documents/${recordId}/extract`);
  check('double extract → 400', ex2.status === 400, `got ${ex2.status}`);

  // Poll for terminal status (Tesseract fallback can take ~10-60s on first run
  // while it downloads traineddata).
  let finalStatus = null;
  let detail = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = await api(officerToken, 'GET', `/api/documents/${recordId}/status`);
    finalStatus = st.json?.status;
    if (finalStatus && !['uploading', 'uploaded', 'extracting'].includes(finalStatus)) break;
  }
  check('extraction reaches terminal status', ['extracted', 'needs_review', 'auto_approved', 'extraction_failed'].includes(finalStatus), `final=${finalStatus}`);

  detail = await api(officerToken, 'GET', `/api/documents/${recordId}`);
  check('GET /api/documents/:id includes rows[]', detail.status === 200 && Array.isArray(detail.json?.rows), `rows=${detail.json?.rows?.length}`);
  if (detail.json?.rows?.length) {
    const row = detail.json.rows[0];
    check('child row has validationResults + lowConfidenceFields',
      Array.isArray(row.validationResults) && Array.isArray(row.lowConfidenceFields));
  }

  // --- Records API ----------------------------------------------------------
  const recs = await api(officerToken, 'GET', `/api/records?documentId=${recordId}`);
  check('GET /api/records?documentId', recs.status === 200 && recs.json?.records?.length >= 1, `total=${recs.json?.total}`);
  const rowId = recs.json?.records?.[0]?.recordId;
  if (rowId) {
    const patch = await api(reviewerToken, 'PATCH', `/api/records/${rowId}`, { fieldName: 'ownerName', value: 'E2E Corrected Owner' });
    check('PATCH /api/records/:id (reviewer)', patch.status === 200 && patch.json?.extractedFields?.ownerName?.source === 'human_corrected', `source=${patch.json?.extractedFields?.ownerName?.source}`);
  }

  // --- Review flow ----------------------------------------------------------
  if (finalStatus === 'needs_review' && rowId) {
    const rv = await api(reviewerToken, 'PATCH', `/api/documents/${recordId}/review`, { action: 'approve', rowId });
    check('reviewer approves row', rv.status === 200, JSON.stringify(rv.json).slice(0, 120));
  }
  const rvOfficer = await api(officerToken, 'PATCH', `/api/documents/${recordId}/review`, { action: 'approve' });
  check('officer review attempt → 403', rvOfficer.status === 403, `got ${rvOfficer.status}`);

  // --- GIS -------------------------------------------------------------------
  const gis = await api(officerToken, 'GET', '/api/gis/village/Rampur');
  check('GET /api/gis/village/Rampur returns FeatureCollection', gis.status === 200 && gis.json?.type === 'FeatureCollection' && gis.json?.features?.length > 0, `features=${gis.json?.features?.length}`);

  // --- Notifications -----------------------------------------------------------
  const notif = await api(officerToken, 'GET', '/api/notifications');
  check('GET /api/notifications', notif.status === 200 && Array.isArray(notif.json?.notifications), `count=${notif.json?.notifications?.length}`);

  // --- Admin -----------------------------------------------------------------
  const users = await api(adminToken, 'GET', '/api/admin/users');
  check('admin lists users', users.status === 200 && users.json?.users?.length >= 3, `count=${users.json?.users?.length}`);
  const usersAsOfficer = await api(officerToken, 'GET', '/api/admin/users');
  check('officer blocked from admin users (403)', usersAsOfficer.status === 403, `got ${usersAsOfficer.status}`);

  const audit = await api(adminToken, 'GET', '/api/audit');
  check('admin audit logs exist', audit.status === 200 && audit.json?.logs?.length > 0, `logs=${audit.json?.logs?.length}`);
  if (audit.json?.logs?.length) {
    const actions = audit.json.logs.map((l) => l.action);
    check('audit captured upload/extract actions', actions.includes('document.upload') && actions.includes('document.extract'), actions.slice(0, 3).join(','));
  }

  const usage = await api(adminToken, 'GET', '/api/admin/usage');
  check('admin usage endpoint', usage.status === 200 && Array.isArray(usage.json?.usage));

  // Review-queue endpoint (reviewer role)
  const rq = await api(reviewerToken, 'GET', '/api/review-queue');
  check('GET /api/review-queue (reviewer)', rq.status === 200 && Array.isArray(rq.json?.queue), `queue=${rq.json?.queue?.length}`);

  // Officer cannot access review queue
  const rqOfficer = await api(officerToken, 'GET', '/api/review-queue');
  check('officer blocked from review-queue (403)', rqOfficer.status === 403, `got ${rqOfficer.status}`);

  console.log(results.join('\n'));
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('E2E fatal:', e);
  console.log(results.join('\n'));
  process.exit(1);
});
