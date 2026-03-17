// ─── Platform Types ───
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'facebook';

export const PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'twitter', 'facebook'];

// ─── Content Types ───
export type ContentType = 'video' | 'image' | 'text' | 'story' | 'reel' | 'short';

export type ContentStatus =
  | 'draft'
  | 'generating'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

// ─── Workflow Types ───
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type WorkflowStepType =
  | 'research'
  | 'script'
  | 'voiceover'
  | 'image_generation'
  | 'video_assembly'
  | 'review'
  | 'publish';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

// ─── Account Types ───
export type AccountStatus = 'active' | 'suspended' | 'disconnected' | 'pending';

// ─── Job Types ───
export type JobType =
  | 'content:generate'
  | 'content:publish'
  | 'account:sync'
  | 'account:health-check'
  | 'research:trends'
  | 'research:topics'
  | 'maintenance:cleanup'
  | 'maintenance:backup'
  | 'production:render-video'
  | 'production:generate-image'
  | 'production:generate-audio';

// ─── API Response Types ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// ─── Pagination ───
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── User Types ───
export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}
