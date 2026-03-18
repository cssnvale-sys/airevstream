import { authenticate, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/assistant/capabilities
 * List system capabilities (static config of available actions the assistant can perform).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const capabilities = {
      version: '1.0',
      actions: [
        {
          id: 'content.generate',
          name: 'Generate Content',
          description: 'Generate text, image, or video content using AI',
          tier: 1,
          parameters: ['contentType', 'prompt', 'channelId', 'language'],
          requiresApproval: false,
        },
        {
          id: 'content.schedule',
          name: 'Schedule Content',
          description: 'Schedule content for posting to a platform',
          tier: 1,
          parameters: ['contentId', 'channelId', 'scheduledAt', 'platform'],
          requiresApproval: false,
        },
        {
          id: 'content.approve',
          name: 'Approve Content',
          description: 'Approve content for publishing',
          tier: 2,
          parameters: ['contentId'],
          requiresApproval: true,
        },
        {
          id: 'account.create',
          name: 'Create Account',
          description: 'Create a new email or social account',
          tier: 3,
          parameters: ['email', 'platform', 'tier'],
          requiresApproval: true,
        },
        {
          id: 'workflow.start',
          name: 'Start Workflow',
          description: 'Start a workflow job (content production, research, etc.)',
          tier: 1,
          parameters: ['jobType', 'channelId', 'params'],
          requiresApproval: false,
        },
        {
          id: 'analytics.query',
          name: 'Query Analytics',
          description: 'Query analytics data (revenue, engagement, costs)',
          tier: 1,
          parameters: ['reportType', 'dateRange', 'filters'],
          requiresApproval: false,
        },
        {
          id: 'system.healthCheck',
          name: 'System Health Check',
          description: 'Check health of all AI services and system components',
          tier: 1,
          parameters: [],
          requiresApproval: false,
        },
        {
          id: 'affiliate.addProduct',
          name: 'Add Affiliate Product',
          description: 'Add a new product to the affiliate catalog',
          tier: 2,
          parameters: ['name', 'url', 'category', 'commissionRate'],
          requiresApproval: true,
        },
        {
          id: 'knowledge.search',
          name: 'Search Knowledge Base',
          description: 'Search the knowledge base for relevant information',
          tier: 1,
          parameters: ['query', 'domain', 'category'],
          requiresApproval: false,
        },
        {
          id: 'settings.update',
          name: 'Update Settings',
          description: 'Update system or service configuration',
          tier: 3,
          parameters: ['settingKey', 'value'],
          requiresApproval: true,
        },
      ],
      tiers: {
        1: { name: 'Read/Generate', description: 'Read-only operations and content generation', requiresApproval: false },
        2: { name: 'Modify', description: 'Operations that modify data', requiresApproval: true },
        3: { name: 'Admin', description: 'Administrative and destructive operations', requiresApproval: true },
      },
    };

    return success(capabilities);
  } catch (err) {
    console.error('GET /api/v1/assistant/capabilities error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch capabilities', 500);
  }
}
