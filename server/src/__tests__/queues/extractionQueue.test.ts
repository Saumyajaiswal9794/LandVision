// server/src/__tests__/queues/extractionQueue.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the extraction pipeline — the queue is a thin dispatcher around it.
const runExtractionForDocument = vi.fn(
  async (_id: string, _requestedBy?: string | null) => ({
    documentId: _id,
    status: 'extracted' as const,
    extractionSource: 'tesseract' as const,
    rowsExtracted: 1,
  }),
);

vi.mock('../../services/extraction/extractionPipeline.js', () => ({
  runExtractionForDocument: (...args: [string, string | null | undefined]) =>
    runExtractionForDocument(...args),
}));

describe('extractionQueue (in-memory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates each queued job to the extraction pipeline', async () => {
    const { extractionQueue } = await import('../../queues/extractionQueue.js');

    await extractionQueue.addJob({ id: 'doc123', requestedBy: 'user-1' });
    // Wait a tick for async processing (in-memory runs fire-and-forget)
    await new Promise((r) => setTimeout(r, 20));

    expect(runExtractionForDocument).toHaveBeenCalledWith('doc123', 'user-1');
  });

  it('processes multiple queued jobs', async () => {
    const { extractionQueue } = await import('../../queues/extractionQueue.js');

    await extractionQueue.addJob({ id: 'a' });
    await extractionQueue.addJob({ id: 'b' });
    await new Promise((r) => setTimeout(r, 20));

    const ids = runExtractionForDocument.mock.calls.map((c) => c[0]);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});
