// ─── Platform Types ───
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';

export const PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook'];

// ─── Email Account Types ───
export type EmailAccountStatus = 'active' | 'disabled' | 'flagged' | 'pending';
export type EmailAccountTier = 'tier1' | 'tier2' | 'tier3';

// ─── Social Account Types ───
export type SocialAccountStatus = 'active' | 'disabled' | 'flagged' | 'pending' | 'needs_signup';

// ─── Channel Types ───
export type ChannelStatus = 'active' | 'inactive' | 'disabled' | 'flagged';

// ─── Content Types ───
export type ContentType = 'text' | 'image' | 'video_short' | 'video_long' | 'voice' | 'thumbnail';

export type ContentPurpose = 'entertainment' | 'sales' | 'educational' | 'comedy' | 'affiliate';

export type ContentStatus =
  | 'draft'
  | 'generating'
  | 'generated'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'archived'
  | 'failed';

export type AffiliateMode = 'dedicated' | 'commercial_break' | 'none';

// ─── Storyboard Types ───
export type StoryboardStatus = 'draft' | 'approved' | 'in_production';
export type ShotStatus = 'pending' | 'generating' | 'generated' | 'approved' | 'failed';

// ─── Scheduled Post Types ───
export type ScheduledPostStatus = 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled';

// ─── AI Service Types ───
export type AiServiceType = 'text' | 'image' | 'video' | 'voice';
export type AiServiceStatus = 'active' | 'degraded' | 'down' | 'disabled';
export type AiServiceProvider =
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'comfyui'
  | 'elevenlabs'
  | 'runway'
  | 'kling'
  | 'pika'
  | 'luma'
  | 'heygen'
  | 'sora';

// ─── Approval & Trust Types ───
export type TrustDimensionType = 'content_type' | 'llm' | 'workflow' | 'tier' | 'niche' | 'platform';

// ─── Workflow & Job Types ───
export type WorkflowJobType =
  | 'content_production'
  | 'account_creation'
  | 'warming'
  | 'research'
  | 'posting'
  | 'maintenance'
  | 'health_check';

export type WorkflowJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

// ─── Alert Types ───
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'account_health' | 'system' | 'workflow' | 'cost' | 'content';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';

// ─── Knowledge Base Types ───
export type KnowledgeDomain =
  | 'platform_ops'
  | 'civitai'
  | 'remotion'
  | 'huggingface'
  | 'comfyui'
  | 'video_production';

// ─── Conversation Types ───
export type MessageRole = 'user' | 'assistant' | 'system';

// ─── Action Audit Types ───
export type ActionTier = 1 | 2 | 3 | 4;
export type ActionStatus = 'proposed' | 'confirmed' | 'executing' | 'completed' | 'failed' | 'rolled_back';

// ─── Beat Presets ───
export type BeatPreset =
  | 'INTIMATE'
  | 'TENSION'
  | 'POWER'
  | 'AWE'
  | 'PSYCHOLOGICAL'
  | 'EMOTIONAL'
  | 'MOMENTUM'
  | 'CALM';

export const BEAT_PRESETS: BeatPreset[] = [
  'INTIMATE', 'TENSION', 'POWER', 'AWE',
  'PSYCHOLOGICAL', 'EMOTIONAL', 'MOMENTUM', 'CALM',
];

// ─── Job Priority ───
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 3,
  MEDIUM = 5,
  LOW = 7,
  BACKGROUND = 10,
}

// ─── Queue Job Types (BullMQ) ───
export type JobType =
  | 'content:generate'
  | 'content:publish'
  | 'content:approve'
  | 'account:create'
  | 'account:sync'
  | 'account:health-check'
  | 'account:warm'
  | 'research:trends'
  | 'research:topics'
  | 'research:knowledge-update'
  | 'maintenance:cleanup'
  | 'maintenance:backup'
  | 'maintenance:metrics'
  | 'production:render-video'
  | 'production:generate-image'
  | 'production:generate-audio'
  | 'production:storyboard'
  | 'posting:schedule'
  | 'posting:publish';

// ─── API Response Types ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Pagination ───
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── User Types ───
export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

// ─── Channel Identity ───
export interface PostingCadence {
  minDaily?: number;
  maxDaily?: number;
  bestTimes?: string[];
}

// ─── Cinema Bible Sections ───
export interface LookBible {
  styleRefs?: string[];
  lighting?: string;
  grain?: string;
  lensKit?: string[];
  aspectRatio?: string;
}

export interface CharacterBible {
  identityAnchors?: Record<string, unknown>;
  wardrobe?: string[];
  neverChangeList?: string[];
  voiceprintConstraints?: Record<string, unknown>;
}

export interface EnvironmentBible {
  locationMotifs?: string[];
  timeOfDayRules?: Record<string, unknown>;
  weather?: string[];
}

export interface PromptBible {
  globalStyle?: string;
  characterBlocks?: Record<string, string>;
  shotBlockTemplates?: Record<string, string>;
  negativeBlock?: string;
}

// ─── ShotSpec ───
export interface ShotSpec {
  promptBlocks: string[];
  references?: string[];
  seed?: number;
  model?: string;
  duration?: number;
  fps?: number;
  camera?: {
    lens?: string;
    framing?: string;
    movement?: string;
  };
  lighting?: string;
  audioPlan?: Record<string, unknown>;
}

// ─── WebSocket Event Types ───
export type WebSocketEvent =
  | 'content:status'
  | 'workflow:progress'
  | 'alert:new'
  | 'system:metrics'
  | 'approval:new'
  | 'account:health'
  | 'posting:status';

export interface WebSocketPayload {
  event: WebSocketEvent;
  data: Record<string, unknown>;
  timestamp: string;
}
