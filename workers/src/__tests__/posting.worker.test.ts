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
  addJob: vi.fn().mockResolvedValue({}),
}));

vi.mock('@airevstream/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  PRESIGNED_URL_TTL_SECONDS: 3600,
  getConfig: vi.fn(() => ({ ENCRYPTION_KEY: 'test-key-32-chars-long-xxxxxxxx' })),
}));

vi.mock('@airevstream/crypto', () => ({
  decrypt: vi.fn(() => JSON.stringify({ accessToken: 'test-token', channelId: 'yt-chan-1' })),
}));

vi.mock('@airevstream/storage', () => ({
  getPresignedUrl: vi.fn((_bucket: string, key: string) => Promise.resolve(`https://minio.local/${key}?signed`)),
}));

vi.mock('../platform-adapters.js', () => ({
  getAdapter: vi.fn(() => ({
    publish: vi.fn().mockResolvedValue({
      success: true,
      platformPostId: 'yt-video-123',
      platformUrl: 'https://youtube.com/watch?v=yt-video-123',
    }),
  })),
}));

import { getDb } from '@airevstream/db';
import { createWorker, getQueue, addJob } from '@airevstream/queue';
import { startPostingWorker } from '../posting.worker.js';

const mockDb = {
  scheduledPost: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  contentItem: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  socialAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  alert: {
    create: vi.fn(),
  },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};

beforeEach(() => {
  vi.clearAllMocks();
  (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
});

describe('posting worker', () => {
  it('startPostingWorker creates a worker with concurrency 1 and rate limiter', () => {
    startPostingWorker();
    expect(createWorker).toHaveBeenCalledWith(
      'posting',
      expect.any(Function),
      expect.objectContaining({
        concurrency: 1,
        limiter: { max: 5, duration: 60_000 },
      }),
    );
  });

  it('startPostingWorker registers event handlers', () => {
    const mockWorker = { on: vi.fn() };
    (createWorker as ReturnType<typeof vi.fn>).mockReturnValue(mockWorker);

    startPostingWorker();

    const registeredEvents = mockWorker.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('completed');
    expect(registeredEvents).toContain('failed');
    expect(registeredEvents).toContain('error');
    expect(registeredEvents).toContain('stalled');
  });

  it('startPostingWorker registers repeatable check-scheduled job', () => {
    const mockAdd = vi.fn().mockResolvedValue({});
    (getQueue as ReturnType<typeof vi.fn>).mockReturnValue({ add: mockAdd });
    (createWorker as ReturnType<typeof vi.fn>).mockReturnValue({ on: vi.fn() });

    startPostingWorker();

    expect(getQueue).toHaveBeenCalledWith('posting');
    expect(mockAdd).toHaveBeenCalledWith(
      'posting:check-scheduled',
      expect.any(Object),
      expect.objectContaining({
        repeat: { every: 60_000 },
      }),
    );
  });

  describe('posting:schedule handler', () => {
    it('creates a scheduled post record', async () => {
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

      startPostingWorker();

      const result = await processor({
        id: 'job-1',
        name: 'posting:schedule',
        data: {
          contentId: 'content-1',
          channelId: 'chan-1',
          scheduledAt: '2025-01-01T12:00:00Z',
          platform: 'youtube',
        },
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

      expect(result).toEqual({ scheduledPostId: 'sp-1', status: 'scheduled' });
    });
  });

  describe('posting:check-scheduled handler', () => {
    it('enqueues due posts for publishing', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.scheduledPost.findMany.mockResolvedValue([
        {
          id: 'sp-1',
          contentId: 'content-1',
          channelId: 'chan-1',
          platform: 'youtube',
          content: {},
          channel: { socialAccount: {} },
        },
      ]);
      mockDb.scheduledPost.update.mockResolvedValue({});

      startPostingWorker();

      await processor({
        id: 'job-2',
        name: 'posting:check-scheduled',
        data: {},
        updateProgress: vi.fn(),
      });

      expect(addJob).toHaveBeenCalledWith(
        'posting',
        'posting:publish',
        expect.objectContaining({
          scheduledPostId: 'sp-1',
          contentId: 'content-1',
          channelId: 'chan-1',
          platform: 'youtube',
        }),
        expect.objectContaining({ attempts: 3 }),
      );

      expect(mockDb.scheduledPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sp-1' },
          data: { status: 'queued' },
        }),
      );
    });

    it('does nothing when no posts are due', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.scheduledPost.findMany.mockResolvedValue([]);

      startPostingWorker();

      await processor({
        id: 'job-3',
        name: 'posting:check-scheduled',
        data: {},
        updateProgress: vi.fn(),
      });

      expect(addJob).not.toHaveBeenCalled();
    });
  });

  describe('posting:playlist-sync handler', () => {
    it('returns stub status', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      startPostingWorker();

      const result = await processor({
        id: 'job-4',
        name: 'posting:playlist-sync',
        data: { seriesId: 'series-1', youtubePlaylistId: 'PL123', tenantId: 'tenant-1' },
        updateProgress: vi.fn(),
      });

      expect(result).toEqual({ status: 'stub', seriesId: 'series-1' });
    });
  });

  describe('unknown job name', () => {
    it('handles posting:publish by processing the publish flow', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      // Set up the full publish flow mocks
      mockDb.scheduledPost.findUnique
        .mockResolvedValueOnce({
          channel: { socialAccount: { id: 'sa-1', metadata: null } },
        })
        .mockResolvedValueOnce({
          id: 'sp-1',
          scheduledAt: new Date('2025-01-01T12:00:00Z'),
          publishConfig: null,
          content: {
            id: 'content-1',
            title: 'Test Video',
            contentType: 'video_short',
            fileUrl: 'videos/test.mp4',
            thumbnailUrl: null,
            prompt: 'A test video',
            platformMetadata: {},
          },
          channel: {
            socialAccount: {
              id: 'sa-1',
              credentialsEnc: 'encrypted-creds',
              platformChannelId: 'yt-chan',
              emailAccount: { tenantId: 'tenant-1' },
            },
          },
        });
      mockDb.socialAccount.update.mockResolvedValue({});
      mockDb.socialAccount.findUnique.mockResolvedValue({
        id: 'sa-1',
        metadata: { activityLock: { type: 'posting', jobId: 'job-5' } },
      });
      mockDb.scheduledPost.update.mockResolvedValue({});
      mockDb.contentItem.update.mockResolvedValue({});
      mockDb.$transaction.mockResolvedValue([]);

      startPostingWorker();

      const result = await processor({
        id: 'job-5',
        name: 'posting:publish',
        data: {
          scheduledPostId: 'sp-1',
          contentId: 'content-1',
          channelId: 'chan-1',
          platform: 'youtube',
        },
        opts: { attempts: 3 },
        attemptsMade: 0,
        updateProgress: vi.fn(),
      });

      expect(result).toEqual(
        expect.objectContaining({
          scheduledPostId: 'sp-1',
          status: 'posted',
          platformPostId: 'yt-video-123',
        }),
      );
    });
  });
});
