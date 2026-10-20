"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateConfidenceRoute = exports.REQUIRED_FIELDS = void 0;
exports.routeRowByConfidence = routeRowByConfidence;
exports.routeByConfidence = routeByConfidence;
exports.routeByConfidenceLegacy = routeByConfidenceLegacy;
const env_1 = require("../../config/env");
// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
/** The 6 required fields whose confidence is checked for routing. */
exports.REQUIRED_FIELDS = [
    'ownerName',
    'khasraNumber',
    'plotArea',
    'village',
    'district',
    'landClass',
];
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Sprint C — per-row confidence routing.
 *
 * Computes a row-level confidence = MIN of the 6 required fields'
 * confidence values (0 if any required field is missing or null).
 *
 * Routing decision:
 *   - If any ValidationFlag has severity 'error'  → needs_review
 *   - If rowConfidence < env.CONFIDENCE_THRESHOLD  → needs_review
 *   - If any required field is null/empty         → needs_review
 *   - Otherwise                                     → auto_approved
 *
 * Returns a structured `RoutingResult` with the `lowConfidenceFields`
 * list (names of fields below the threshold) so the UI can highlight
 * only those fields in amber — confident fields are dimmed/collapsed.
 *
 * `validationFlags` here is the new structured shape `ValidationFlag[]`.
 * The legacy `routeByConfidence()` (string[] flags) is preserved as a
 * thin shim below.
 */
function routeRowByConfidence(row, validationFlags, confidenceThreshold = env_1.env.CONFIDENCE_THRESHOLD) {
    // If any structured flag has severity 'error', the row goes to review.
    const hasErrorFlag = validationFlags.some((f) => f.severity === 'error');
    if (hasErrorFlag) {
        const lowConfidenceFields = computeLowConfidenceFields(row, confidenceThreshold);
        const rowConfidence = computeRowConfidence(row);
        console.log(`[Routing] Row has ${validationFlags.filter((f) => f.severity === 'error').length} ` +
            `error-severity validation flag(s) → needs_review`);
        return {
            status: 'needs_review',
            lowConfidenceFields,
            rowConfidence,
        };
    }
    // Walk the 6 required fields.
    const lowConfidenceFields = [];
    let minConfidence = 1.0;
    for (const fieldName of exports.REQUIRED_FIELDS) {
        const field = row[fieldName];
        if (!field) {
            lowConfidenceFields.push(fieldName);
            minConfidence = 0;
            console.log(`[Routing] ${fieldName} missing → needs_review`);
            continue;
        }
        if (field.value === null || field.value === undefined || field.value === '') {
            lowConfidenceFields.push(fieldName);
            minConfidence = 0;
            console.log(`[Routing] ${fieldName} is null/empty (not extracted) → needs_review`);
            continue;
        }
        if (field.confidence < confidenceThreshold) {
            lowConfidenceFields.push(fieldName);
            console.log(`[Routing] ${fieldName} confidence (${field.confidence.toFixed(2)}) ` +
                `below threshold (${confidenceThreshold}) → needs_review`);
        }
        if (field.confidence < minConfidence) {
            minConfidence = field.confidence;
        }
    }
    if (lowConfidenceFields.length > 0) {
        return {
            status: 'needs_review',
            lowConfidenceFields,
            rowConfidence: minConfidence,
        };
    }
    console.log(`[Routing] All confidence checks passed (row conf ${minConfidence.toFixed(2)}) → auto_approved`);
    return {
        status: 'auto_approved',
        lowConfidenceFields: [],
        rowConfidence: minConfidence,
    };
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Returns the names of required fields below the threshold. */
function computeLowConfidenceFields(row, confidenceThreshold) {
    const out = [];
    for (const fieldName of exports.REQUIRED_FIELDS) {
        const field = row[fieldName];
        if (!field) {
            out.push(fieldName);
            continue;
        }
        if (field.value === null ||
            field.value === undefined ||
            field.value === '') {
            out.push(fieldName);
            continue;
        }
        if (field.confidence < confidenceThreshold) {
            out.push(fieldName);
        }
    }
    return out;
}
/** Row-level confidence = MIN of the 6 required fields' confidence. */
function computeRowConfidence(row) {
    let min = 1.0;
    for (const fieldName of exports.REQUIRED_FIELDS) {
        const field = row[fieldName];
        if (!field)
            return 0;
        if (field.confidence < min)
            min = field.confidence;
    }
    return min;
}
// ---------------------------------------------------------------------------
// Legacy compatibility shims
// ---------------------------------------------------------------------------
/**
 * @deprecated Old single-row API. New code should use `routeRowByConfidence`
 * which returns the structured `RoutingResult` with `lowConfidenceFields`.
 *
 * This shim accepts the legacy `string[]` flag list (no severity info)
 * and treats ANY flag as a reason to route to needs_review.
 */
function routeByConfidence(row, validationFlags, confidenceThreshold = env_1.env.CONFIDENCE_THRESHOLD) {
    // Coerce string[] → ValidationFlag[] (each becomes severity 'error').
    const structured = Array.isArray(validationFlags)
        ? validationFlags.map((f) => typeof f === 'string'
            ? { rule: f, severity: 'error', message: f }
            : f)
        : [];
    return routeRowByConfidence(row, structured, confidenceThreshold).status;
}
/**
 * @deprecated Old single-row API. Kept for callers that haven't migrated
 * to the multi-row shape. Wraps `routeByConfidence` on a synthesized row.
 */
function routeByConfidenceLegacy(extractedFields, validationFlags, confidenceThreshold = env_1.env.CONFIDENCE_THRESHOLD) {
    const row = {
        ownerName: extractedFields.ownerName ?? { value: null, confidence: 0 },
        khasraNumber: extractedFields.khasraNumber ?? { value: null, confidence: 0 },
        plotArea: extractedFields.plotArea ?? { value: null, confidence: 0 },
        village: extractedFields.village ?? { value: null, confidence: 0 },
        district: extractedFields.district ?? { value: null, confidence: 0 },
        landClass: extractedFields.landClass ?? { value: null, confidence: 0 },
    };
    return routeByConfidence(row, validationFlags, confidenceThreshold);
}
/**
 * Legacy async function kept for backward compatibility with old code paths
 * that still call `evaluateConfidenceRoute` on a record.
 */
const evaluateConfidenceRoute = async (record) => {
    console.log(`[Validation Service] Rating confidence: OCR=${record.confidenceScore?.ocrOverall}, LLM=${record.confidenceScore?.llmOverall}`);
    const CONFIDENCE_THRESHOLD = 0.85;
    return record.confidenceScore?.combined < CONFIDENCE_THRESHOLD;
};
exports.evaluateConfidenceRoute = evaluateConfidenceRoute;
exports.default = {
    routeRowByConfidence,
    routeByConfidence,
    routeByConfidenceLegacy,
    evaluateConfidenceRoute: exports.evaluateConfidenceRoute,
    REQUIRED_FIELDS: exports.REQUIRED_FIELDS,
};
