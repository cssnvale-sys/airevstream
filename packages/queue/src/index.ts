import { Queue, Worker, QueueEvents, Job, type ConnectionOptions } from 'bullmq';

// ─── Job Data Types ───

export interface ContentGenerateJob {
  contentId: string;
  channelId: string;
  contentType: string;
  prompt?: string;
}

export interface ContentPublishJob {
  contentId: string;
  channelId: string;
  scheduledPostId?: string;
}

export interface ContentApproveJob {
  contentId: string;
  action: 'approve' | 'reject' | 'regenerate';
  feedback?: string;
}

export interface AccountCreateJob {
  emailAccountId: string;
  platform: string;
}

export interface AccountSyncJob {
  socialAccountId: string;
}

export interface AccountHealthCheckJob {
  socialAccountId: string;
}

export interface AccountWarmJob {
  socialAccountId: string;
  durationMinutes?: number;
}

export interface ResearchTrendsJob {
  platform?: string;
  keywords?: string[];
}

export interface ResearchTopicsJob {
  niche: string;
  count?: number;
}

export interface ResearchKnowledgeUpdateJob {
  domain: string;
  sourceUrl?: string;
}

export interface ResearchPopulateKnowledgeJob {
  domain: string;
  urls?: string[];
  topic: string;
}

export interface MaintenanceCleanupJob {
  olderThanDays?: number;
}

export interface MaintenanceBackupJob {
  target: 'database' | 'storage' | 'all';
}

export interface MaintenanceMetricsJob {
  metricTypes?: string[];
}

export interface ProductionRenderVideoJob {
  contentId: string;
  storyboardId: string;
  channelId: string;
  qualityPreset?: 'draft' | 'standard' | 'cinema';
}

export interface ProductionGenerateImageJob {
  contentId?: string;
  channelId?: string;
  shotId?: string;
  workflowType: string;
  params: Record<string, unknown>;
}

export interface ProductionGenerateAudioJob {
  contentId: string;
  text: string;
  voice?: string;
  language?: string;
}

export interface ProductionStoryboardJob {
  contentId: string;
  channelId: string;
  scriptJson: Record<string, unknown>;
}

export interface PostingScheduleJob {
  contentId: string;
  channelId: string;
  scheduledAt: string;
  platform: string;
}

export interface PostingPublishJob {
  scheduledPostId: string;
  contentId: string;
  channelId: string;
  platform: string;
}

export interface ProductionGenerateShotsJob {
  storyboardId: string;
  shotIds: string[];
  cinemaBibleId: string;
  qualityPreset: string;
  contentId: string;
  channelId: string;
}

export interface ProductionQCGateJob {
  storyboardId: string;
  contentId: string;
}

export interface ProductionMixAudioJob {
  storyboardId: string;
  contentId: string;
}

export interface ContentFinalReviewJob {
  contentId: string;
  storyboardId: string;
  autoApprove?: boolean;
}

// ─── Queue Name → Job Data Mapping ───

export interface QueueJobMap {
  content: ContentGenerateJob | ContentPublishJob | ContentApproveJob | ContentFinalReviewJob;
  account: AccountCreateJob | AccountSyncJob | AccountHealthCheckJob | AccountWarmJob;
  posting: PostingScheduleJob | PostingPublishJob;
  research: ResearchTrendsJob | ResearchTopicsJob | ResearchKnowledgeUpdateJob | ResearchPopulateKnowledgeJob;
  maintenance: MaintenanceCleanupJob | MaintenanceBackupJob | MaintenanceMetricsJob;
  production: ProductionRenderVideoJob | ProductionGenerateImageJob | ProductionGenerateAudioJob | ProductionStoryboardJob | ProductionGenerateShotsJob | ProductionQCGateJob | ProductionMixAudioJob;
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

export { FlowProducer } from 'bullmq';
export { getFlowProducer, startContentPipeline, startCinemaPipeline, closeFlowProducer } from './flows.js';
export type { ContentPipelineParams, CinemaPipelineParams } from './flows.js';
