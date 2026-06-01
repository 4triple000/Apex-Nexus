/**
 * BullMQ job queue for async AI suggestion generation.
 *
 * If REDIS_URL is set, uses BullMQ + Redis for durable background jobs.
 * Otherwise falls back to immediate in-process execution.
 */

import { logger } from "../lib/logger.js";

export interface AiSuggestionJob {
  conversationId: number;
  platform: string;
  triggerMessageId?: number;
}

type JobHandler = (data: AiSuggestionJob) => Promise<void>;
let handler: JobHandler | null = null;

let bullQueue: import("bullmq").Queue<AiSuggestionJob> | null = null;
let bullWorker: import("bullmq").Worker<AiSuggestionJob> | null = null;

async function initBullMQ(jobHandler: JobHandler): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;

  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = { url: process.env.REDIS_URL };

    bullQueue = new Queue<AiSuggestionJob>("ai-suggestions", { connection });

    bullWorker = new Worker<AiSuggestionJob>(
      "ai-suggestions",
      async (job) => {
        await jobHandler(job.data);
      },
      { connection, concurrency: 3 }
    );

    bullWorker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, err }, "[queue] AI suggestion job failed");
    });

    logger.info("[queue] BullMQ worker started");
    return true;
  } catch (err) {
    logger.warn({ err }, "[queue] BullMQ unavailable — using sync execution");
    return false;
  }
}

/**
 * Initialize the job queue. Call once at server startup.
 */
export async function initJobQueue(jobHandler: JobHandler): Promise<void> {
  handler = jobHandler;
  await initBullMQ(jobHandler);
}

/**
 * Enqueue an AI suggestion generation job.
 * Falls back to immediate execution if BullMQ is not available.
 */
export async function enqueueAiSuggestionJob(data: AiSuggestionJob): Promise<void> {
  if (bullQueue) {
    await bullQueue.add("generate", data, {
      attempts: 2,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    });
    return;
  }

  if (handler) {
    setImmediate(() => {
      handler!(data).catch((err) => {
        logger.error({ err, data }, "[queue] Sync AI suggestion failed");
      });
    });
  }
}

/**
 * Gracefully shut down BullMQ worker.
 */
export async function closeJobQueue(): Promise<void> {
  await bullWorker?.close();
  await bullQueue?.close();
}
