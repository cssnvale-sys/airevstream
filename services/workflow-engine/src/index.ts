import { buildApp } from './app.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('workflow-engine');
const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Workflow engine listening on port ${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(err, 'Failed to start workflow engine');
  process.exit(1);
});
