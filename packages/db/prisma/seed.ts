import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync, createCipheriv } from 'node:crypto';

const prisma = new PrismaClient();

// ─── Helpers ───

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function encryptPassword(password: string): string {
  const keyHex = process.env.ENCRYPTION_KEY ?? randomBytes(32).toString('hex');
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

// ─── Main Seed ───

async function main() {
  console.log('Seeding database...');

  // ─── 1. Admin User ───
  const admin = await prisma.user.upsert({
    where: { email: 'admin@airevstream.local' },
    update: {},
    create: {
      email: 'admin@airevstream.local',
      passwordHash: hashPassword('changeme123'),
      name: 'Admin',
      role: 'admin',
    },
  });
  console.log(`  User: ${admin.email} (${admin.id})`);

  // ─── 2. AI Services ───
  const ollamaText = await prisma.aiService.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'ollama-qwen3',
      provider: 'ollama',
      serviceType: 'text',
      endpoint: 'http://localhost:11434',
      capabilities: { defaultModel: 'qwen3:8b', models: ['qwen3:8b', 'llama3.1:8b', 'mistral:7b'] },
      rateLimits: { maxConcurrent: 2, cooldownMs: 0 },
      costPerUnit: {},
      status: 'active',
      healthScore: 100,
      fallbackOrder: 0,
      fallbackGroup: 'text_gen',
      isLocal: true,
      isFree: true,
    },
  });
  console.log(`  AI Service: ${ollamaText.name} (${ollamaText.id})`);

  const comfyui = await prisma.aiService.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'comfyui-local',
      provider: 'comfyui',
      serviceType: 'image',
      endpoint: 'http://localhost:8188',
      capabilities: { workflows: ['thumbnail', 'scenery', 'avatar', 'storyboard-frame'] },
      rateLimits: { maxConcurrent: 1, cooldownMs: 5000 },
      costPerUnit: {},
      status: 'active',
      healthScore: 100,
      fallbackOrder: 0,
      fallbackGroup: 'image_gen',
      isLocal: true,
      isFree: true,
    },
  });
  console.log(`  AI Service: ${comfyui.name} (${comfyui.id})`);

  // OpenAI as fallback text provider (placeholder - needs API key)
  const openai = await prisma.aiService.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'openai-gpt4o-mini',
      provider: 'openai',
      serviceType: 'text',
      endpoint: 'https://api.openai.com/v1',
      capabilities: { defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o'] },
      rateLimits: { maxConcurrent: 5, requestsPerMinute: 60 },
      costPerUnit: { inputPerToken: 0.00000015, outputPerToken: 0.0000006 },
      status: 'disabled',
      healthScore: 100,
      fallbackOrder: 10,
      fallbackGroup: 'text_gen',
      isLocal: false,
      isFree: false,
    },
  });
  console.log(`  AI Service: ${openai.name} (disabled, needs API key)`);

  // ─── 3. Sample Email Account ───
  const emailAccount = await prisma.emailAccount.upsert({
    where: { email: 'demo@airevstream.example' },
    update: {},
    create: {
      email: 'demo@airevstream.example',
      passwordEnc: encryptPassword('demo-password-123'),
      status: 'active',
      tier: 'tier1',
      notes: 'Demo account for development',
    },
  });
  console.log(`  Email Account: ${emailAccount.email}`);

  // ─── 4. Sample Social Account ───
  const socialAccount = await prisma.socialAccount.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      emailAccountId: emailAccount.id,
      platform: 'youtube',
      username: 'DemoChannel',
      status: 'active',
      healthScore: 95,
    },
  });
  console.log(`  Social Account: @${socialAccount.username} (${socialAccount.platform})`);

  // ─── 5. Sample Channel ───
  const channel = await prisma.channel.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      socialAccountId: socialAccount.id,
      name: 'TechVerse',
      niches: ['technology', 'AI', 'gadgets'],
      primaryLanguage: 'en',
      tone: 'Enthusiastic and knowledgeable, like explaining tech to a curious friend',
      personality: 'Tech-savvy early adopter who makes complex topics accessible',
      targetAudience: 'Tech enthusiasts 18-35, early adopters, curious learners',
      status: 'active',
      postingCadence: { minDaily: 1, maxDaily: 3, bestTimes: ['09:00', '14:00', '19:00'] },
    },
  });
  console.log(`  Channel: ${channel.name}`);

  // ─── 6. Cinema Bible for channel ───
  await prisma.cinemaBible.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      channelId: channel.id,
      version: 1,
      lookBible: {
        styleRefs: ['cyberpunk', 'clean-tech'],
        lighting: 'High-key with neon accent lighting',
        grain: 'minimal',
        lensKit: ['35mm', '85mm'],
        aspectRatio: '16:9',
      },
      characterBible: {
        identityAnchors: { gender: 'neutral', age: '25-30', style: 'modern casual' },
        wardrobe: ['tech branded hoodie', 'minimalist tee'],
        neverChangeList: ['voice pitch', 'speaking pace', 'hand gestures'],
      },
      environmentBible: {
        locationMotifs: ['home studio', 'futuristic lab', 'city rooftop'],
        timeOfDayRules: { default: 'evening', outdoor: 'golden hour' },
      },
      promptBible: {
        globalStyle: 'cinematic, high production value, modern tech aesthetic',
        negativeBlock: 'blurry, low quality, deformed, watermark, text overlay',
      },
    },
  });
  console.log(`  Cinema Bible: v1 for ${channel.name}`);

  // ─── 7. Sample Content Items ───
  const contentItems = [
    {
      id: '00000000-0000-0000-0000-000000000040',
      channelId: channel.id,
      title: 'AI in 2026: What Changed Everything',
      contentType: 'video_short',
      contentPurpose: 'entertainment',
      status: 'pending_approval',
      aiServiceId: ollamaText.id,
      qualityScore: 8.2,
    },
    {
      id: '00000000-0000-0000-0000-000000000041',
      channelId: channel.id,
      title: '5 Gadgets That Will Blow Your Mind',
      contentType: 'video_long',
      contentPurpose: 'entertainment',
      status: 'approved',
      aiServiceId: ollamaText.id,
      qualityScore: 7.5,
    },
    {
      id: '00000000-0000-0000-0000-000000000042',
      channelId: channel.id,
      title: 'Best Budget Laptop 2026',
      contentType: 'text',
      contentPurpose: 'affiliate',
      status: 'posted',
      aiServiceId: ollamaText.id,
      qualityScore: 9.0,
    },
    {
      id: '00000000-0000-0000-0000-000000000043',
      channelId: channel.id,
      title: 'Coding with AI Assistants',
      contentType: 'video_short',
      contentPurpose: 'educational',
      status: 'generating',
      aiServiceId: ollamaText.id,
    },
    {
      id: '00000000-0000-0000-0000-000000000044',
      channelId: channel.id,
      title: 'Why Privacy Matters in the AI Age',
      contentType: 'video_long',
      contentPurpose: 'educational',
      status: 'draft',
    },
  ];

  for (const item of contentItems) {
    await prisma.contentItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }
  console.log(`  Content Items: ${contentItems.length} created`);

  // ─── 8. Sample Affiliate Product ───
  const product = await prisma.affiliateProduct.upsert({
    where: { id: '00000000-0000-0000-0000-000000000050' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000050',
      name: 'NordVPN Annual Plan',
      url: 'https://nordvpn.com/airevstream',
      salesAngle: 'Protect your privacy while streaming and browsing. Special deal for our viewers.',
      commissionRate: 40.0,
      category: 'VPN',
      brand: 'NordVPN',
      status: 'active',
    },
  });
  console.log(`  Affiliate Product: ${product.name}`);

  // Assign product to channel pool
  await prisma.channelAffiliatePool.upsert({
    where: {
      channelId_affiliateProductId: {
        channelId: channel.id,
        affiliateProductId: product.id,
      },
    },
    update: {},
    create: {
      channelId: channel.id,
      affiliateProductId: product.id,
      performanceScore: 85.0,
    },
  });
  console.log(`  Affiliate Pool: ${product.name} → ${channel.name}`);

  // ─── 9. System Metrics (sample) ───
  const metrics = [
    { metricType: 'cpu', value: 35.2, unit: 'percent' },
    { metricType: 'ram', value: 62.1, unit: 'percent' },
    { metricType: 'disk', value: 45.0, unit: 'percent' },
    { metricType: 'queue_depth', value: 3, unit: 'count' },
  ];

  for (const m of metrics) {
    await prisma.systemMetric.create({
      data: m,
    });
  }
  console.log(`  System Metrics: ${metrics.length} created`);

  // ─── 10. Knowledge Base Entries ───
  const kbEntries = [
    {
      domain: 'platform_ops',
      category: 'best_practices',
      title: 'YouTube Shorts Best Practices',
      content: 'Keep videos under 60 seconds. Use vertical format (9:16). Hook viewers in first 2 seconds. Add captions. Use trending audio.',
      relevanceScore: 9.0,
    },
    {
      domain: 'comfyui',
      category: 'workflows',
      title: 'SDXL Thumbnail Generation',
      content: 'Use SDXL with refiner for thumbnails. Resolution: 1024x576. Steps: 25. CFG: 7. Sampler: euler_ancestral.',
      relevanceScore: 8.5,
    },
  ];

  for (const entry of kbEntries) {
    await prisma.knowledgeBaseEntry.create({ data: entry });
  }
  console.log(`  Knowledge Base: ${kbEntries.length} entries`);

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
