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
export type EmailAccountStatus = 'active' | 'disabled' | 'flagged' | 'pending' | 'provisioning';
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
export type StoryboardStatus = 'draft' | 'pending_review' | 'approved' | 'in_production';
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
  | 'production:asset-generate'
  | 'content:viral-score'
  | 'posting:schedule'
  | 'posting:publish'
  | 'lifecycle:init'
  | 'lifecycle:discover'
  | 'lifecycle:plan'
  | 'lifecycle:signup'
  | 'lifecycle:set-profile'
  | 'lifecycle:enroll';

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
  filmGrain?: number;        // 0-100
  vignette?: number;         // 0-100
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
  levelDb?: number;          // Target level in dBFS (e.g., -14 for fg, -24 for bg)
  duckingDb?: number;        // Ducking depth in dB when fg is active
}

export interface AudioPlan {
  bg?: AudioLayerSpec;       // Background bed (ambient, music)
  mg?: AudioLayerSpec;       // Midground (effects, room tone)
  fg?: AudioLayerSpec;       // Foreground (dialogue, foley)
  masterVolume?: number;     // 0.0-1.0
}

// ─── Continuity Locks ───

export type ContinuityLockLevel = 'off' | 'standard' | 'strong';

export interface ContinuityLocks {
  characterLock?: ContinuityLockLevel;
  wardrobeLock?: ContinuityLockLevel;
  environmentLock?: ContinuityLockLevel;
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

// ─── Frame Anchoring ───

export interface FrameAnchor {
  /** MinIO storage key for the anchor frame image */
  storageKey: string;
  /** Influence strength (0.0-1.0, default 0.75) */
  strength?: number;
  /** How to apply the anchor frame */
  mode?: 'img2img' | 'controlnet';
  /** ControlNet preprocessor type (only used when mode='controlnet') */
  controlNetType?: 'depth' | 'canny' | 'softedge';
}

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

  // --- Frame Anchoring (editorial continuity) ---
  firstFrameRef?: FrameAnchor;
  lastFrameRef?: FrameAnchor;

  // --- Lip-sync ---
  lipSync?: {
    enabled: boolean;
    mode: 'subtitle-only' | 'character-rig' | 'overlay';
    smoothing?: number;
    exaggeration?: number;
    characterId?: string;
  };

  // --- Continuity Locks ---
  continuityLocks?: ContinuityLocks;

  // --- Prompt & Script ---
  promptSlots?: Record<string, string>;
  dialogue?: string;
  transition?: string;
  beat?: string;
  shotClass?: string;
}

// ─── Multi-Language Types ───

export type LanguageCode =
  | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar' | 'hi'
  | 'it' | 'nl' | 'ru' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'id';

export type LanguageMode = 'separate' | 'multi-audio';

export interface LanguageConfig {
  languages: LanguageCode[];
  mode: LanguageMode;
  primaryLanguage: LanguageCode;
}

export interface TranslatedScript {
  language: LanguageCode;
  script: string;
  translatedAt: string;
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
  fileSize?: number;
  mimeType?: string;
  version: number;
  parentAssetId?: string;
  generatedBy?: string;
  provenance?: Record<string, unknown>;
  contentId?: string;
  shotId?: string;
  seriesId?: string;
  avatarId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── Avatar Types ───
export type AvatarImageSlot = 'face' | 'waist' | 'body_front' | 'body_back';

export interface AvatarImageRef {
  bucket: string;
  key: string;
}

export interface AvatarImages {
  face?: AvatarImageRef;
  waist?: AvatarImageRef;
  body_front?: AvatarImageRef;
  body_back?: AvatarImageRef;
}

export interface Avatar {
  id: string;
  tenantId: string;
  name: string;
  description: Record<string, unknown>;
  traitLock: Record<string, unknown>;
  images: AvatarImages;
  voiceProfiles: Record<string, unknown>;
  generationHistory: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

// ─── Scenery Types ───
export type SceneryCategory = 'city' | 'nature' | 'studio' | 'fantasy' | 'interior' | 'abstract';

export interface SceneryAsset {
  id: string;
  tenantId: string;
  name: string;
  category?: SceneryCategory | string;
  imageUrl: string;
  prompt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Branding Types ───
export interface BrandingPackage {
  id: string;
  channelId: string;
  logoUrl?: string;
  bannerUrl?: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  templates: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

// ─── Upload Types ───
export interface PresignedPutResponse {
  url: string;
  bucket: string;
  key: string;
  expiresIn: number;
}

export interface UploadedAssetRef {
  bucket: string;
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// ─── Series ───
export type SeriesStatus = 'draft' | 'active' | 'archived';

export interface PostingCadenceConfig {
  dayOfWeek?: number[];
  time?: string;
  timezone?: string;
}

export interface Series {
  id: string;
  channelId: string;
  name: string;
  description?: string;
  status: SeriesStatus;
  sortOrder: number;
  coverImageUrl?: string;
  targetAudience?: string;
  tags: string[];
  defaultPresetIds: string[];
  defaultRecipeId?: string;
  bibleOverrides: Record<string, unknown>;
  postingCadence: PostingCadenceConfig;
  youtubePlaylistId?: string;
  baseSeed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  id: string;
  seriesId: string;
  contentId: string;
  position: number;
  episodeNumber: number;
  title?: string;
  publishedAt?: string;
}

export interface SeriesAvatar {
  seriesId: string;
  avatarId: string;
  isPrimary: boolean;
  role?: string;
}

// ─── Account Lifecycle Types ───
export type AccountLifecycleStatus =
  | 'pending'
  | 'discovering'
  | 'planning'
  | 'signing_up'
  | 'setting_profile'
  | 'enrolling'
  | 'active'
  | 'completed'
  | 'failed';

export interface PlatformDiscoveryResult {
  exists: boolean | 'unknown';
  accountInfo?: {
    username?: string;
    profileUrl?: string;
    platformUserId?: string;
    channelId?: string;
  };
  needsHuman?: boolean;
  humanTaskDescription?: string;
  error?: string;
}

export interface AccountLifecycle {
  id: string;
  emailAccountId: string;
  tenantId: string;
  targetPlatforms: string[];
  avatarId?: string;
  autoSeasoning: boolean;
  autoPosting: boolean;
  status: AccountLifecycleStatus;
  discoveryResults: Record<string, PlatformDiscoveryResult>;
  cohortId?: string;
  currentStep?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLock {
  type: 'warming' | 'posting';
  lockedAt: string;
  expiresAt: string;
  jobId: string;
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

// ─── Assembly Manifest ───

/**
 * The assembly manifest is the bridge between ComfyUI (asset factory)
 * and Remotion (film assembly engine). It carries persisted agent outputs,
 * shot-level data, and output specifications through the production pipeline.
 *
 * Stored in `Storyboard.scriptJson` — no migration required.
 */
export interface AssemblyManifest {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0.0';
  /** Content item ID */
  contentId: string;
  /** Storyboard ID */
  storyboardId: string;
  /** Remotion composition ID to render with */
  compositionId: string;
  /** Quality tier controlling generation defaults */
  qualityTier: 'draft' | 'standard' | 'cinema';
  /** Production type controlling composition selection */
  productionType: 'short' | 'long' | 'cinema' | 'thumbnail';

  /** Persisted agent outputs (closes G1) */
  agentOutputs?: {
    director?: Record<string, unknown>;
    lookdev?: Record<string, unknown>;
    shotspec?: Record<string, unknown>;
    dialogue?: Record<string, unknown>;
    sound?: Record<string, unknown>;
    psychology?: Record<string, unknown>;
    finishing?: Record<string, unknown>;
  };

  /** Remotion-ready shot data */
  shots: AssembledShot[];

  /** Global color grade applied to all shots */
  globalColorGrade?: ColorGradeSpec;

  /** Beat timing markers derived from DirectorOutput.sections */
  beatTimings?: Array<{
    startSec: number;
    endSec: number;
    section: 'hook' | 'intro' | 'content' | 'cta';
    preset?: string;
    label: string;
  }>;

  /** Subtitles derived from FinishingOutput or DialogueOutput */
  subtitles?: Array<{
    startSec: number;
    endSec: number;
    text: string;
    position?: 'top' | 'center' | 'bottom';
  }>;

  /** Output specification for Remotion render */
  outputSpec: {
    width: number;
    height: number;
    fps: number;
    aspect: string;
    codec: 'h264' | 'prores';
    totalDurationSec: number;
  };

  /** Preset stack applied to this production (for audit trail) */
  presetStack?: string[];
  /** Recipe ID if a recipe was used */
  recipeId?: string;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * A single shot within the assembly manifest, carrying all data
 * needed for both ComfyUI generation and Remotion rendering.
 */
export interface AssembledShot {
  shotId: string;
  shotNumber: number;
  startSec: number;
  endSec: number;
  durationSec: number;

  /** Keyframe image URL (populated after ComfyUI generation) */
  keyframeUrl?: string;
  /** Video plate URL (populated after video generation) */
  videoPlateUrl?: string;
  /** FramePack video clip URL (populated after FramePack image-to-video generation) */
  videoClipUrl?: string;
  /** Audio stem URLs per layer */
  audioStemUrls?: { fg?: string; mg?: string; bg?: string };

  /** Visual direction */
  camera?: CameraSpec;
  colorGrade?: ColorGradeSpec;
  shotClass?: string;
  transition?: string;
  beat?: string;

  /** Dialogue (from Dialogue agent — closes G12) */
  dialogue?: {
    text: string;
    voice: string;
    emotion: string;
    pacing: 'slow' | 'normal' | 'fast';
  };

  /** Audio plan (from Sound agent — closes G3) */
  audioPlan?: AudioPlan;

  /** Continuity locks */
  continuityLocks?: ContinuityLocks;
  /** Resolved seed for reproducibility */
  seed?: number;

  /** Post-generation quality score */
  qualityScore?: number;
}

// ─── Timecoded Production Script ───

/**
 * A single timecoded cue entry — one row in the master production script.
 * Every element (visual, camera, dialogue, sound, SFX) is timestamped to the second.
 */
export interface TimecodedCue {
  /** Absolute start timecode (MM:SS or SS) */
  startTime: string;
  /** Absolute end timecode */
  endTime: string;
  /** Start in seconds from beginning of video */
  startSec: number;
  /** End in seconds from beginning of video */
  endSec: number;
  /** Which shot this cue belongs to */
  shotNumber: number;
  /** H.I.C.C. section */
  section: 'hook' | 'intro' | 'content' | 'cta';
  /** Beat preset for emotional mood */
  beatPreset?: string;

  // ─── Visual ───
  /** Shot class (e.g., Establishing_Wide, Dialogue_Closeup) */
  shotClass?: string;
  /** Visual description / prompt blocks joined */
  visualDescription: string;
  /** Camera: lens, framing, movement, DOF, stabilization */
  camera: {
    lens?: string;
    framing?: string;
    movement?: string;
    dof?: string;
    stabilization?: string;
  };
  /** Transition into this shot */
  transition: string;
  /** Ken Burns / camera motion keyframes (start/end scale, pan) */
  cameraMotion?: {
    startScale: number;
    endScale: number;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  };

  // ─── Dialogue / Narration ───
  /** Spoken text for this shot (dialogue, narration, VO) */
  dialogue?: {
    text: string;
    voice: string;
    emotion: string;
    pacing: 'slow' | 'normal' | 'fast';
  };

  // ─── Audio Layers ───
  /** Background: ambient music, mood bed */
  audioBg?: {
    source: string;
    volume: number;
    description: string;
    fadeInSec?: number;
    fadeOutSec?: number;
    loop?: boolean;
  };
  /** Midground: SFX, room tone, transitions */
  audioMg?: {
    source: string;
    volume: number;
    description: string;
    fadeInSec?: number;
    fadeOutSec?: number;
  };
  /** Foreground: voice/dialogue */
  audioFg?: {
    source: string;
    volume: number;
    description: string;
    fadeInSec?: number;
    fadeOutSec?: number;
  };

  // ─── SFX Cues (precise timing within the shot) ───
  sfxCues?: Array<{
    timeSec: number;     // Offset from shot start
    description: string;  // e.g., "glass break", "door slam"
    volume: number;
  }>;

  // ─── Character / Blocking ───
  /** Character action/movement within frame */
  characterBlocking?: string;
  /** On-screen text overlay */
  textOverlay?: {
    text: string;
    position: string;
    animation: string;
  };

  // ─── Technical ───
  /** Generation params (steps, cfg, sampler, dimensions, seed) */
  generation?: {
    steps?: number;
    cfg?: number;
    sampler?: string;
    width?: number;
    height?: number;
    seed?: number;
  };
  /** Per-shot color grade override */
  colorGrade?: {
    temperature?: number;
    contrast?: number;
    saturation?: number;
    filmGrain?: number;
    vignette?: number;
  };
  /** Quality score from QC (populated after generation) */
  qualityScore?: number;
}

/**
 * The unified master production script — a complete second-by-second
 * breakdown of every visual, audio, dialogue, and SFX element.
 *
 * Generated by merging all 8 agent outputs (Director, LookDev, ShotSpec,
 * Dialogue, Sound, Psychology, Finishing, QC) into a single timecoded document.
 */
export interface TimecodedProductionScript {
  /** Schema version */
  schemaVersion: '1.0.0';
  /** Content item ID */
  contentId: string;
  /** Storyboard ID */
  storyboardId: string;
  /** Video title */
  title: string;

  // ─── Header / Global Info ───
  /** Creative concept (from Director) */
  concept: string;
  /** Narrative summary (from Director) */
  narrative: string;
  /** Emotional arc beats (from Director) */
  emotionalArc: string[];
  /** Total duration in seconds */
  totalDurationSec: number;
  /** Target platform */
  platform: string;
  /** Content type */
  contentType: string;

  // ─── Global Visual Identity (from LookDev) ───
  globalStyle?: string;
  colorPalette?: string[];
  lightingScheme?: string;
  lensKit?: string[];
  aspectRatio?: string;

  // ─── Global Audio (from Sound) ───
  masterVolume?: number;
  mixNotes?: string;

  // ─── Global Color Grade (from Finishing) ───
  globalColorGrade?: {
    temperature?: number;
    contrast?: number;
    saturation?: number;
    lut?: string;
  };
  postProcess?: {
    sharpen?: number;
    filmGrain?: number;
    vignette?: number;
  };

  // ─── Psychology (from Psychology agent) ───
  persuasionScore?: number;
  retentionTechniques?: string[];

  // ─── The Shot Sheet ───
  /** Second-by-second shot cues — the master production document */
  cues: TimecodedCue[];

  // ─── Beat Timings ───
  beatTimings?: Array<{
    startSec: number;
    endSec: number;
    section: 'hook' | 'intro' | 'content' | 'cta';
    preset?: string;
    label: string;
  }>;

  // ─── Subtitles (from Finishing) ───
  subtitles?: Array<{
    startSec: number;
    endSec: number;
    text: string;
    position?: 'top' | 'center' | 'bottom';
  }>;

  // ─── Delivery Format ───
  deliveryFormat?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
  };

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}
