// server/src/queues/extractionQueue.ts
//
// Background extraction queue. When REDIS_URL is configured this runs on
// BullMQ; otherwise it degrades to a bounded-concurrency in-memory queue so
// local development and single-instance demo deploys keep working.
//
// The worker executes the FULL extraction pipeline (download → Gemini /
// Tesseract → per-row validation → persist child records → status routing).
// See services/extraction/extractionPipeline.ts.
import { env } from '../config/env';
import type { Job } from 'bullmq';
import { runExtractionForDocument, ExtractionPipelineResult } from '../services/extraction/extractionPipeline';

export interface ExtractionJobPayload {
  /** The uploaded document (parent LandRecord) id to process. */
  id: string;
  /** Supabase user id that requested the extraction (for attribution). */
  requestedBy?: string | null;
}

let queueAddJob: (payload: ExtractionJobPayload) => Promise<void>;

if (env.REDIS_URL) {
  // Lazy-require BullMQ only when Redis is actually configured, so the
  // dependency isn't loaded in the default in-memory mode.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Queue, Worker } = require('bullmq');
  const connection = { url: env.REDIS_URL };
  const queue = new Queue('extraction', { connection });

  const worker = new Worker(
    'extraction',
    async (job: Job) => {
      await runExtractionForDocument(job.data.id, job.data.requestedBy ?? null);
    },
    { connection, concurrency: 2 },
  );
  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[ExtractionQueue] Job ${job?.id} failed:`, err);
  });

  queueAddJob = async (payload) => {
    await queue.add('extract', payload);
  };
} else {
  // In-memory queue with bounded concurrency of 2.
  const pending: ExtractionJobPayload[] = [];
  let active = 0;
  const maxConcurrency = 2;
  const runNext = async () => {
    while (active < maxConcurrency && pending.length) {
      const job = pending.shift();
      if (!job) break;
      active++;
      // fire-and-forget — the pipeline never throws, but we log defensively.
      runExtractionForDocument(job.id, job.requestedBy ?? null)
        .then((result: ExtractionPipelineResult) => {
          if (result.status === 'extraction_failed') {
            console.warn(
              `[ExtractionQueue] Job for ${result.documentId} finished with extraction_failed: ${result.error}`,
            );
          } else {
            console.log(
              `[ExtractionQueue] Job for ${result.documentId} finished: ${result.status} (${result.rowsExtracted} row(s)).`,
            );
          }
        })
        .catch((e) => console.error('[ExtractionQueue] job error', e))
        .finally(() => {
          active--;
          runNext();
        });
    }
  };
  queueAddJob = async (payload) => {
    pending.push(payload);
    runNext();
  };
}

export const extractionQueue = {
  addJob: queueAddJob,
};
