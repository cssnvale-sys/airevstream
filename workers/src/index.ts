import { createLogger } from '@airevstream/shared';
import { startContentWorker } from './content.worker.js';
import { startAccountWorker } from './account.worker.js';
import { startPostingWorker } from './posting.worker.js';
import { startResearchWorker } from './research.worker.js';
import { startMaintenanceWorker } from './maintenance.worker.js';
import { startProductionWorker } from './production.worker.js';
import { startSeasoningWorker } from './account.worker.js';
import { startExperimentWorker } from './experiment.worker.js';
import { startLifecycleWorker } from './lifecycle.worker.js';

const logger = createLogger('workers');

// Nine workers each register a SIGTERM/SIGINT exit listener via BullMQ's Worker.
// Node's default limit is 10, which triggers MaxListenersExceededWarning and
// masks a real leak behind a cosmetic one. Bump to a sane ceiling.
process.setMaxListeners(20);

// Previously, an unhandled rejection or uncaught exception inside a BullMQ
// processor could terminate the workers process without any log output,
// leaving jobs stuck in `active` with stale locks. Log with full stack before
// Node exits so the next silent death has evidence.
process.on('uncaughtException', (err) => {
  logger.fatal({ err, stack: err?.stack }, 'Uncaught exception — workers process will exit');
  // Give pino a moment to flush, then exit non-zero so a supervisor can restart.
  setTimeout(() => process.exit(1), 100).unref();
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err, stack: err.stack }, 'Unhandled promise rejection in workers');
  // Don't kill the process on unhandled rejection — BullMQ job failures surface
  // here and should be caught by the per-queue failed handler, not exit the host.
});

async function main() {
  logger.info('Starting all workers...');

  const workers = [
    startContentWorker(),
    startAccountWorker(),
    startPostingWorker(),
    startResearchWorker(),
    startMaintenanceWorker(),
    startProductionWorker(),
    startSeasoningWorker(),
    startExperimentWorker(),
    startLifecycleWorker(),
  ];

  logger.info(`All ${workers.length} workers started`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.allSettled(workers.map((w) => {
      try { return w.close(); } catch (err) { logger.error(err, 'Error closing worker'); return Promise.resolve(); }
    }));
    logger.info('All workers stopped');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start workers');
  process.exit(1);
});
