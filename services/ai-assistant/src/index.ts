import { buildApp } from './app.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('ai-assistant');
const PORT = parseInt(process.env.PORT ?? '3003', 10);

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`AI assistant listening on port ${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info('Shutting down AI assistant...');
    await app.close();
    logger.info('AI assistant stopped');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start AI assistant');
  process.exit(1);
});
