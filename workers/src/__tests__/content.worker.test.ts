import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing
vi.mock('@airevstream/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@airevstream/queue', () => ({
  createWorker: vi.fn(() => ({
    on: vi.fn(),
  })),
  getQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('@airevstream/ai-client', () => ({
  generateText: vi.fn(),
  createServiceRegistry: vi.fn(),
}));

vi.mock('@airevstream/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  scoreViralPotential: vi.fn(() => ({
    overall: 72,
    tier: 'good',
    dimensions: {},
    issues: [],
    shareCoefficient: 0.5,
  })),
  APPROVAL_DEFAULTS: { INITIAL_GATE_WINDOW_HRS: 24 },
  evaluateApprovalGate: vi.fn(() => ({ shouldAutoApprove: false, shouldAutoReject: false, reason: 'within window' })),
}));

import { getDb } from '@airevstream/db';
import { createWorker, getQueue } from '@airevstream/queue';
import { generateText, createServiceRegistry } from '@airevstream/ai-client';
import { startContentWorker } from '../content.worker.js';

const mockDb = {
  contentItem: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  channel: {
    findUnique: vi.fn(),
  },
  alert: {
    create: vi.fn(),
  },
  approvalTrustScore: {
    findFirst: vi.fn(),
  },
  scheduledPost: {
    create: vi.fn(),
  },
  knowledgeBaseEntry: {
    findMany: vi.fn(() => []),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
});

describe('content worker', () => {
  it('startContentWorker creates a worker with concurrency 2', () => {
    startContentWorker();
    expect(createWorker).toHaveBeenCalledWith(
      'content',
      expect.any(Function),
      { concurrency: 2 },
    );
  });

  it('startContentWorker registers event handlers', () => {
    const mockWorker = { on: vi.fn() };
    (createWorker as ReturnType<typeof vi.fn>).mockReturnValue(mockWorker);

    startContentWorker();

    const registeredEvents = mockWorker.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('completed');
    expect(registeredEvents).toContain('failed');
    expect(registeredEvents).toContain('error');
    expect(registeredEvents).toContain('stalled');
  });

  it('startContentWorker registers repeatable approval timeout job', () => {
    const mockAdd = vi.fn().mockResolvedValue({});
    (getQueue as ReturnType<typeof vi.fn>).mockReturnValue({ add: mockAdd });
    (createWorker as ReturnType<typeof vi.fn>).mockReturnValue({ on: vi.fn() });

    startContentWorker();

    expect(getQueue).toHaveBeenCalledWith('content');
    expect(mockAdd).toHaveBeenCalledWith(
      'content:check-approval-timeouts',
      expect.any(Object),
      expect.objectContaining({
        repeat: { every: 5 * 60 * 1000 },
      }),
    );
  });

  describe('content:generate handler', () => {
    it('calls the processor with a generate job', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      const mockRegistry = {
        generate: vi.fn().mockResolvedValue({
          content: 'Generated script content',
          model: 'llama3',
          serviceId: 'svc-1',
        }),
      };
      (createServiceRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);

      const mockContent = {
        id: 'content-1',
        title: 'Test Video',
        contentType: 'video_short',
        channelId: 'chan-1',
        platformMetadata: {},
        channel: {
          name: 'Test Channel',
          primaryLanguage: 'en',
          niches: ['tech'],
          tone: 'professional',
          personality: null,
          targetAudience: 'developers',
          channelAvatars: [],
          cinemaBibles: [],
        },
      };

      mockDb.contentItem.findUnique.mockResolvedValue(mockContent);
      mockDb.contentItem.update.mockResolvedValue({});
      mockDb.approvalTrustScore.findFirst.mockResolvedValue(null);
      mockDb.channel.findUnique.mockResolvedValue({
        socialAccount: { emailAccount: { tenantId: 'tenant-1' } },
      });
      mockDb.alert.create.mockResolvedValue({});

      startContentWorker();

      const mockJob = {
        id: 'job-1',
        name: 'content:generate',
        data: { contentId: 'content-1', channelId: 'chan-1', contentType: 'video_short' },
        updateProgress: vi.fn(),
      };

      const result = await processor(mockJob);

      // Should update content to generating, then to pending_approval
      expect(mockDb.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'content-1' },
          data: { status: 'generating' },
        }),
      );

      expect(result).toEqual({ contentId: 'content-1', status: 'pending_approval' });
    });
  });

  describe('content:approve handler', () => {
    it('approves content when action is approve', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.contentItem.findUnique.mockResolvedValue({ id: 'content-1', status: 'pending_approval' });
      mockDb.contentItem.update.mockResolvedValue({});

      startContentWorker();

      const result = await processor({
        id: 'job-2',
        name: 'content:approve',
        data: { contentId: 'content-1', action: 'approve' },
        updateProgress: vi.fn(),
      });

      expect(mockDb.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'content-1' },
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );

      expect(result).toEqual({ contentId: 'content-1', action: 'approve' });
    });

    it('rejects content when action is reject', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.contentItem.findUnique.mockResolvedValue({ id: 'content-1', status: 'pending_approval' });
      mockDb.contentItem.update.mockResolvedValue({});

      startContentWorker();

      const result = await processor({
        id: 'job-3',
        name: 'content:approve',
        data: { contentId: 'content-1', action: 'reject' },
        updateProgress: vi.fn(),
      });

      expect(mockDb.contentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'content-1' },
          data: { status: 'draft' },
        }),
      );

      expect(result).toEqual({ contentId: 'content-1', action: 'reject' });
    });
  });

  describe('content:publish handler', () => {
    it('creates a scheduled post and updates content status', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.contentItem.findUnique.mockResolvedValue({
        id: 'content-1',
        channel: { socialAccount: { id: 'sa-1', platform: 'youtube' } },
      });
      mockDb.scheduledPost.create.mockResolvedValue({ id: 'sp-1' });
      mockDb.contentItem.update.mockResolvedValue({});

      startContentWorker();

      const result = await processor({
        id: 'job-4',
        name: 'content:publish',
        data: { contentId: 'content-1', channelId: 'chan-1' },
        updateProgress: vi.fn(),
      });

      expect(mockDb.scheduledPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contentId: 'content-1',
            channelId: 'chan-1',
            platform: 'youtube',
            status: 'scheduled',
          }),
        }),
      );

      expect(result).toEqual({ contentId: 'content-1', status: 'scheduled' });
    });
  });

  describe('unknown job name', () => {
    it('logs a warning for unknown job names', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      startContentWorker();

      // Should not throw for unknown job names
      const result = await processor({
        id: 'job-x',
        name: 'content:nonexistent',
        data: {},
        updateProgress: vi.fn(),
      });

      expect(result).toBeUndefined();
    });
  });
});
