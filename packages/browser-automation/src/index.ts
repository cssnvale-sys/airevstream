// ─── Types ───
export type {
  ProxyConfig,
  FingerprintConfig,
  BrowserSessionConfig,
  HumanBehaviorConfig,
  SessionCookie,
  SessionState,
  AccountCredentials,
  WorkflowStep,
  StepResult,
  WorkflowResult,
  WarmingActivity,
  WarmingConfig,
  WarmingActivityResult,
  WarmingSessionResult,
  ProxyVerificationResult,
  ProxyHealth,
  ProxyPoolStats,
  ManagedContext,
} from './types.js';

export { type Platform } from './types.js';

// ─── Core Classes ───
export { BrowserContextManager } from './browser-context.js';
export { HumanBehavior } from './human-behavior.js';
export { ProxyManager } from './proxy-manager.js';
export { SessionManager } from './session-manager.js';

// ─── Platform Workflows ───
export {
  BasePlatformWorkflow,
  YouTubeWorkflow,
  TikTokWorkflow,
  InstagramWorkflow,
  FacebookWorkflow,
  createWorkflow,
} from './platform-workflows/index.js';
