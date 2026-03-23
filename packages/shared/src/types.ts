// ─── Platform Types ───
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';

export const PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook'];

// ─── Warming Types (canonical home — imported by browser-automation and seasoning) ───
export type WarmingActivity =
  | 'browse'
  | 'search'
  | 'like'
  | 'comment'
  | 'watch'
  | 'subscribe'
  | 'follow';

export interface WarmingConfig {
  platform: Platform;
  durationMinutes: number;
  activities: WarmingActivity[];
  nicheTags?: string[];
  intensity: 'low' | 'medium' | 'high';
}

export interface WarmingActivityResult {
  type: WarmingActivity;
  count: number;
  durationMs: number;
}

export interface WarmingSessionResult {
  activitiesPerformed: WarmingActivityResult[];
  totalDurationMs: number;
  flagged: boolean;
  screenshot?: string;
}

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
  | 'content:final-review'
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
  | 'production:generate-shots'
  | 'production:qc-gate'
  | 'production:mix-audio'
  | 'production:repair-shot'
  | 'content:viral-score'
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
  colorPipeline?: ColorGradeSpec;
  loras?: LoraSpec[];
  negativePrompt?: string;
  globalStyle?: string;
}

export interface CharacterBible {
  identityAnchors?: Record<string, unknown>;
  wardrobe?: string[];
  neverChangeList?: string[];
  voiceprintConstraints?: Record<string, unknown>;
  characterLoras?: Record<string, LoraSpec>;
  faceRef?: string;
  voiceId?: string;
}

export interface EnvironmentBible {
  locationMotifs?: string[];
  timeOfDayRules?: Record<string, unknown>;
  weather?: string[];
  environmentLoras?: Record<string, LoraSpec>;
  depthMapRef?: string;
  lightingSetups?: Record<string, string>;
}

export interface PromptBible {
  globalStyle?: string;
  characterBlocks?: Record<string, string>;
  shotBlockTemplates?: Record<string, string>;
  negativeBlock?: string;
  qualityTokens?: string;
  styleTokens?: string;
  avoidTokens?: string;
  defaultSeedPolicy?: SeedPolicy;
  baseSeed?: number;
  logline?: string;
  slotRules?: Record<string, string[]>;
  perCharacterBlocks?: Record<string, string[]>;
  perEnvironmentBlocks?: Record<string, string[]>;
}

// ─── Cinema Pipeline Types ───
export interface CameraSpec {
  lens?: string;        // "35mm", "85mm", "anamorphic 50mm"
  framing?: string;     // "close-up", "wide", "medium", "extreme-close-up"
  movement?: string;    // "static", "pan-left", "dolly-in", "crane-up"
  dof?: 'shallow' | 'medium' | 'deep';
  stabilization?: 'handheld' | 'steadicam' | 'tripod' | 'gimbal';
}

export interface LoraSpec {
  name: string;           // "cinematic_v2.safetensors"
  strength: number;       // 0.0-2.0 (typical: 0.4-0.8)
  clipStrength?: number;  // defaults to strength
  triggerWords?: string[];
}

export interface ControlNetSpec {
  type: 'depth' | 'pose' | 'canny' | 'lineart' | 'softedge' | 'scribble';
  model: string;
  strength: number;    // 0.0-2.0
  startPercent?: number;
  endPercent?: number;
  sourceImage?: string;  // MinIO key for reference image
}

export interface UpscaleSpec {
  model: string;          // "4x-UltraSharp", "RealESRGAN_x4plus"
  scale?: number;         // 2 or 4
  denoiseAfter?: number;  // Low denoise pass after upscale (0.2-0.4)
}

export interface RefinerSpec {
  model?: string;
  switchAt?: number;     // 0.0-1.0 (when to switch from base to refiner)
}

export interface GenerationSpec {
  provider?: string;       // "comfyui", "veo", "sora", "runway", "kling"
  steps?: number;          // 20-50 for SDXL
  cfg?: number;            // 5-12
  sampler?: string;        // "euler_ancestral", "dpmpp_2m", "dpmpp_sde"
  scheduler?: string;      // "normal", "karras", "exponential"
  denoise?: number;        // 0.0-1.0
  width?: number;
  height?: number;
  batchSize?: number;
  loras?: LoraSpec[];
  controlNets?: ControlNetSpec[];
  upscale?: UpscaleSpec;
  refiner?: RefinerSpec;
  seedLock?: boolean;      // Reuse seed from previous shot for consistency
}

export interface PostProcessSpec {
  sharpen?: number;        // 0-100
  noiseReduction?: number; // 0-100
  filmGrain?: number;      // 0-100
  vignette?: number;       // 0-100
}

export interface ColorGradeSpec {
  lut?: string;              // LUT filename
  temperature?: number;      // -100 to +100
  tint?: number;             // -100 to +100
  contrast?: number;         // -100 to +100
  saturation?: number;       // -100 to +100
  highlights?: number;
  shadows?: number;
  blacks?: number;
  whites?: number;
}

export interface VfxSpec {
  depthPass?: boolean;       // Generate depth map for compositing
  mattePasses?: string[];    // Which mattes to generate
  motionBlur?: boolean;
}

// ─── Repair / Inpainting ───

export type RepairType = 'inpaint' | 'face-fix' | 'lighting-harmonize';

export interface RepairSpec {
  type: RepairType;
  /** Source image MinIO key to repair */
  sourceImage: string;
  /** Mask image MinIO key (for inpainting) */
  maskImage?: string;
  /** Auto-generate mask for face regions */
  autoFaceMask?: boolean;
  /** Denoise strength for repair pass (lower = subtler fix) */
  denoise?: number;
  /** Repair prompt override (what should replace masked area) */
  repairPrompt?: string;
  /** Reference image for lighting harmonization */
  lightingRef?: string;
}

export interface AudioLayerSpec {
  source?: 'tts' | 'file' | 'generate';
  text?: string;             // For TTS
  voice?: string;            // Voice ID
  fileKey?: string;          // MinIO key for audio file
  volume?: number;           // 0.0-1.0
  fadeInMs?: number;
  fadeOutMs?: number;
  loop?: boolean;
}

export interface AudioPlan {
  bg?: AudioLayerSpec;       // Background bed (ambient, music)
  mg?: AudioLayerSpec;       // Midground (effects, room tone)
  fg?: AudioLayerSpec;       // Foreground (dialogue, foley)
  masterVolume?: number;     // 0.0-1.0
}

// ─── Seed Policy ───

/**
 * Controls how seeds are assigned to shots for generation consistency:
 *   - free: random seed per shot (default)
 *   - shot-offset: baseSeed + shotIndex — deterministic sequence
 *   - scene-lock: same seed for all shots in a scene
 *   - series-lock: same seed across episodes for character consistency
 */
export type SeedPolicy = 'free' | 'shot-offset' | 'scene-lock' | 'series-lock';

// ─── ShotSpec ───
export interface ShotSpec {
  // --- Existing fields ---
  promptBlocks: string[];
  references?: string[];
  seed?: number;
  seedPolicy?: SeedPolicy;
  seedLocked?: boolean;   // When true, seed is never overridden by policy resolution
  model?: string;
  duration?: number;
  fps?: number;
  lighting?: string;

  // --- Camera ---
  camera?: CameraSpec;

  // --- Audio ---
  audioPlan?: AudioPlan;

  // --- Cinema pipeline fields ---
  generation?: GenerationSpec;
  postProcess?: PostProcessSpec;
  colorGrade?: ColorGradeSpec;
  vfx?: VfxSpec;
  aspect?: '16:9' | '9:16' | '4:3' | '2.39:1' | '1:1';
  outputType?: 'image' | 'video' | 'image+video';

  // --- Lip-sync ---
  lipSync?: {
    enabled: boolean;
    mode: 'subtitle-only' | 'character-rig' | 'overlay';
    smoothing?: number;
    exaggeration?: number;
    characterId?: string;
  };

  // --- Prompt & Script ---
  promptSlots?: Record<string, string>;
  dialogue?: string;
  transition?: string;
  beat?: string;
  shotClass?: string;
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

// ─── Asset Registry ───
export interface AssetRegistryEntry {
  id: string;
  type: 'image' | 'video' | 'audio' | 'model' | 'lora' | 'workflow';
  storageKey: string;
  hash?: string;
  version?: string;
  metadata?: Record<string, unknown>;
  contentId?: string;
  shotId?: string;
  createdAt: string;
}

// ─── Timestamped Script ───
export interface TimestampedScript {
  sections: Array<{
    type: 'CAM' | 'ACTION' | 'DIALOGUE' | 'AUDIO' | 'VFX';
    text: string;
    startSec: number;
    endSec: number;
  }>;
}
