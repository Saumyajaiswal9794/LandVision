// server/src/queues/extractionQueue.ts
import { env } from '../config/env';
import { Queue, Worker, Job } from 'bullmq';
import { LandRecord } from '../models/LandRecord';

// Simple processing function: for demo, just set status to 'extracted'
async function processExtractionJob(id: string): Promise<void> {
  const record = await LandRecord.findById(id);
  if (!record) {
    console.warn(`[ExtractionQueue] Record ${id} not found`);
    return;
  }
  // For now we simply mark as extracted; real extraction logic stays in controller.
  record.status = 'extracted';
  await record.save();
}

let queueAddJob: (payload: { id: string }) => Promise<void>;

if (process.env.REDIS_URL) {
  const connection = { url: process.env.REDIS_URL };
  const queue = new Queue('extraction', { connection });
  // Scheduler ensures delayed jobs work correctly

  const worker = new Worker(
    'extraction',
    async (job: Job) => {
      await processExtractionJob(job.data.id);
    },
    { connection, concurrency: 2 }
  );
  queueAddJob = async (payload) => {
    await queue.add('extract', payload);
  };
} else {
  // In‑memory queue with bounded concurrency of 2
  const pending: { id: string }[] = [];
  let active = 0;
  const maxConcurrency = 2;
  const runNext = async () => {
    while (active < maxConcurrency && pending.length) {
      const job = pending.shift();
      if (!job) break;
      active++;
      // fire‑and‑forget – errors are logged but do not stop queue
      processExtractionJob(job.id)
        .catch((e) => console.error('[ExtractionQueue] job error', e))
        .finally(() => {
          active--;
          runNext();
        });
    }
  };
  queueAddJob = async (payload) => {
    pending.push({ id: payload.id });
    runNext();
  };
}

export const extractionQueue = {
  addJob: queueAddJob,
};
