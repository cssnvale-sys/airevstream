import { createLogger } from '@airevstream/shared';
import { startContentWorker } from './content.worker.js';
import { startAccountWorker } from './account.worker.js';
import { startPostingWorker } from './posting.worker.js';
import { startResearchWorker } from './research.worker.js';
import { startMaintenanceWorker } from './maintenance.worker.js';
import { startProductionWorker } from './production.worker.js';
import { startSeasoningWorker } from './account.worker.js';

const logger = createLogger('workers');

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
