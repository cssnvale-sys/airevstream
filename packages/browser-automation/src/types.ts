import type { Platform } from '@airevstream/shared';

// ─── Proxy Configuration ───
export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  type: 'residential' | 'datacenter' | 'mobile';
}

// ─── Browser Fingerprint Configuration ───
export interface FingerprintConfig {
  userAgent?: string;
  platform?: string;
  webglVendor?: string;
  webglRenderer?: string;
  languages?: string[];
  screenResolution?: { width: number; height: number };
  colorDepth?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

// ─── Browser Session Configuration ───
export interface BrowserSessionConfig {
  proxy?: ProxyConfig;
  fingerprint?: FingerprintConfig;
  userDataDir?: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  locale?: string;
  timezone?: string;
  geolocation?: { latitude: number; longitude: number };
}

// ─── Human Behavior Configuration ───
export interface HumanBehaviorConfig {
  minDelay: number;
  maxDelay: number;
  mouseJitter: boolean;
  scrollBehavior: 'smooth' | 'instant' | 'human';
  typingSpeed: { wpm: number; errorRate: number };
}

// ─── Session State ───
export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
}

export interface SessionState {
  cookies: SessionCookie[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  lastUrl?: string;
}

// ─── Account Credentials ───
export interface AccountCredentials {
  email: string;
  password: string;
  recoveryEmail?: string;
  phoneNumber?: string;
  platform: Platform;
}

// ─── Workflow Types ───
export interface WorkflowStep {
  name: string;
  action: string;
  params?: Record<string, unknown>;
  timeout?: number;
  requiresHuman?: boolean;
  humanPrompt?: string;
}

export interface StepResult {
  name: string;
  success: boolean;
  durationMs: number;
  screenshot?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface WorkflowResult {
  success: boolean;
  steps: StepResult[];
  screenshots?: string[];
  error?: string;
  needsHuman?: boolean;
  humanTaskDescription?: string;
}

// ─── Warming Types (re-exported from @airevstream/shared to break circular dependency) ───
export type { WarmingActivity, WarmingConfig, WarmingActivityResult, WarmingSessionResult } from '@airevstream/shared';

// ─── Account Discovery ───
export interface DiscoveryResult {
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

// ─── Profile Setup ───
export interface ProfileAssetsConfig {
  profileImagePath?: string;
  bannerImagePath?: string;
  displayName?: string;
  bio?: string;
}

// ─── Proxy Verification ───
export interface ProxyVerificationResult {
  success: boolean;
  ip: string;
  country?: string;
  isResidential?: boolean;
  latencyMs: number;
  blocked: boolean;
}

// ─── Internal Tracking Types ───
export interface ProxyHealth {
  lastUsed: number;
  failures: number;
  lastFailedAt: number | null;
  blocked: boolean;
  lastFailReason?: string;
}

export interface ProxyPoolStats {
  total: number;
  healthy: number;
  blocked: number;
  failed: number;
  averageLatencyMs: number;
}

export interface ManagedContext {
  id: string;
  context: import('playwright').BrowserContext;
  config: BrowserSessionConfig;
  createdAt: number;
}

export { Platform };
