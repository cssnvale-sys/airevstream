import { Queue, Worker, QueueEvents, Job, type ConnectionOptions } from 'bullmq';

// ─── Job Data Types ───

export interface ContentGenerateJob {
  contentId: string;
  userId: string;
  type: string;
  prompt?: string;
}

export interface ContentPublishJob {
  contentId: string;
  accountId: string;
  userId: string;
}

export interface AccountSyncJob {
  accountId: string;
  userId: string;
}

export interface AccountHealthCheckJob {
  accountId: string;
}

export interface ResearchTrendsJob {
  platform?: string;
  keywords?: string[];
}

export interface ResearchTopicsJob {
  niche: string;
  count?: number;
}

export interface MaintenanceCleanupJob {
  olderThanDays?: number;
}

export interface MaintenanceBackupJob {
  target: 'database' | 'storage' | 'all';
}

export interface ProductionRenderVideoJob {
  contentId: string;
  compositionId: string;
  props: Record<string, unknown>;
}

export interface ProductionGenerateImageJob {
  contentId: string;
  workflowId: string;
  params: Record<string, unknown>;
}

export interface ProductionGenerateAudioJob {
  contentId: string;
  text: string;
  voice?: string;
}

// ─── Queue Name → Job Data Mapping ───

export interface QueueJobMap {
  content: ContentGenerateJob | ContentPublishJob;
  account: AccountSyncJob | AccountHealthCheckJob;
  posting: ContentPublishJob;
  research: ResearchTrendsJob | ResearchTopicsJob;
  maintenance: MaintenanceCleanupJob | MaintenanceBackupJob;
  production: ProductionRenderVideoJob | ProductionGenerateImageJob | ProductionGenerateAudioJob;
}

export type QueueName = keyof QueueJobMap;

// ─── Connection ───

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

let connectionOpts: ConnectionOptions | null = null;

export function getConnectionOptions(url?: string): ConnectionOptions {
  if (!connectionOpts) {
    connectionOpts = parseRedisUrl(url ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
  }
  return connectionOpts;
}

export function resetConnection(): void {
  connectionOpts = null;
}

// ─── Queue Factory ───

const queues = new Map<string, Queue>();

export function getQueue<N extends QueueName>(name: N, redisUrl?: string): Queue<QueueJobMap[N]> {
  if (!queues.has(name)) {
    const connection = getConnectionOptions(redisUrl);
    queues.set(name, new Queue(name, { connection }));
  }
  return queues.get(name) as Queue<QueueJobMap[N]>;
}

/** Add a job to a queue */
export async function addJob<N extends QueueName>(
  queueName: N,
  jobName: string,
  data: QueueJobMap[N],
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  },
): Promise<Job<QueueJobMap[N]>> {
  const queue = getQueue(queueName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (queue as any).add(jobName, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
    ...options,
  }) as Promise<Job<QueueJobMap[N]>>;
}

// ─── Worker Factory ───

export function createWorker<N extends QueueName>(
  queueName: N,
  processor: (job: Job<QueueJobMap[N]>) => Promise<unknown>,
  options?: {
    concurrency?: number;
    limiter?: { max: number; duration: number };
    redisUrl?: string;
  },
): Worker<QueueJobMap[N]> {
  const connection = getConnectionOptions(options?.redisUrl);
  const worker = new Worker(queueName, processor as (job: Job) => Promise<unknown>, {
    connection,
    concurrency: options?.concurrency ?? 1,
    limiter: options?.limiter,
  });
  return worker as Worker<QueueJobMap[N]>;
}

// ─── Queue Events ───

export function getQueueEvents(queueName: QueueName, redisUrl?: string): QueueEvents {
  const connection = getConnectionOptions(redisUrl);
  return new QueueEvents(queueName, { connection });
}

// ─── Cleanup ───

export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closePromises);
  queues.clear();
  resetConnection();
}

export { Queue, Worker, QueueEvents, Job };
