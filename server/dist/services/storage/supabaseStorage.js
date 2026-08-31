"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = void 0;
/**
 * Uploads a scanned document file buffer to Supabase Storage bucket.
 * Bucket name is read from env.SUPABASE_STORAGE_BUCKET (default: 'land-records').
 */
const uploadDocument = async (fileBuffer, fileName, mimeType) => {
    // Placeholder: Real integration uses @supabase/supabase-js storage API:
    //   const { data, error } = await supabaseAdmin.storage
    //     .from(env.SUPABASE_STORAGE_BUCKET)
    //     .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
    console.log(`[Storage Service] Uploading file: ${fileName} (${fileBuffer.length} bytes, type ${mimeType})`);
    const storagePath = `records/${Date.now()}_${fileName}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'land-records';
    return {
        documentId: 'doc_mock_987',
        fileName,
        supabaseStoragePath: storagePath,
        supabasePublicUrl: `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
    };
};
exports.uploadDocument = uploadDocument;
exports.default = exports.uploadDocument;
