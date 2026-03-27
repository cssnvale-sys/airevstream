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
  DiscoveryResult,
  ProfileAssetsConfig,
} from './types.js';

export { type Platform } from './types.js';

// ─── Core Classes ───
export { BrowserContextManager } from './browser-context.js';
export { HumanBehavior } from './human-behavior.js';
export { ProxyManager } from './proxy-manager.js';
export { SessionManager } from './session-manager.js';

// ─── Seasoning Infrastructure ───
export { AccountProxyPinning } from './account-proxy-pinning.js';
export { FingerprintStore } from './fingerprint-store.js';

// ─── External Service Stubs ───
export { CaptchaSolver } from './captcha-solver.js';
export type { CaptchaInfo, CaptchaSolveResult } from './captcha-solver.js';
export { SmsVerifier } from './sms-verifier.js';
export type { SmsActivation } from './sms-verifier.js';

// ─── Platform Workflows ───
export {
  BasePlatformWorkflow,
  YouTubeWorkflow,
  TikTokWorkflow,
  InstagramWorkflow,
  FacebookWorkflow,
  createWorkflow,
} from './platform-workflows/index.js';
export type { WorkflowOptions } from './platform-workflows/index.js';
