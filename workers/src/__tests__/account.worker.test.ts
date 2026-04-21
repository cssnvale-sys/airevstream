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

vi.mock('@airevstream/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  determineNextAction: vi.fn(),
  calculateNextSessionTime: vi.fn(() => new Date()),
  selectActivitiesForSession: vi.fn(() => ['browse', 'watch']),
  assessRisk: vi.fn(() => ({ level: 'low', score: 10, factors: [] })),
  DEFAULT_SEASONING_SCHEDULE: {
    phases: {
      phase_1: { durationDays: 3, minSessionMinutes: 5, maxSessionMinutes: 15, intensity: 'low' },
      phase_2: { durationDays: 5, minSessionMinutes: 10, maxSessionMinutes: 30, intensity: 'low' },
      phase_3: { durationDays: 7, minSessionMinutes: 15, maxSessionMinutes: 45, intensity: 'medium' },
      phase_4: { durationDays: 6, minSessionMinutes: 20, maxSessionMinutes: 60, intensity: 'medium' },
    },
  },
  SEASONING_RISK_THRESHOLDS: {},
  getNextPhase: vi.fn(() => 'phase_2'),
  getConfig: vi.fn(() => ({ ENCRYPTION_KEY: 'test-key-32-chars-long-xxxxxxxx' })),
}));

vi.mock('@airevstream/crypto', () => ({
  decrypt: vi.fn(() => 'decrypted-password'),
}));

vi.mock('@airevstream/browser-automation', () => ({
  BrowserContextManager: null,
  SessionManager: null,
  ProxyManager: null,
  createWorkflow: null,
  AccountProxyPinning: null,
  FingerprintStore: null,
}));

import { getDb } from '@airevstream/db';
import { createWorker, getQueue } from '@airevstream/queue';
import { startAccountWorker, startSeasoningWorker } from '../account.worker.js';

const mockDb = {
  emailAccount: {
    findUnique: vi.fn(),
  },
  socialAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  workflowJob: {
    create: vi.fn(),
    update: vi.fn(),
  },
  alert: {
    create: vi.fn(),
  },
  seasoningEnrollment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  seasoningCohort: {
    update: vi.fn(),
  },
  accountLifecycle: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
});

describe('account worker', () => {
  it('startAccountWorker creates a worker with concurrency 3', () => {
    startAccountWorker();
    expect(createWorker).toHaveBeenCalledWith(
      'account',
      expect.any(Function),
      expect.objectContaining({ concurrency: 3 }),
    );
  });

  it('startAccountWorker registers event handlers', () => {
    const mockWorker = { on: vi.fn() };
    (createWorker as ReturnType<typeof vi.fn>).mockReturnValue(mockWorker);

    startAccountWorker();

    const registeredEvents = mockWorker.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('completed');
    expect(registeredEvents).toContain('failed');
    expect(registeredEvents).toContain('error');
    expect(registeredEvents).toContain('stalled');
  });

  describe('account:create handler', () => {
    it('throws when browser automation is unavailable', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.emailAccount.findUnique.mockResolvedValue({
        id: 'email-1',
        email: 'test@example.com',
        passwordEnc: 'encrypted',
      });
      mockDb.workflowJob.create.mockResolvedValue({ id: 'wj-1' });
      mockDb.workflowJob.update.mockResolvedValue({});

      startAccountWorker();

      await expect(
        processor({
          id: 'job-1',
          name: 'account:create',
          data: { emailAccountId: 'email-1', platform: 'youtube' },
          updateProgress: vi.fn(),
        }),
      ).rejects.toThrow('Account creation requires browser automation which is not available');

      expect(mockDb.workflowJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });

    it('returns early if email account not found', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.emailAccount.findUnique.mockResolvedValue(null);

      startAccountWorker();

      const result = await processor({
        id: 'job-2',
        name: 'account:create',
        data: { emailAccountId: 'nonexistent', platform: 'youtube' },
        updateProgress: vi.fn(),
      });

      expect(result).toBeUndefined();
    });
  });

  describe('account:sync handler', () => {
    it('updates lastLoginAt in fallback mode', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.socialAccount.findUnique.mockResolvedValue({
        id: 'sa-1',
        platform: 'youtube',
        emailAccount: { email: 'test@example.com', passwordEnc: 'enc' },
      });
      mockDb.socialAccount.update.mockResolvedValue({});

      startAccountWorker();

      const result = await processor({
        id: 'job-3',
        name: 'account:sync',
        data: { socialAccountId: 'sa-1' },
        updateProgress: vi.fn(),
      });

      expect(result).toEqual({ socialAccountId: 'sa-1', status: 'synced' });
      expect(mockDb.socialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sa-1' },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('account:health-check handler', () => {
    it('updates health score for active account', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      mockDb.socialAccount.findUnique.mockResolvedValue({
        id: 'sa-1',
        platform: 'youtube',
        status: 'active',
        healthScore: 80,
        metadata: {},
        emailAccount: { email: 'test@example.com', passwordEnc: 'enc', tenantId: 'tenant-1' },
      });
      mockDb.socialAccount.update.mockResolvedValue({});

      startAccountWorker();

      const result = await processor({
        id: 'job-4',
        name: 'account:health-check',
        data: { socialAccountId: 'sa-1' },
        updateProgress: vi.fn(),
      });

      expect(result).toEqual(
        expect.objectContaining({
          socialAccountId: 'sa-1',
          healthy: true,
          healthScore: 81, // 80 + 1 for active account
        }),
      );
    });
  });

  describe('unknown job name', () => {
    it('does not throw for unknown job names', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      startAccountWorker();

      const result = await processor({
        id: 'job-x',
        name: 'account:nonexistent',
        data: {},
        updateProgress: vi.fn(),
      });

      expect(result).toBeUndefined();
    });
  });
});

describe('seasoning worker', () => {
  it('startSeasoningWorker creates a worker with concurrency 3', () => {
    startSeasoningWorker();
    expect(createWorker).toHaveBeenCalledWith(
      'seasoning',
      expect.any(Function),
      expect.objectContaining({ concurrency: 3 }),
    );
  });

  it('startSeasoningWorker registers repeatable check-due job', () => {
    const mockAdd = vi.fn().mockResolvedValue({});
    (getQueue as ReturnType<typeof vi.fn>).mockReturnValue({ add: mockAdd });
    (createWorker as ReturnType<typeof vi.fn>).mockReturnValue({ on: vi.fn() });

    startSeasoningWorker();

    expect(getQueue).toHaveBeenCalledWith('seasoning');
    expect(mockAdd).toHaveBeenCalledWith(
      'seasoning:check-due',
      expect.any(Object),
      expect.objectContaining({
        repeat: { every: 15 * 60 * 1000 },
      }),
    );
  });

  describe('seasoning:enroll handler', () => {
    it('creates enrollment and queues signup', async () => {
      let processor: (job: unknown) => Promise<unknown> = async () => ({});
      (createWorker as ReturnType<typeof vi.fn>).mockImplementation((_name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn;
        return { on: vi.fn() };
      });

      const mockAdd = vi.fn().mockResolvedValue({});
      (getQueue as ReturnType<typeof vi.fn>).mockReturnValue({ add: mockAdd });

      mockDb.seasoningEnrollment.create.mockResolvedValue({ id: 'enroll-1' });
      mockDb.seasoningCohort.update.mockResolvedValue({});

      startSeasoningWorker();

      const result = await processor({
        id: 'job-5',
        name: 'seasoning:enroll',
        data: { cohortId: 'cohort-1', emailAccountId: 'email-1', platform: 'youtube', tenantId: 'tenant-1' },
        updateProgress: vi.fn(),
      });

      expect(mockDb.seasoningEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cohortId: 'cohort-1',
            emailAccountId: 'email-1',
            platform: 'youtube',
            status: 'pending',
          }),
        }),
      );

      expect(mockDb.seasoningCohort.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalAccounts: { increment: 1 } },
        }),
      );

      expect(result).toEqual({ enrollmentId: 'enroll-1' });
    });
  });
});
