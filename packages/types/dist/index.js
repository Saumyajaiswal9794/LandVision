"use strict";
// Core types for LandVision project
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExtractedField = toExtractedField;
exports.migrateExtractedFields = migrateExtractedFields;
// ---------------------------------------------------------------------------
// Migration / adapter helpers.
// ---------------------------------------------------------------------------
/**
 * Adapts a "flat" seed-style extracted-field object (`{ value, confidence,
 * source? }`) into the new `ExtractedField<string | null>` shape.  The old
 * shape is already a structural subset, so the function merely narrows the
 * `source` union and adds the missing optional keys with `undefined`.
 *
 * Use this when loading legacy / seeded records into code that expects the
 * full `ExtractedField<T>` type.
 */
function toExtractedField(flat) {
    return {
        value: flat.value,
        confidence: flat.confidence,
        source: flat.source ?? undefined,
        bbox: undefined,
        rawText: undefined,
    };
}
/**
 * Adapts an entire `extractedFields` object from the legacy flat shape to the
 * new `ExtractedField<string | null>` shape, field-by-field.
 */
function migrateExtractedFields(flat) {
    const out = {};
    for (const [key, val] of Object.entries(flat)) {
        out[key] = toExtractedField(val);
    }
    return out;
}
