import type { BrowserContext } from 'playwright';
import type { Platform } from '../types.js';
import type { WorkflowOptions } from './base-workflow.js';
import { YouTubeWorkflow } from './youtube-workflow.js';
import { TikTokWorkflow } from './tiktok-workflow.js';
import { InstagramWorkflow } from './instagram-workflow.js';
import { FacebookWorkflow } from './facebook-workflow.js';

export { BasePlatformWorkflow } from './base-workflow.js';
export type { WorkflowOptions } from './base-workflow.js';
export { YouTubeWorkflow } from './youtube-workflow.js';
export { TikTokWorkflow } from './tiktok-workflow.js';
export { InstagramWorkflow } from './instagram-workflow.js';
export { FacebookWorkflow } from './facebook-workflow.js';

/**
 * Factory function to create the correct platform workflow instance.
 */
export function createWorkflow(
  platform: Platform,
  context: BrowserContext,
  options?: WorkflowOptions,
) {
  switch (platform) {
    case 'youtube':
      return new YouTubeWorkflow(context, options);
    case 'tiktok':
      return new TikTokWorkflow(context, options);
    case 'instagram':
      return new InstagramWorkflow(context, options);
    case 'facebook':
      return new FacebookWorkflow(context, options);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
