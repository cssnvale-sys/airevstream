import { buildApp } from './app.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('production-pipeline');
const PORT = parseInt(
  process.env.PRODUCTION_PIPELINE_PORT ?? process.env.PORT ?? '3002',
  10,
);

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Production pipeline listening on port ${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info('Shutting down production pipeline...');
    await app.close();
    logger.info('Production pipeline stopped');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start production pipeline');
  process.exit(1);
});
