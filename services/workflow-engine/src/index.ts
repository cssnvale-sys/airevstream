import { buildApp } from './app.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('workflow-engine');
const PORT = parseInt(
  process.env.WORKFLOW_ENGINE_PORT ?? process.env.PORT ?? '3011',
  10,
);

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Workflow engine listening on port ${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info('Shutting down workflow engine...');
    await app.close();
    logger.info('Workflow engine stopped');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start workflow engine');
  process.exit(1);
});
