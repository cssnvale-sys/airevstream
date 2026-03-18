module.exports = {
  apps: [
    {
      name: 'web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: { PORT: 3000, NODE_ENV: 'production' },
    },
    {
      name: 'workflow-engine',
      cwd: './services/workflow-engine',
      script: 'dist/index.js',
      env: { PORT: 3001, NODE_ENV: 'production' },
    },
    {
      name: 'production-pipeline',
      cwd: './services/production-pipeline',
      script: 'dist/index.js',
      env: { PORT: 3002, NODE_ENV: 'production' },
    },
    {
      name: 'ai-assistant',
      cwd: './services/ai-assistant',
      script: 'dist/index.js',
      env: { PORT: 3003, NODE_ENV: 'production' },
    },
    {
      name: 'worker-content',
      cwd: '.',
      script: 'dist/workers/content.worker.js',
    },
    {
      name: 'worker-account',
      cwd: '.',
      script: 'dist/workers/account.worker.js',
    },
    {
      name: 'worker-posting',
      cwd: '.',
      script: 'dist/workers/posting.worker.js',
    },
    {
      name: 'worker-research',
      cwd: '.',
      script: 'dist/workers/research.worker.js',
    },
    {
      name: 'worker-maintenance',
      cwd: '.',
      script: 'dist/workers/maintenance.worker.js',
    },
    {
      name: 'worker-production',
      cwd: '.',
      script: 'dist/workers/production.worker.js',
    },
  ],
};
