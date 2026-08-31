import { LandRecord } from '../../models/LandRecord';

/**
 * Detects duplicate land records with the same khasraNumber + village (+ optionally district).
 * Scoping by district prevents false positives when identical village names exist in different districts.
 *
 * @param khasraNumber - Plot/Khasra number extracted from the document
 * @param village - Village name (from the LandRecord document root, not extractedFields)
 * @param excludeRecordId - Record ID to exclude from check (the current record being extracted)
 * @param district - (Optional) District name to further narrow the duplicate search
 * @returns Array of validation flags (empty if no duplicates)
 */
export async function detectDuplicates(
  khasraNumber: string | null,
  village: string,
  excludeRecordId?: string,
  district?: string,
): Promise<string[]> {
  try {
    const flags: string[] = [];

    // Skip if khasraNumber is not available
    if (!khasraNumber) {
      console.log('[Validation] Skipping duplicate check: khasraNumber not extracted');
      return flags;
    }

    // Match on khasraNumber + village; narrow by district when provided
    const query: Record<string, any> = {
      'extractedFields.khasraNumber.value': khasraNumber,
      'extractedFields.village.value': { $regex: village, $options: 'i' },
    };

    // Optional district scope — prevents cross-district false positives
    if (district) {
      query['extractedFields.district.value'] = { $regex: district, $options: 'i' };
    }

    if (excludeRecordId) {
      query._id = { $ne: excludeRecordId };
    }

    const duplicates = await LandRecord.find(query).limit(1);

    if (duplicates.length > 0) {
      flags.push('duplicate_detected');
      console.warn(
        `[Validation] Duplicate detected: khasraNumber="${khasraNumber}", village="${village}"` +
          (district ? `, district="${district}"` : ''),
      );
    }

    return flags;
  } catch (error) {
    console.error('[Validation] Duplicate detection error:', error);
    return ['duplicate_check_error'];
  }
}

/**
 * Legacy function for backward compatibility (placeholder)
 */
export const detectDuplicateRecords = async (record: any): Promise<boolean> => {
  console.log(`[Validation Service] Checking duplicates for Khasra: ${record.khasraNumber}`);
  return false;
};

export default {
  detectDuplicates,
  detectDuplicateRecords,
};
