import { createLogger } from '@airevstream/shared';
import { startContentWorker } from './content.worker.js';
import { startAccountWorker } from './account.worker.js';
import { startPostingWorker } from './posting.worker.js';
import { startResearchWorker } from './research.worker.js';
import { startMaintenanceWorker } from './maintenance.worker.js';

const logger = createLogger('workers');

async function main() {
  logger.info('Starting all workers...');

  const workers = [
    startContentWorker(),
    startAccountWorker(),
    startPostingWorker(),
    startResearchWorker(),
    startMaintenanceWorker(),
  ];

  logger.info(`All ${workers.length} workers started`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all(workers.map((w) => w.close()));
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
