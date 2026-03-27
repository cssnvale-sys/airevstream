import { Queue, Worker, QueueEvents, Job, type ConnectionOptions } from 'bullmq';

// ─── Job Data Types ───

export interface ContentGenerateJob {
  contentId: string;
  channelId: string;
  contentType: string;
  prompt?: string;
  /** Production directives from cinema pipeline (shot count, pacing, etc.) */
  directives?: Record<string, unknown>;
  /** Target duration in seconds (cinema pipeline) */
  duration?: number;
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
  tenantId: string;
  platform?: string;
  keywords?: string[];
}

export interface ResearchTopicsJob {
  tenantId: string;
  niche: string;
  count?: number;
}

export interface ResearchKnowledgeUpdateJob {
  tenantId: string;
  domain: string;
  sourceUrl?: string;
}

export interface ResearchPopulateKnowledgeJob {
  tenantId: string;
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

export interface ExportVariant {
  label: string;
  width: number;
  height: number;
  fps: number;
  aspect: string;
  codec: 'h264' | 'prores';
}

export interface ProductionRenderVideoJob {
  contentId: string;
  storyboardId: string;
  channelId: string;
  qualityPreset?: 'draft' | 'standard' | 'cinema';
  /** If set, renders this specific variant instead of the default */
  exportVariant?: ExportVariant;
  /** If true, automatically queue variant renders after primary render */
  autoVariants?: boolean;
  /** Variant configurations to auto-render */
  variantConfigs?: ExportVariant[];
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
  /** Production directives from cinema pipeline (shot count, pacing, etc.) */
  directives?: Record<string, unknown>;
  /** Resolved preset overrides (visual, camera, audio settings) */
  overrides?: Record<string, unknown>;
  /** Quality preset tier (used by preview pipeline to signal draft mode) */
  qualityPreset?: 'draft' | 'standard' | 'cinema';
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
  /** Resolved preset overrides (visual, camera, audio settings) */
  overrides?: Record<string, unknown>;
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

export interface ContentViralScoreJob {
  contentId: string;
  storyboardId: string;
  platform?: string;
}

export interface ProductionRepairShotJob {
  shotId: string;
  storyboardId: string;
  contentId: string;
  channelId: string;
  repairType: 'inpaint' | 'face-fix' | 'lighting-harmonize';
  maskImageKey?: string;
  lightingRefKey?: string;
  repairPrompt?: string;
  denoise?: number;
}

// ─── Asset Generation Job Types ───

export interface ProductionAssetGenerateJob {
  tenantId: string;
  /** 'avatar' | 'scenery' | 'branding' */
  assetType: string;
  /** Source model ID (Avatar.id, SceneryAsset.id, or BrandingPackage.id) */
  sourceModelId: string;
  /** ComfyUI workflow type (e.g. 'avatar', 'scenery', 'thumbnail') */
  workflowType: string;
  /** Generation prompt */
  prompt: string;
  /** Additional generation params */
  params: Record<string, unknown>;
  /** For avatars: which image slot to fill */
  slot?: string;
  /** Channel ID (for branding) */
  channelId?: string;
}

// ─── Experiment Job Types ───

export interface ExperimentEvaluateJob {
  experimentId: string;
  tenantId: string;
}

export interface ExperimentRecordMetricJob {
  experimentId: string;
  variantId: string;
  metric: string;
  value: number;
  tenantId: string;
}

// ─── Series Job Types ───

export interface SeriesPlaylistSyncJob {
  seriesId: string;
  youtubePlaylistId: string;
  tenantId: string;
}

// ─── Lifecycle Job Types ───

export interface LifecycleInitJob {
  emailAccountId: string;
  tenantId: string;
  targetPlatforms: string[];
  avatarId?: string;
  autoSeasoning?: boolean;
  autoPosting?: boolean;
}

export interface LifecycleDiscoverJob {
  lifecycleId: string;
  emailAccountId: string;
  platform: string;
  tenantId: string;
}

export interface LifecyclePlanJob {
  lifecycleId: string;
  emailAccountId: string;
  tenantId: string;
}

export interface LifecycleSignupJob {
  lifecycleId: string;
  emailAccountId: string;
  platform: string;
  tenantId: string;
  avatarId?: string;
}

export interface LifecycleSetProfileJob {
  lifecycleId: string;
  socialAccountId: string;
  platform: string;
  avatarId?: string;
  tenantId: string;
}

export interface LifecycleEnrollJob {
  lifecycleId: string;
  emailAccountId: string;
  tenantId: string;
  socialAccountIds: string[];
  platforms: string[];
}

// ─── Seasoning Job Types ───

export interface SeasoningEnrollJob {
  cohortId: string;
  emailAccountId: string;
  platform: string;
  tenantId: string;
}

export interface SeasoningSignupJob {
  enrollmentId: string;
  emailAccountId: string;
  platform: string;
  tenantId: string;
}

export interface SeasoningWarmJob {
  enrollmentId: string;
  socialAccountId: string;
  platform: string;
  phase: string;
  tenantId: string;
}

export interface SeasoningCheckJob {
  _trigger?: 'repeatable';
}

export interface SeasoningGraduateJob {
  enrollmentId: string;
  socialAccountId: string;
}

// ─── Queue Name → Job Data Mapping ───

export interface QueueJobMap {
  content: ContentGenerateJob | ContentPublishJob | ContentApproveJob | ContentFinalReviewJob | ContentViralScoreJob;
  account: AccountCreateJob | AccountSyncJob | AccountHealthCheckJob | AccountWarmJob;
  posting: PostingScheduleJob | PostingPublishJob | SeriesPlaylistSyncJob;
  research: ResearchTrendsJob | ResearchTopicsJob | ResearchKnowledgeUpdateJob | ResearchPopulateKnowledgeJob;
  maintenance: MaintenanceCleanupJob | MaintenanceBackupJob | MaintenanceMetricsJob;
  production: ProductionRenderVideoJob | ProductionGenerateImageJob | ProductionGenerateAudioJob | ProductionStoryboardJob | ProductionGenerateShotsJob | ProductionQCGateJob | ProductionMixAudioJob | ProductionRepairShotJob | ProductionAssetGenerateJob;
  seasoning: SeasoningEnrollJob | SeasoningSignupJob | SeasoningWarmJob | SeasoningCheckJob | SeasoningGraduateJob;
  experiment: ExperimentEvaluateJob | ExperimentRecordMetricJob;
  lifecycle: LifecycleInitJob | LifecycleDiscoverJob | LifecyclePlanJob | LifecycleSignupJob | LifecycleSetProfileJob | LifecycleEnrollJob;
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
export { getFlowProducer, startContentPipeline, startCinemaPipeline, startPreviewPipeline, startSeasoningPipeline, startAccountLifecyclePipeline, closeFlowProducer } from './flows.js';
export type { ContentPipelineParams, CinemaPipelineParams, PreviewPipelineParams, SeasoningPipelineParams, AccountLifecyclePipelineParams } from './flows.js';
