import { readFile, unlink, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger, BUCKETS, QUALITY_THRESHOLDS, ComfyUIClient, composeWorkflow } from '@airevstream/shared';
import type { ShotSpec, PromptBible, ComfyUIWorkflow } from '@airevstream/shared';
import { createWorker, type Job } from '@airevstream/queue';
import type {
  ProductionGenerateImageJob,
  ProductionRenderVideoJob,
  ProductionGenerateAudioJob,
  ProductionStoryboardJob,
} from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { uploadBuffer, ensureBucket } from '@airevstream/storage';

const logger = createLogger('production-worker');

const BUCKET = BUCKETS.PRODUCTION;
const TEMPLATES_DIR = resolve(__dirname, '../../comfyui-workflows');

// ─── ComfyUI Client Instance ───

const comfyClient = new ComfyUIClient(
  process.env.COMFYUI_URL ?? 'http://localhost:8188',
  parseInt(process.env.COMFYUI_TIMEOUT_MS ?? '120000', 10),
);

// ─── Temporary Types (until Phase 3 adds them to @airevstream/queue) ───

interface ProductionGenerateShotsJob {
  storyboardId: string;
  shotIds: string[];
  cinemaBibleId: string;
  qualityPreset: string;
  contentId: string;
  channelId: string;
}

interface ProductionQCGateJob {
  storyboardId: string;
  contentId: string;
}

interface ProductionMixAudioJob {
  storyboardId: string;
  contentId: string;
}

// ─── Template Renderer ───

const WORKFLOW_TEMPLATE_MAP: Record<string, string> = {
  character: 'avatar-generation',
  avatar: 'avatar-generation',
  environment: 'scenery-generation',
  scenery: 'scenery-generation',
  thumbnail: 'thumbnail-generation',
  style: 'thumbnail-generation',
  storyboard: 'storyboard-frame',
  frame: 'storyboard-frame',
  upscale: 'thumbnail-generation',
};

async function renderTemplate(
  templateName: string,
  params: Record<string, string | number>,
): Promise<Record<string, unknown>> {
  const templatePath = resolve(TEMPLATES_DIR, `${templateName}.json`);
  const raw = await readFile(templatePath, 'utf-8');

  const rendered = raw.replace(
    /\{\{(\w+)(?:\|([^}]*))?\}\}/g,
    (_match, name: string, defaultValue?: string) => {
      if (name in params) return String(params[name]);
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Missing required template parameter: ${name}`);
    },
  );

  return JSON.parse(rendered) as Record<string, unknown>;
}

// ─── Image Generation Handler ───

async function handleGenerateImage(data: ProductionGenerateImageJob): Promise<void> {
  const db = getDb();
  logger.info({ workflowType: data.workflowType, shotId: data.shotId }, 'Processing image generation job');

  const healthy = await comfyClient.isHealthy();

  if (!healthy) {
    logger.info('ComfyUI not available — recording placeholder job');
    if (data.contentId) {
      await db.workflowJob.create({
        data: {
          jobType: 'image_generation',
          contentId: data.contentId,
          channelId: data.channelId,
          status: 'queued',
          params: data as any,
          result: { placeholder: true, reason: 'ComfyUI not available' } as any,
        },
      });
    }
    return;
  }

  // Determine template name
  const templateName = WORKFLOW_TEMPLATE_MAP[data.workflowType] ?? 'thumbnail-generation';

  // Build template params from job data
  const params: Record<string, string | number> = {};
  if (data.params) {
    for (const [k, v] of Object.entries(data.params)) {
      if (typeof v === 'string' || typeof v === 'number') {
        params[k] = v;
      }
    }
  }

  // Load channel context for better prompts
  if (data.channelId) {
    const channel = await db.channel.findUnique({
      where: { id: data.channelId },
      select: { name: true, niches: true, primaryLanguage: true },
    });
    if (channel) {
      params.channel_name = channel.name;
      if (!params.positive_prompt) {
        params.positive_prompt = `high quality, professional, ${channel.niches.join(', ')}`;
      }
    }
  }

  // Render the template
  const workflow = await renderTemplate(templateName, params);

  // Generate images via ComfyUI
  try {
    const promptId = await comfyClient.queuePrompt(workflow as ComfyUIWorkflow);
    await comfyClient.waitForCompletion(promptId);
    const outputImages = await comfyClient.getOutputImages(promptId);

    // Download and upload to storage
    await ensureBucket(BUCKET);
    const uploadedUrls: string[] = [];

    for (const img of outputImages) {
      const imageData = await comfyClient.downloadImage(img.filename, img.subfolder, img.type);
      const timestamp = Date.now();
      const key = `images/${data.workflowType}/${data.shotId ?? data.contentId ?? 'misc'}/${timestamp}-${img.filename}`;
      await uploadBuffer(BUCKET, key, imageData, 'image/png');
      uploadedUrls.push(`${BUCKET}/${key}`);
      logger.info({ key }, 'Image uploaded to storage');
    }

    // Update storyboard shot if shotId provided
    if (data.shotId) {
      await db.storyboardShot.update({
        where: { id: data.shotId },
        data: {
          keyframeUrls: uploadedUrls as any,
          status: 'generated',
        },
      });
    }

    // Record workflow job
    if (data.contentId) {
      await db.workflowJob.create({
        data: {
          jobType: 'image_generation',
          contentId: data.contentId,
          channelId: data.channelId,
          status: 'completed',
          params: data as any,
          result: { images: uploadedUrls } as any,
        },
      });
    }

    logger.info({ imageCount: outputImages.length, uploadedUrls }, 'Image generation complete');
  } catch (err) {
    logger.error({ err, workflowType: data.workflowType, shotId: data.shotId }, 'ComfyUI image generation failed');
    if (data.contentId) {
      await db.workflowJob.create({
        data: {
          jobType: 'image_generation',
          contentId: data.contentId,
          channelId: data.channelId,
          status: 'failed',
          params: data as any,
          result: { error: err instanceof Error ? err.message : String(err) } as any,
        },
      });
    }
    throw err;
  }
}

// ─── Video Render Handler ───

const execFileAsync = promisify(execFile);
const REMOTION_DIR = resolve(__dirname, '../../remotion');

async function handleRenderVideo(data: ProductionRenderVideoJob): Promise<void> {
  const db = getDb();
  logger.info({ contentId: data.contentId, storyboardId: data.storyboardId }, 'Processing video render job');

  // Update storyboard status
  await db.storyboard.update({
    where: { id: data.storyboardId },
    data: { status: 'in_production' },
  });

  // Load storyboard data for render
  const storyboard = await db.storyboard.findUnique({
    where: { id: data.storyboardId },
    include: {
      shots: { orderBy: { shotNumber: 'asc' } },
      content: { select: { contentType: true, title: true, platformMetadata: true } },
    },
  });

  if (!storyboard) {
    throw new Error(`Storyboard ${data.storyboardId} not found`);
  }

  // Determine composition based on content type
  const compositionId = storyboard.content.contentType === 'short_video'
    ? 'ShortFormVideo'
    : 'LongFormVideo';

  // Build input props for Remotion
  const inputProps = JSON.stringify({
    title: storyboard.content.title,
    shots: storyboard.shots.map(s => ({
      ...(s.shotspec as Record<string, unknown>),
      keyframeUrls: s.keyframeUrls,
    })),
  });

  const outputDir = '/tmp/airevstream/renders';
  await mkdir(outputDir, { recursive: true });
  const outputPath = `${outputDir}/${data.contentId}-${Date.now()}.mp4`;

  try {
    // Invoke Remotion CLI render
    const { stdout, stderr } = await execFileAsync(
      'npx',
      [
        'remotion', 'render',
        compositionId,
        outputPath,
        '--props', inputProps,
        '--codec', 'h264',
        '--log', 'error',
      ],
      {
        cwd: REMOTION_DIR,
        timeout: 600_000, // 10 min max
        env: { ...process.env, NODE_ENV: 'production' },
      },
    );

    if (stderr && !stderr.includes('Rendered')) {
      logger.warn({ stderr: stderr.slice(0, 500) }, 'Remotion render warnings');
    }

    // Upload rendered video to storage
    await ensureBucket(BUCKET);
    const videoBuffer = await readFile(outputPath);
    const key = `videos/${data.contentId}/${Date.now()}.mp4`;
    await uploadBuffer(BUCKET, key, videoBuffer, 'video/mp4');

    // Clean up temp file after successful upload
    await unlink(outputPath).catch(() => {});

    // Update storyboard with result
    await db.storyboard.update({
      where: { id: data.storyboardId },
      data: { status: 'approved' },
    });

    await db.workflowJob.create({
      data: {
        jobType: 'video_render',
        contentId: data.contentId,
        channelId: data.channelId,
        status: 'completed',
        params: data as any,
        result: { videoUrl: `${BUCKET}/${key}`, compositionId } as any,
      },
    });

    logger.info({ key, compositionId, stdout: stdout?.slice(0, 200) }, 'Video render complete');
  } catch (error) {
    // Clean up temp file on failure
    await unlink(outputPath).catch(() => {});

    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ error: msg }, 'Remotion render failed');

    await db.workflowJob.create({
      data: {
        jobType: 'video_render',
        contentId: data.contentId,
        channelId: data.channelId,
        status: 'failed',
        params: data as any,
        result: { error: msg } as any,
      },
    });

    throw error;
  }
}

// ─── Audio Generation Handler ───

async function handleGenerateAudio(data: ProductionGenerateAudioJob): Promise<void> {
  const db = getDb();
  logger.info({ contentId: data.contentId, textLength: data.text.length }, 'Processing audio generation job');

  let ttsClient: any;
  try {
    const { TTSClient } = await import('@airevstream/audio-engine');
    ttsClient = new TTSClient();
  } catch {
    logger.warn('Audio engine not available — recording placeholder');
    await db.workflowJob.create({
      data: {
        jobType: 'audio_generation',
        contentId: data.contentId,
        status: 'queued',
        params: data as any,
        result: { placeholder: true, reason: 'Audio engine not available' } as any,
      },
    });
    return;
  }

  try {
    const result = await ttsClient.synthesize({
      text: data.text,
      voice: data.voice,
      language: data.language,
    });

    // Upload to storage
    await ensureBucket(BUCKET);
    const ext = result.format === 'mp3' ? 'mp3' : 'wav';
    const key = `audio/${data.contentId}/${Date.now()}.${ext}`;
    await uploadBuffer(BUCKET, key, result.audioBuffer, `audio/${ext}`);

    await db.workflowJob.create({
      data: {
        jobType: 'audio_generation',
        contentId: data.contentId,
        status: 'completed',
        params: data as any,
        result: {
          audioUrl: `${BUCKET}/${key}`,
          format: result.format,
          durationMs: result.durationMs,
        } as any,
      },
    });

    logger.info({ key, durationMs: result.durationMs }, 'Audio generation complete');
  } catch (err) {
    logger.error({ err, contentId: data.contentId }, 'Audio generation failed');
    await db.workflowJob.create({
      data: {
        jobType: 'audio_generation',
        contentId: data.contentId,
        status: 'failed',
        params: data as any,
        result: { error: err instanceof Error ? err.message : String(err) } as any,
      },
    });
    throw err;
  }
}

// ─── Cinema Shot Generation Handler ───

async function handleShotGeneration(data: ProductionGenerateShotsJob): Promise<void> {
  const db = getDb();
  logger.info({ storyboardId: data.storyboardId, shotCount: data.shotIds.length }, 'Processing cinema shot generation');

  const healthy = await comfyClient.isHealthy();
  if (!healthy) {
    logger.warn('ComfyUI not available for shot generation');
    return;
  }

  // Load cinema bible
  const bible = await db.cinemaBible.findUnique({ where: { id: data.cinemaBibleId } });
  const promptBible = (bible?.promptBible as PromptBible | null) ?? undefined;

  // Process each shot
  for (const shotId of data.shotIds) {
    const shot = await db.storyboardShot.findUnique({ where: { id: shotId } });
    if (!shot) {
      logger.warn({ shotId }, 'Shot not found, skipping');
      continue;
    }

    await db.storyboardShot.update({ where: { id: shotId }, data: { status: 'generating' } });

    try {
      const spec = (shot.shotspec as unknown as ShotSpec) ?? { promptBlocks: ['default scene'] };

      // Compose and run workflow
      const workflow = composeWorkflow(spec, promptBible);
      const images = await comfyClient.queueAndWait(workflow);

      // Download and upload to storage
      await ensureBucket(BUCKET);
      const uploadedUrls: string[] = [];

      for (const img of images) {
        const imageData = await comfyClient.downloadImage(img.filename, img.subfolder, img.type);
        const timestamp = Date.now();
        const key = `shots/${data.storyboardId}/${shotId}/${timestamp}-${img.filename}`;
        await uploadBuffer(BUCKET, key, imageData, 'image/png');
        uploadedUrls.push(`${BUCKET}/${key}`);
      }

      // Update shot with generated keyframes and resolved seed
      await db.storyboardShot.update({
        where: { id: shotId },
        data: {
          keyframeUrls: uploadedUrls as any,
          status: 'generated',
          shotspec: { ...spec, seed: workflow.resolvedSeed } as any,
        },
      });

      logger.info({ shotId, imageCount: images.length }, 'Shot generated successfully');
    } catch (err) {
      logger.error({ err, shotId }, 'Shot generation failed');
      await db.storyboardShot.update({ where: { id: shotId }, data: { status: 'failed' } });
    }
  }
}

// ─── QC Gate Handler ───

async function handleQCGate(data: ProductionQCGateJob): Promise<void> {
  const db = getDb();
  logger.info({ storyboardId: data.storyboardId }, 'Processing QC gate');

  const shots = await db.storyboardShot.findMany({
    where: { storyboardId: data.storyboardId },
    orderBy: { shotNumber: 'asc' },
  });

  let allApproved = true;

  for (const shot of shots) {
    const keyframeUrls = shot.keyframeUrls as string[] | null;

    // Simple QC: check that the shot has keyframes
    if (!keyframeUrls || keyframeUrls.length === 0) {
      await db.storyboardShot.update({
        where: { id: shot.id },
        data: { status: 'failed' },
      });
      allApproved = false;
      continue;
    }

    // Score based on whether the shot was generated successfully
    const score = shot.status === 'generated' ? 90 : 40;
    const qualityScore = score;

    await db.storyboardShot.update({
      where: { id: shot.id },
      data: {
        qualityScore,
        status: qualityScore >= QUALITY_THRESHOLDS.AUTO_APPROVE
          ? 'approved'
          : qualityScore <= QUALITY_THRESHOLDS.AUTO_REJECT
            ? 'failed'
            : 'pending',
      },
    });

    if (qualityScore < QUALITY_THRESHOLDS.AUTO_APPROVE) {
      allApproved = false;
    }
  }

  // Update storyboard status
  if (allApproved) {
    await db.storyboard.update({
      where: { id: data.storyboardId },
      data: { status: 'approved' },
    });
    logger.info({ storyboardId: data.storyboardId }, 'QC gate passed — all shots approved');
  } else {
    logger.info({ storyboardId: data.storyboardId }, 'QC gate — some shots need review');
  }
}

// ─── Audio Mix Handler ───

async function handleMixAudio(data: ProductionMixAudioJob): Promise<void> {
  const db = getDb();
  logger.info({ storyboardId: data.storyboardId }, 'Processing audio mix');

  const storyboard = await db.storyboard.findUnique({
    where: { id: data.storyboardId },
    include: {
      shots: { orderBy: { shotNumber: 'asc' } },
    },
  });

  if (!storyboard) {
    throw new Error(`Storyboard ${data.storyboardId} not found`);
  }

  // Check if audio engine is available
  let AudioMixer: any;
  let TTSClient: any;
  try {
    const audioEngine = await import('@airevstream/audio-engine');
    AudioMixer = audioEngine.AudioMixer;
    TTSClient = audioEngine.TTSClient;
  } catch {
    logger.warn('Audio engine not available — skipping audio mix');
    return;
  }

  const mixer = new AudioMixer();
  const ttsClient = new TTSClient();
  const tracks: Array<{ buffer: Buffer; startMs: number; volume: number; fadeInMs?: number; fadeOutMs?: number; loop?: boolean }> = [];

  // Generate TTS for each shot's foreground audio
  for (const shot of storyboard.shots) {
    const spec = (shot.shotspec as unknown as ShotSpec) ?? {};
    const audioPlan = spec.audioPlan;

    if (audioPlan?.fg?.text) {
      try {
        const ttsResult = await ttsClient.synthesize({
          text: audioPlan.fg.text,
          voice: audioPlan.fg.voice,
        });
        tracks.push({
          buffer: ttsResult.audioBuffer,
          startMs: Number(shot.startSec ?? 0) * 1000,
          volume: audioPlan.fg.volume ?? 0.9,
          fadeInMs: audioPlan.fg.fadeInMs,
          fadeOutMs: audioPlan.fg.fadeOutMs,
        });
      } catch (err) {
        logger.warn({ err, shotId: shot.id }, 'TTS generation failed for shot');
      }
    }
  }

  if (tracks.length === 0) {
    logger.info('No audio tracks to mix');
    return;
  }

  try {
    const mixResult = await mixer.mix({
      tracks: tracks.map(t => ({
        buffer: t.buffer,
        startMs: t.startMs,
        volume: t.volume,
        fadeInMs: t.fadeInMs,
        fadeOutMs: t.fadeOutMs,
        loop: t.loop,
      })),
      outputFormat: 'wav',
      totalDurationMs: Number(storyboard.totalDurationSec ?? 60) * 1000,
    });

    // Upload mixed audio
    await ensureBucket(BUCKETS.AUDIO);
    const key = `mixes/${data.contentId}/${Date.now()}.wav`;
    await uploadBuffer(BUCKETS.AUDIO, key, mixResult.buffer, 'audio/wav');

    logger.info({ key, durationMs: mixResult.durationMs }, 'Audio mix complete');
  } catch (err) {
    logger.error({ err }, 'Audio mix failed');
    throw err;
  }
}

// ─── Storyboard Generation Handler ───

async function handleGenerateStoryboard(data: ProductionStoryboardJob): Promise<void> {
  const db = getDb();
  logger.info({ contentId: data.contentId }, 'Processing storyboard generation job');

  const content = await db.contentItem.findUnique({
    where: { id: data.contentId },
    select: { title: true, platformMetadata: true, beatTags: true, contentType: true },
  });

  if (!content) {
    throw new Error(`Content item ${data.contentId} not found`);
  }

  // Parse script into sections based on H.I.C.C. markers
  const metadata = content.platformMetadata as Record<string, unknown> | null;
  const script = (metadata?.script as string) ?? '';
  const sections = parseScriptSections(script);

  // Create storyboard + shots in a transaction for atomicity
  const beatTags = (content.beatTags as Array<{ section: string; preset: string }>) ?? [];

  // Pre-compute shot data
  const shotDataList = sections.map((section, i) => {
    const beat = beatTags.find((b) => b.section === section.type) ?? { preset: 'CALM' };
    const durationSec = Math.max(3, Math.round(section.text.split(/\s+/).length / 2.5));
    const startSec = sections.slice(0, i).reduce((sum, s) => sum + Math.max(3, Math.round(s.text.split(/\s+/).length / 2.5)), 0);
    return { section, beat, durationSec, startSec };
  });

  const storyboard = await db.$transaction(async (tx) => {
    const sb = await tx.storyboard.create({
      data: {
        contentId: data.contentId,
        scriptJson: data.scriptJson as any,
        status: 'draft',
        totalDurationSec: estimateDuration(script, content.contentType),
      },
    });

    await tx.storyboardShot.createMany({
      data: shotDataList.map(({ section, beat, durationSec, startSec }, i) => ({
        storyboardId: sb.id,
        shotNumber: i + 1,
        startSec,
        endSec: startSec + durationSec,
        shotspec: {
          section: section.type,
          text: section.text,
          visualDescription: `${beat.preset.toLowerCase()} mood, ${section.type} section`,
          cameraMotion: section.type === 'hook' ? 'zoom-in' : 'slow-pan',
          transition: i === 0 ? 'fade' : 'cut',
        } as any,
        status: 'pending',
      })),
    });

    return sb;
  });

  logger.info({ storyboardId: storyboard.id, shotCount: sections.length }, 'Storyboard generated');
}

// ─── Helpers ───

interface ScriptSection {
  type: 'hook' | 'intro' | 'content' | 'cta';
  text: string;
}

function parseScriptSections(script: string): ScriptSection[] {
  if (!script) {
    return [{ type: 'content', text: 'No script provided' }];
  }

  const sections: ScriptSection[] = [];
  const markers: Array<{ pattern: RegExp; type: ScriptSection['type'] }> = [
    { pattern: /\[?HOOK\]?:?\s*/i, type: 'hook' },
    { pattern: /\[?INTRO(?:DUCTION)?\]?:?\s*/i, type: 'intro' },
    { pattern: /\[?CONTENT\]?:?\s*/i, type: 'content' },
    { pattern: /\[?CTA\]?:?\s*|(?:CALL[\s-]TO[\s-]ACTION):?\s*/i, type: 'cta' },
  ];

  let remaining = script;
  let lastType: ScriptSection['type'] = 'hook';

  for (const { pattern, type } of markers) {
    const match = remaining.match(pattern);
    if (match && match.index !== undefined) {
      const before = remaining.slice(0, match.index).trim();
      if (before) {
        sections.push({ type: lastType, text: before });
      }
      remaining = remaining.slice(match.index + match[0].length);
      lastType = type;
    }
  }

  if (remaining.trim()) {
    sections.push({ type: lastType, text: remaining.trim() });
  }

  // If no markers found, split into 4 equal parts
  if (sections.length <= 1) {
    const words = script.split(/\s+/);
    const chunkSize = Math.ceil(words.length / 4);
    const types: ScriptSection['type'][] = ['hook', 'intro', 'content', 'cta'];
    return types
      .map((type, i) => ({
        type,
        text: words.slice(i * chunkSize, (i + 1) * chunkSize).join(' '),
      }))
      .filter((s) => s.text.length > 0);
  }

  return sections;
}

function estimateDuration(script: string, contentType: string): number {
  const wordCount = script.split(/\s+/).length;
  const wordsPerSecond = 2.5;
  const baseDuration = Math.ceil(wordCount / wordsPerSecond);

  switch (contentType) {
    case 'short_video':
      return Math.min(60, Math.max(15, baseDuration));
    case 'long_video':
      return Math.max(120, baseDuration);
    default:
      return Math.max(30, baseDuration);
  }
}

// ─── Worker Setup ───

type ProductionJob =
  | ProductionGenerateImageJob
  | ProductionRenderVideoJob
  | ProductionGenerateAudioJob
  | ProductionStoryboardJob
  | ProductionGenerateShotsJob
  | ProductionQCGateJob
  | ProductionMixAudioJob;

export function startProductionWorker() {
  const worker = createWorker<'production'>(
    'production',
    async (job: Job<ProductionJob>) => {
      logger.info({ jobName: job.name, jobId: job.id }, 'Processing production job');

      switch (job.name) {
        case 'production:generate-image':
          await handleGenerateImage(job.data as ProductionGenerateImageJob);
          break;
        case 'production:render-video':
          await handleRenderVideo(job.data as ProductionRenderVideoJob);
          break;
        case 'production:generate-audio':
          await handleGenerateAudio(job.data as ProductionGenerateAudioJob);
          break;
        case 'production:generate-storyboard':
          await handleGenerateStoryboard(job.data as ProductionStoryboardJob);
          break;
        case 'production:generate-shots':
          await handleShotGeneration(job.data as ProductionGenerateShotsJob);
          break;
        case 'production:qc-gate':
          await handleQCGate(job.data as ProductionQCGateJob);
          break;
        case 'production:mix-audio':
          await handleMixAudio(job.data as ProductionMixAudioJob);
          break;
        default:
          logger.warn({ jobName: job.name }, 'Unknown production job type');
      }
    },
    { concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, error: err.message }, 'Production job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Production job completed');
  });

  logger.info('Production worker started');
  return worker;
}
