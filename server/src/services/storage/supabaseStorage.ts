import supabaseAdmin from '../../config/supabaseAdmin';

const BUCKET_NAME = 'land-documents';
const SIGNED_URL_EXPIRATION = 3600; // 1 hour in seconds

/**
 * Uploads a document to Supabase Storage.
 * @param fileBuffer - The file content as a Buffer
 * @param filename - The filename to store as
 * @returns Object containing the signed URL (valid for 1 hour) and the raw storage path
 */
export async function uploadDocument(
  fileBuffer: Buffer,
  filename: string,
): Promise<{ signedUrl: string; storagePath: string }> {
  try {
    // Generate a unique path to avoid overwrites
    const timestamp = Date.now();
    const filePath = `documents/${timestamp}-${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Generate signed URL (works for both public and private buckets)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRATION);

    if (signedError) {
      throw new Error(`Failed to generate signed URL: ${signedError.message}`);
    }

    return { signedUrl: signedData.signedUrl, storagePath: filePath };
  } catch (error) {
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
export async function regenerateSignedUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRATION);

    if (error) {
      throw new Error(`Failed to regenerate signed URL for "${filePath}": ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('regenerateSignedUrl error:', error);
    throw error;
  }
}

/**
 * Deletes a document from Supabase Storage (for cleanup on failure)
 * @param filePath - The storage object path to delete
 */
export async function deleteDocument(filePath: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.warn(`Warning: Failed to delete orphaned file ${filePath}: ${error.message}`);
    }
  } catch (error) {
    console.warn('deleteDocument error:', error);
  }
}

export default {
  uploadDocument,
  regenerateSignedUrl,
};
