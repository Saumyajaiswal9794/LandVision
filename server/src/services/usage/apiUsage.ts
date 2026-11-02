import { ApiUsage } from '../../models/ApiUsage';

/**
 * Gemini 2.5 Flash list prices (USD per 1M tokens), used for the admin
 * usage/cost dashboard. Update these if pricing changes.
 */
export const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    inputPerMillion: 0.3,
    outputPerMillion: 2.5,
  },
} as const;

/**
 * Persists one AI-usage row for the admin usage dashboard. Never throws —
 * usage tracking is a side-effect and must not break extraction.
 */
export async function recordGeminiUsage(params: {
  userId?: string | null;
  documentId?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  operation?: string;
}): Promise<void> {
  try {
    const pricing = GEMINI_PRICING['gemini-2.5-flash'];
    const prompt = params.promptTokens ?? 0;
    const completion = params.completionTokens ?? 0;
    const cost =
      (prompt / 1_000_000) * pricing.inputPerMillion +
      (completion / 1_000_000) * pricing.outputPerMillion;

    await ApiUsage.create({
      userId: params.userId ?? null,
      documentId: params.documentId ?? null,
      modelName: 'gemini-2.5-flash',
      promptTokens: params.promptTokens ?? null,
      completionTokens: params.completionTokens ?? null,
      totalTokens: prompt + completion || null,
      cost,
      operation: params.operation || 'extraction',
    });
  } catch (err) {
    console.warn('[ApiUsage] Failed to record usage:', err);
  }
}
