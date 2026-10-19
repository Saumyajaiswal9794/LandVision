"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = uploadDocument;
exports.regenerateSignedUrl = regenerateSignedUrl;
exports.deleteDocument = deleteDocument;
const supabaseAdmin_1 = __importDefault(require("../../config/supabaseAdmin"));
const BUCKET_NAME = 'land-records';
const SIGNED_URL_EXPIRATION = 3600; // 1 hour in seconds
/**
 * Uploads a document to Supabase Storage.
 * @param fileBuffer - The file content as a Buffer
 * @param filename - The filename to store as
 * @returns Object containing the signed URL (valid for 1 hour) and the raw storage path
 */
async function uploadDocument(fileBuffer, filename) {
    try {
        // Generate a unique path to avoid overwrites
        const timestamp = Date.now();
        const filePath = `documents/${timestamp}-${filename}`;
        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin_1.default.storage
            .from(BUCKET_NAME)
            .upload(filePath, fileBuffer, {
            contentType: 'application/octet-stream',
            upsert: false,
        });
        if (error) {
            throw new Error(`Storage upload failed: ${error.message}`);
        }
        // Generate signed URL (works for both public and private buckets)
        const { data: signedData, error: signedError } = await supabaseAdmin_1.default.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, SIGNED_URL_EXPIRATION);
        if (signedError) {
            throw new Error(`Failed to generate signed URL: ${signedError.message}`);
        }
        return { signedUrl: signedData.signedUrl, storagePath: filePath };
    }
    catch (error) {
        console.error('uploadDocument error:', error);
        throw error;
    }
}
/**
 * Regenerates a fresh signed URL for an existing file in Supabase Storage.
 * Use this when the originally generated signed URL has expired (after ~1 hour).
 * @param filePath - The raw Supabase Storage object path (e.g. "documents/1234-file.jpg")
 * @returns A fresh signed URL valid for another hour
 */
async function regenerateSignedUrl(filePath) {
    try {
        const { data, error } = await supabaseAdmin_1.default.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, SIGNED_URL_EXPIRATION);
        if (error) {
            throw new Error(`Failed to regenerate signed URL for "${filePath}": ${error.message}`);
        }
        return data.signedUrl;
    }
    catch (error) {
        console.error('regenerateSignedUrl error:', error);
        throw error;
    }
}
/**
 * Deletes a document from Supabase Storage (for cleanup on failure)
 * @param filePath - The storage object path to delete
 */
async function deleteDocument(filePath) {
    try {
        const { error } = await supabaseAdmin_1.default.storage
            .from(BUCKET_NAME)
            .remove([filePath]);
        if (error) {
            console.warn(`Warning: Failed to delete orphaned file ${filePath}: ${error.message}`);
        }
    }
    catch (error) {
        console.warn('deleteDocument error:', error);
    }
}
exports.default = {
    uploadDocument,
    regenerateSignedUrl,
};
