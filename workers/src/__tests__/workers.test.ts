import { describe, it, expect } from 'vitest';
import { startContentWorker } from '../content.worker.js';
import { startAccountWorker } from '../account.worker.js';
import { startPostingWorker } from '../posting.worker.js';
import { startResearchWorker } from '../research.worker.js';
import { startMaintenanceWorker } from '../maintenance.worker.js';

describe('workers', () => {
  it('exports startContentWorker', () => {
    expect(typeof startContentWorker).toBe('function');
  });

  it('exports startAccountWorker', () => {
    expect(typeof startAccountWorker).toBe('function');
  });

  it('exports startPostingWorker', () => {
    expect(typeof startPostingWorker).toBe('function');
  });

  it('exports startResearchWorker', () => {
    expect(typeof startResearchWorker).toBe('function');
  });

  it('exports startMaintenanceWorker', () => {
    expect(typeof startMaintenanceWorker).toBe('function');
  });
});
