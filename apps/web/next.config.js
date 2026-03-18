/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@airevstream/shared',
    '@airevstream/db',
    '@airevstream/queue',
    '@airevstream/crypto',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bullmq'],
  },
};

module.exports = nextConfig;
