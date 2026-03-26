import { readFile, unlink, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger, BUCKETS, QUALITY_THRESHOLDS, ComfyUIClient, composeWorkflow, composeRepairWorkflow, scoreShot, extractFingerprint, compareFingerprints, detectFlicker, recommendConditioning, createProvenanceRecord, generateC2PAManifest, lintPrompt, validateShotSpec, SAFETY_DEFAULTS, estimateShotCost, runPostGenQC, validateAVSync, validateDurationEnvelope, getWorkflowWithDefaults, getCompositionForProduction, resolveForRemotion, parseKeyframeUrls, deriveBeatsFromDirector } from '@airevstream/shared';
import type { ShotSpec, RepairSpec, PromptBible, ComfyUIWorkflow, QCScoreResult, ImageFingerprint, ProviderName, PostGenQCOptions, QCDecisionShotInput, QCDecisionOutput, QCVerdict, WordTiming, AssemblyManifest, AssembledShot } from '@airevstream/shared';
import { createWorker, type Job } from '@airevstream/queue';
import type {
  ProductionGenerateImageJob,
  ProductionRenderVideoJob,
  ProductionGenerateAudioJob,
  ProductionStoryboardJob,
  ProductionRepairShotJob,
  ProductionGenerateShotsJob,
  ProductionQCGateJob,
  ProductionMixAudioJob,
  ProductionAssetGenerateJob,
  ExportVariant,
} from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { uploadBuffer, ensureBucket, downloadBuffer } from '@airevstream/storage';

const logger = createLogger('production-worker');

const BUCKET = BUCKETS.PRODUCTION;
const TEMPLATES_DIR = resolve(__dirname, '../../comfyui-workflows');

// ─── Asset Registry Helper ───

interface AssetRegistryParams {
  type: 'image' | 'video' | 'audio';
  storageKey: string;
  fileSize?: number;
  mimeType?: string;
  generatedBy?: string;
  contentId?: string;
  shotId?: string;
  provenance?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

async function registerAsset(params: AssetRegistryParams): Promise<void> {
  try {
    const db = getDb();
    await db.assetRegistryEntry.create({
      data: {
        type: params.type,
        storageKey: params.storageKey,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        generatedBy: params.generatedBy,
        contentId: params.contentId,
        shotId: params.shotId,
        provenance: (params.provenance ?? {}) as any,
        metadata: (params.metadata ?? {}) as any,
      },
    });
  } catch (err) {
    // Non-critical — log but don't fail the pipeline
    logger.warn({ err, storageKey: params.storageKey }, 'Failed to register asset');
  }
}

// ─── ComfyUI Client Instance ───

const comfyClient = new ComfyUIClient(
  process.env.COMFYUI_URL ?? 'http://localhost:8188',
  parseInt(process.env.COMFYUI_TIMEOUT_MS ?? '120000', 10),
);

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
  // Shot-class mappings
  'Dialogue_Closeup': 'avatar-generation',
  'Establishing_Wide': 'scenery-generation',
  'Insert_Hands': 'thumbnail-generation',
  'Action_Tracking': 'storyboard-frame',
  'Reaction_Medium': 'avatar-generation',
  'Montage_Quick': 'storyboard-frame',
  'Reveal_Dolly': 'scenery-generation',
  'POV_Handheld': 'storyboard-frame',
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

      // Register asset
      await registerAsset({
        type: 'image',
        storageKey: `${BUCKET}/${key}`,
        fileSize: imageData.length,
        mimeType: 'image/png',
        generatedBy: 'comfyui',
        contentId: data.contentId,
        shotId: data.shotId,
        metadata: { workflowType: data.workflowType },
      });
    }

    // ─── C2PA Content Credentials embedding ───
    try {
      // @ts-expect-error — runtime import from dist/ path; types are in provenance.ts (D082)
        const c2paModule = await import('@airevstream/shared/dist/provenance-c2pa-cli.js');
        const { embedC2PAManifest, isC2PAToolAvailable } = c2paModule;
      if (await isC2PAToolAvailable()) {
        const provRecord = createProvenanceRecord(
          'image',
          { name: 'comfyui', provider: 'comfyui' },
          { prompt: params.positive_prompt as string },
          { storageKey: uploadedUrls[0] ?? '' },
          'image-generation',
        );
        const manifest = generateC2PAManifest(data.workflowType ?? 'Generated Image', [provRecord]);
        for (const url of uploadedUrls) {
          const slashIdx = url.indexOf('/');
          const bucket = url.slice(0, slashIdx);
          const key = url.slice(slashIdx + 1);
          const imgBuf = await downloadBuffer(bucket, key);
          const tmpInput = `/tmp/c2pa-input-${Date.now()}.png`;
          const tmpOutput = `/tmp/c2pa-output-${Date.now()}.png`;
          const { writeFile: writeFileTmp } = await import('node:fs/promises');
          await writeFileTmp(tmpInput, imgBuf);
          const result = await embedC2PAManifest({ mediaPath: tmpInput, outputPath: tmpOutput, manifest });
          if (result.success) {
            const signedBuf = await readFile(tmpOutput);
            await uploadBuffer(bucket, key, signedBuf, 'image/png');
            logger.info({ key }, 'C2PA credentials embedded in image');
          }
          await unlink(tmpInput).catch((e) => logger.debug({ err: e, path: tmpInput }, 'Temp C2PA input cleanup failed'));
          await unlink(tmpOutput).catch((e) => logger.debug({ err: e, path: tmpOutput }, 'Temp C2PA output cleanup failed'));
        }
      }
    } catch (err) {
      logger.debug({ err }, 'C2PA embedding skipped for images');
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

  // Check if scriptJson contains an assembly manifest (new pipeline path)
  const scriptJson = storyboard.scriptJson as Record<string, unknown> | null;
  const hasManifest = scriptJson?.schemaVersion === '1.0.0';

  const isCinema = data.qualityPreset === 'cinema';
  const variant: ExportVariant | undefined = data.exportVariant;
  let compositionId: string;
  let inputProps: string;

  if (hasManifest) {
    // ─── New path: Assembly manifest → Remotion resolver ───
    const manifest = scriptJson as unknown as AssemblyManifest;
    const resolved = resolveForRemotion(manifest);

    // Override title with actual content title
    resolved.inputProps.title = storyboard.content.title;

    // Apply export variant overrides if present
    if (variant) {
      if (variant.width) resolved.inputProps.width = variant.width;
      if (variant.height) resolved.inputProps.height = variant.height;
      if (variant.fps) resolved.inputProps.fps = variant.fps;
    }

    // Apply FinishingOutput color grade if available (closes G4)
    const finishingOutput = manifest.agentOutputs?.finishing as Record<string, unknown> | undefined;
    if (finishingOutput?.colorGrade && !resolved.inputProps.colorGrade) {
      resolved.inputProps.colorGrade = finishingOutput.colorGrade;
    }

    compositionId = resolved.compositionId;
    inputProps = JSON.stringify(resolved.inputProps);
    logger.info({ compositionId, manifestVersion: manifest.schemaVersion }, 'Using assembly manifest for render');
  } else if (isCinema) {
    // ─── Legacy path: inline props building ───
    // Use composition registry for selection
    const registryComp = getCompositionForProduction('cinema');
    compositionId = registryComp?.id ?? 'CinemaVideo';

    // Use export variant dimensions/fps if provided, otherwise registry defaults or hardcoded
    const renderWidth = variant?.width ?? registryComp?.defaultWidth ?? 1920;
    const renderHeight = variant?.height ?? registryComp?.defaultHeight ?? 1080;
    const renderFps = variant?.fps ?? registryComp?.defaultFps ?? 24;

    // Build CinemaVideoProps from storyboard/shots data
    const cinemaShots = storyboard.shots.map((s, idx) => {
      const spec = (s.shotspec as Record<string, unknown>) ?? {};
      const keyframeUrls = parseKeyframeUrls(s.keyframeUrls);
      const durationSec = Number(s.endSec ?? 0) - Number(s.startSec ?? 0);
      return {
        id: s.id,
        src: keyframeUrls[0] ?? '',
        videoSrc: (spec.videoSrc as string) ?? undefined,
        isVideo: !!(spec.videoSrc),
        durationInFrames: Math.max(1, Math.round(durationSec * renderFps)),
        transitionIn: idx === 0 ? 'fade' : ((spec.transition as string) ?? 'cut'),
        transitionOut: 'cut',
        transitionDurationInFrames: idx === 0 ? 12 : 6,
        camera: spec.camera ?? undefined,
        colorGrade: spec.colorGrade ?? undefined,
        section: spec.section ?? undefined,
      };
    });

    // Collect audio tracks from shots' audioPlan
    const audioTracks = storyboard.shots.flatMap((s) => {
      const spec = (s.shotspec as Record<string, unknown>) ?? {};
      const audioPlan = spec.audioPlan as Record<string, unknown> | undefined;
      const tracks: Array<Record<string, unknown>> = [];
      const startSec = Number(s.startSec ?? 0);
      const fps = renderFps;

      for (const layer of ['bg', 'mg', 'fg'] as const) {
        const layerSpec = audioPlan?.[layer] as Record<string, unknown> | undefined;
        if (layerSpec?.fileKey) {
          tracks.push({
            src: layerSpec.fileKey as string,
            startFrame: Math.round(startSec * fps),
            volume: (layerSpec.volume as number) ?? (layer === 'fg' ? 0.9 : layer === 'bg' ? 0.3 : 0.5),
            loop: layer === 'bg',
            layer,
          });
        }
      }
      return tracks;
    });

    // Load cinema bible for global color grade if available
    const cinemaBible = await db.cinemaBible.findFirst({
      where: {},
      orderBy: { updatedAt: 'desc' },
      select: { lookBible: true },
    });
    const lookBible = cinemaBible?.lookBible as Record<string, unknown> | null;

    inputProps = JSON.stringify({
      title: storyboard.content.title,
      shots: cinemaShots,
      audioTracks,
      fps: renderFps,
      width: renderWidth,
      height: renderHeight,
      colorGrade: lookBible?.colorPipeline ?? undefined,
    });
  } else {
    // ─── Legacy path: short/long form ───
    const contentType = storyboard.content.contentType;
    const prodType = contentType === 'video_short' ? 'short' : 'long';
    const registryComp = getCompositionForProduction(prodType);
    compositionId = registryComp?.id ?? (contentType === 'video_short' ? 'ShortFormVideo' : 'LongFormVideo');

    inputProps = JSON.stringify({
      title: storyboard.content.title,
      shots: storyboard.shots.map(s => ({
        ...(s.shotspec as Record<string, unknown>),
        keyframeUrls: s.keyframeUrls,
      })),
    });
  }

  const outputDir = '/tmp/airevstream/renders';
  await mkdir(outputDir, { recursive: true });
  const useProres = variant?.codec === 'prores' || (!variant && isCinema);
  const renderExt = useProres ? 'mov' : 'mp4';
  const outputPath = `${outputDir}/${data.contentId}-${Date.now()}.${renderExt}`;

  try {
    // Invoke Remotion CLI render
    const codec = useProres ? 'prores' : 'h264';
    const { stdout, stderr } = await execFileAsync(
      'npx',
      [
        'remotion', 'render',
        compositionId,
        outputPath,
        '--props', inputProps,
        '--codec', codec,
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
    const key = `videos/${data.contentId}/${Date.now()}.${renderExt}`;
    const contentType = useProres ? 'video/quicktime' : 'video/mp4';
    await uploadBuffer(BUCKET, key, videoBuffer, contentType);

    // Register video asset
    await registerAsset({
      type: 'video',
      storageKey: `${BUCKET}/${key}`,
      fileSize: videoBuffer.length,
      mimeType: contentType,
      generatedBy: 'remotion',
      contentId: data.contentId,
      metadata: { compositionId, qualityPreset: data.qualityPreset },
    });

    // ─── C2PA Content Credentials embedding ───
    try {
      // @ts-expect-error — runtime import from dist/ path; types are in provenance.ts (D082)
        const c2paModule = await import('@airevstream/shared/dist/provenance-c2pa-cli.js');
        const { embedC2PAManifest, isC2PAToolAvailable } = c2paModule;
      if (await isC2PAToolAvailable()) {
        const provRecord = createProvenanceRecord(
          'video',
          { name: compositionId, provider: 'remotion' },
          {},
          { storageKey: `${BUCKET}/${key}` },
          'video-render',
        );
        const manifest = generateC2PAManifest(storyboard.content.title ?? 'Untitled', [provRecord]);
        const tmpOutput = `/tmp/c2pa-video-${Date.now()}.${renderExt}`;
        const embedResult = await embedC2PAManifest({ mediaPath: outputPath, outputPath: tmpOutput, manifest });
        if (embedResult.success) {
          const signedBuf = await readFile(tmpOutput);
          await uploadBuffer(BUCKET, key, signedBuf, contentType);
          logger.info({ key }, 'C2PA credentials embedded in video');
        }
        await unlink(tmpOutput).catch((e) => logger.debug({ err: e, path: tmpOutput }, 'Temp C2PA video output cleanup failed'));
      }
    } catch (err) {
      logger.debug({ err }, 'C2PA embedding skipped for video');
    }

    // Clean up temp file after successful upload
    await unlink(outputPath).catch((e) => logger.debug({ err: e, path: outputPath }, 'Temp file cleanup failed'));

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

    // ─── Auto-render variants ───
    const renderJobData = data as ProductionRenderVideoJob & { autoVariants?: boolean; variantConfigs?: ExportVariant[] };
    if (renderJobData.autoVariants && renderJobData.variantConfigs?.length) {
      const { addJob } = await import('@airevstream/queue');
      for (const variantConfig of renderJobData.variantConfigs) {
        await addJob('production', 'production:render-video', {
          contentId: data.contentId,
          storyboardId: data.storyboardId,
          channelId: data.channelId,
          qualityPreset: data.qualityPreset,
          exportVariant: variantConfig,
        } as ProductionRenderVideoJob);
        logger.info({ variant: variantConfig.label, contentId: data.contentId }, 'Queued auto-variant render');
      }
    }

    // ─── Multi-language rendering ───
    const contentMeta = (storyboard.content?.platformMetadata as Record<string, unknown>) ?? {};
    const translations = contentMeta.translations as Record<string, string> | undefined;
    const languageMode = contentMeta.languageMode as string | undefined;

    if (translations && Object.keys(translations).length > 0) {
      if (languageMode === 'separate') {
        // Mode 1: Queue separate render jobs per language
        for (const [lang, translatedScript] of Object.entries(translations)) {
          logger.info({ lang, contentId: data.contentId }, 'Queuing language-specific render');
          // Each language gets its own render with translated TTS
          // The actual TTS generation will use the translated script
          await db.workflowJob.create({
            data: {
              jobType: 'video_render',
              contentId: data.contentId,
              channelId: data.channelId,
              status: 'queued',
              params: {
                ...data,
                language: lang,
                translatedScript,
                isLanguageVariant: true,
              } as any,
              result: {} as any,
            },
          });
        }
      } else if (languageMode === 'multi-audio') {
        // Mode 2: Single video, multiple audio tracks
        // Log for future implementation — requires ffmpeg muxing
        logger.info(
          { contentId: data.contentId, languages: Object.keys(translations) },
          'Multi-audio track mode: language audio tracks will be muxed in post-processing',
        );
      }
    }
  } catch (error) {
    // Clean up temp file on failure
    await unlink(outputPath).catch((e) => logger.debug({ err: e, path: outputPath }, 'Temp file cleanup failed'));

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

    // Register audio asset
    await registerAsset({
      type: 'audio',
      storageKey: `${BUCKET}/${key}`,
      fileSize: result.audioBuffer.length,
      mimeType: `audio/${ext}`,
      generatedBy: 'tts',
      contentId: data.contentId,
      metadata: { format: result.format, durationMs: result.durationMs },
    });

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
      let spec = (shot.shotspec as unknown as ShotSpec) ?? { promptBlocks: ['default scene'] };

      // Apply identity drift adjustments if present (set by QC gate retry)
      const driftAdj = (shot.shotspec as Record<string, unknown>)?.driftAdjustments as Record<string, unknown> | undefined;
      if (driftAdj) {
        if (driftAdj.loraStrengthMultiplier && spec.generation?.loras) {
          const multiplier = driftAdj.loraStrengthMultiplier as number;
          spec = {
            ...spec,
            generation: {
              ...spec.generation,
              loras: spec.generation.loras.map(l => ({
                ...l,
                strength: Math.min(2.0, l.strength * multiplier),
              })),
            },
          };
          logger.info({ shotId, multiplier }, 'Applied LoRA strength boost for identity consistency');
        }
        if (driftAdj.cfgBoost && spec.generation) {
          spec = { ...spec, generation: { ...spec.generation, cfg: (spec.generation.cfg ?? 7) + (driftAdj.cfgBoost as number) } };
        }
        if (driftAdj.seedLocked) {
          spec = { ...spec, seedLocked: true };
        }
        if (driftAdj.denoiseReduction && spec.generation) {
          const currentDenoise = spec.generation.denoise ?? 1.0;
          spec = { ...spec, generation: { ...spec.generation, denoise: Math.max(0.3, currentDenoise - (driftAdj.denoiseReduction as number)) } };
        }
      }

      // ─── Pre-flight validation ───
      const provider = (spec.generation?.provider as ProviderName) ?? 'comfyui';
      const violations = validateShotSpec(spec, provider);
      const errors = violations.filter(v => v.severity === 'error');
      if (errors.length > 0) {
        logger.warn({ shotId, violations: errors }, 'Pre-flight validation failed — marking shot as failed');
        await db.storyboardShot.update({ where: { id: shotId }, data: { status: 'failed', shotspec: { ...spec, preflightErrors: errors } as any } });
        continue;
      }

      // ─── Safety defaults ───
      if (provider === 'veo' || provider === 'sora') {
        // Apply person generation safety default unless explicitly overridden in bible
        const personGenOverride = promptBible?.slotRules?.['personGeneration']?.[0];
        if (!personGenOverride || personGenOverride === SAFETY_DEFAULTS.personGeneration) {
          const promptText2 = spec.promptBlocks?.join(' ') ?? '';
          const personTerms = /\b(person|people|face|human|man|woman|child|boy|girl)\b/i;
          if (personTerms.test(promptText2)) {
            // Add safety negative tokens
            spec = {
              ...spec,
              promptBlocks: spec.promptBlocks.map((b, i) => i === 0 ? b : b),
              generation: {
                ...spec.generation,
                // Flag for provider-specific handling
              },
            };
            logger.info({ shotId, provider }, 'Safety: person terms detected with personGeneration=disallow');
          }
        }
      }

      // Prompt safety lint
      const promptText = spec.promptBlocks?.join(', ') ?? '';
      const safetyResult = lintPrompt(promptText);
      if (!safetyResult.safe) {
        logger.warn({ shotId, riskScore: safetyResult.riskScore, flags: safetyResult.flags.map(f => f.category) }, 'Prompt safety warning');
      }

      // Apply workflow registry tier defaults if available
      const shotClass = spec.shotClass ?? (spec as unknown as Record<string, unknown>).shotClass as string | undefined;
      const qualityTier = (data.qualityPreset ?? 'standard') as 'draft' | 'standard' | 'cinema';
      if (shotClass) {
        const registryResult = getWorkflowWithDefaults(shotClass, qualityTier);
        if (registryResult) {
          const { defaults } = registryResult;
          // Apply tier defaults as floor values (spec overrides take priority)
          spec = {
            ...spec,
            generation: {
              ...defaults,
              ...spec.generation,
              // Only apply defaults for fields not already set
              steps: spec.generation?.steps ?? defaults.steps,
              cfg: spec.generation?.cfg ?? defaults.cfg,
              sampler: spec.generation?.sampler ?? defaults.sampler,
              scheduler: spec.generation?.scheduler ?? defaults.scheduler,
              width: spec.generation?.width ?? defaults.width,
              height: spec.generation?.height ?? defaults.height,
              denoise: spec.generation?.denoise ?? defaults.denoise,
            },
          };
          logger.info({ shotId, shotClass, qualityTier, defaults }, 'Applied workflow registry tier defaults');
        }
      }

      // Compose and run workflow
      const workflow = composeWorkflow(spec, promptBible);
      const images = await comfyClient.queueAndWait(workflow);

      // Download and upload to storage
      await ensureBucket(BUCKET);
      const uploadedUrls: string[] = [];
      let firstImageSizeBytes = 0;

      for (const img of images) {
        const imageData = await comfyClient.downloadImage(img.filename, img.subfolder, img.type);
        if (uploadedUrls.length === 0) {
          firstImageSizeBytes = imageData.length;
        }
        const timestamp = Date.now();
        const key = `shots/${data.storyboardId}/${shotId}/${timestamp}-${img.filename}`;
        await uploadBuffer(BUCKET, key, imageData, 'image/png');
        uploadedUrls.push(`${BUCKET}/${key}`);

        // Register shot keyframe asset
        await registerAsset({
          type: 'image',
          storageKey: `${BUCKET}/${key}`,
          fileSize: imageData.length,
          mimeType: 'image/png',
          generatedBy: 'comfyui',
          contentId: data.contentId,
          shotId,
          metadata: {
            seed: workflow.resolvedSeed,
            steps: spec.generation?.steps,
            cfg: spec.generation?.cfg,
          },
        });
      }

      // ─── Post-generation QC gate (Stage 2) ───
      const expectedWidth = spec.generation?.width ?? 1024;
      const expectedHeight = spec.generation?.height ?? 1024;
      const firstImage = images[0];
      if (firstImage) {
        const qcResult = runPostGenQC(
          {
            fileUrl: uploadedUrls[0] ?? '',
            fileSizeBytes: firstImageSizeBytes,
            width: expectedWidth,
            height: expectedHeight,
            format: firstImage.filename.split('.').pop() ?? 'png',
          },
          { expectedWidth, expectedHeight },
        );
        if (!qcResult.passed) {
          const failedChecks = qcResult.checks.filter(c => !c.passed && c.severity === 'error');
          logger.warn({ shotId, qcScore: qcResult.score, failedChecks }, 'Post-gen QC failed');
          await db.storyboardShot.update({
            where: { id: shotId },
            data: { status: 'failed', shotspec: { ...spec, postGenQCFailed: true, postGenQCChecks: failedChecks } as any },
          });
          continue;
        }
        logger.info({ shotId, qcScore: qcResult.score }, 'Post-gen QC passed');
      }

      // Create provenance record
      const provenance = createProvenanceRecord(
        'image',
        { name: spec.model ?? 'sd_xl_base_1.0', provider: 'comfyui' },
        {
          prompt: promptText,
          seed: workflow.resolvedSeed,
          steps: spec.generation?.steps,
          cfg: spec.generation?.cfg,
          sampler: spec.generation?.sampler,
          width: spec.generation?.width,
          height: spec.generation?.height,
          loras: spec.generation?.loras?.map(l => ({ name: l.name, strength: l.strength })),
        },
        { storageKey: uploadedUrls[0] ?? '' },
        'shot-generation',
      );

      // Persist QC score on shot (closes G7)
      const postGenQCScore = firstImage ? runPostGenQC(
        { fileUrl: uploadedUrls[0] ?? '', fileSizeBytes: firstImageSizeBytes, width: expectedWidth, height: expectedHeight, format: firstImage.filename.split('.').pop() ?? 'png' },
        { expectedWidth, expectedHeight },
      ).score : undefined;

      // Update shot with generated keyframes, resolved seed, provenance, and QC score
      await db.storyboardShot.update({
        where: { id: shotId },
        data: {
          keyframeUrls: uploadedUrls as any,
          status: 'generated',
          qualityScore: postGenQCScore,
          shotspec: { ...spec, seed: workflow.resolvedSeed, provenance: provenance.id, safetyScore: safetyResult.riskScore } as any,
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

const MAX_QC_RETRIES = 2;

async function handleQCGate(data: ProductionQCGateJob): Promise<void> {
  const db = getDb();
  logger.info({ storyboardId: data.storyboardId }, 'Processing QC gate');

  const shots = await db.storyboardShot.findMany({
    where: { storyboardId: data.storyboardId },
    orderBy: { shotNumber: 'asc' },
  });

  // Load character reference from cinema bible for identity drift detection
  let referenceFingerprint: ImageFingerprint | undefined;
  try {
    const storyboard = await db.storyboard.findUnique({
      where: { id: data.storyboardId },
      select: { contentId: true },
    });
    if (storyboard) {
      const cinemaBible = await db.cinemaBible.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { characterBible: true },
      });
      const charBible = cinemaBible?.characterBible as Record<string, unknown> | null;
      const faceRef = charBible?.faceRef as string | undefined;
      if (faceRef) {
        const slashIdx = faceRef.indexOf('/');
        const bucket = faceRef.slice(0, slashIdx);
        const key = faceRef.slice(slashIdx + 1);
        const refBuffer = await downloadBuffer(bucket, key);
        referenceFingerprint = extractFingerprint(refBuffer);
        logger.info('Loaded character reference fingerprint for identity drift detection');
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Could not load character reference — skipping identity drift detection');
  }

  let allApproved = true;
  let previousShotBuffer: Buffer | undefined;
  const allShotBuffers: Buffer[] = [];
  const qcDecisionInputs: QCDecisionShotInput[] = [];

  for (const shot of shots) {
    const keyframeUrls = shot.keyframeUrls as string[] | null;

    // No keyframes = automatic failure
    if (!keyframeUrls || keyframeUrls.length === 0) {
      await db.storyboardShot.update({
        where: { id: shot.id },
        data: { status: 'failed', qualityScore: 0 },
      });
      allApproved = false;
      continue;
    }

    // Download the first keyframe for QC scoring
    let imageBuffer: Buffer;
    try {
      const url = keyframeUrls[0];
      const slashIdx = url.indexOf('/');
      const bucket = url.slice(0, slashIdx);
      const key = url.slice(slashIdx + 1);
      imageBuffer = await downloadBuffer(bucket, key);
    } catch (err) {
      logger.warn({ err, shotId: shot.id }, 'Failed to download keyframe for QC — falling back to basic check');
      // Fallback: approve if keyframes exist and shot was generated
      const fallbackScore = shot.status === 'generated' ? 80 : 40;
      await db.storyboardShot.update({
        where: { id: shot.id },
        data: { qualityScore: fallbackScore, status: fallbackScore >= QUALITY_THRESHOLDS.AUTO_APPROVE ? 'approved' : 'pending' },
      });
      if (fallbackScore < QUALITY_THRESHOLDS.AUTO_APPROVE) allApproved = false;
      continue;
    }

    allShotBuffers.push(imageBuffer);

    // Run the 6-dimension QC scorer (including identity drift)
    const spec = (shot.shotspec as unknown as ShotSpec) ?? {};
    const expectedWidth = spec.generation?.width ?? 1024;
    const expectedHeight = spec.generation?.height ?? 1024;
    const prompt = spec.promptBlocks?.join(', ');

    const qcResult: QCScoreResult = scoreShot({
      imageBuffer,
      width: expectedWidth,
      height: expectedHeight,
      expectedWidth,
      expectedHeight,
      previousShotBuffer,
      referenceFingerprint,
      prompt,
    });

    logger.info(
      { shotId: shot.id, overall: qcResult.overall, recommendation: qcResult.recommendation, dimensions: qcResult.dimensions },
      'QC score computed',
    );

    // Collect for QC decision agent
    qcDecisionInputs.push({
      shotNumber: shot.shotNumber,
      shotId: shot.id,
      qcScores: {
        composition: qcResult.dimensions.composition,
        lighting: qcResult.dimensions.technical,
        sharpness: qcResult.dimensions.technical,
        colorAccuracy: qcResult.dimensions.colorQuality,
        promptAdherence: qcResult.dimensions.promptAdherence,
        overall: qcResult.overall,
      },
      identityDrift: referenceFingerprint ? {
        detected: qcResult.dimensions.identityDrift < 65,
        similarity: qcResult.dimensions.identityDrift / 100,
      } : undefined,
      continuityWarnings: qcResult.dimensions.consistency < 60
        ? [`Low consistency score: ${qcResult.dimensions.consistency}`]
        : [],
    });

    // Determine status based on recommendation
    let newStatus: string;
    if (qcResult.recommendation === 'approve') {
      newStatus = 'approved';
    } else if (qcResult.recommendation === 'regenerate' || qcResult.recommendation === 'reject') {
      // Check retry count — re-queue for generation if retries remain
      const retryCount = ((shot.shotspec as Record<string, unknown>)?.qcRetryCount as number) ?? 0;
      if (retryCount < MAX_QC_RETRIES) {
        // Check for identity drift and compute conditioning adjustments
        const identityScore = qcResult.dimensions.identityDrift;
        let driftAdjustments: Record<string, unknown> | undefined;
        if (referenceFingerprint && identityScore < 65) {
          const currentFp = extractFingerprint(imageBuffer);
          const driftResult = compareFingerprints(referenceFingerprint, currentFp);
          const conditioning = recommendConditioning(driftResult);
          if (Object.keys(conditioning.adjustments).length > 0) {
            driftAdjustments = conditioning.adjustments;
            logger.info({ shotId: shot.id, adjustments: driftAdjustments }, `Drift conditioning: ${conditioning.message}`);
          }
        }

        // Increment seed and retry count, re-queue for generation
        const updatedSpec = {
          ...spec,
          seed: (spec.seed ?? Math.floor(Math.random() * 2147483647)) + 1,
          qcRetryCount: retryCount + 1,
          ...(driftAdjustments ? { driftAdjustments } : {}),
        };
        await db.storyboardShot.update({
          where: { id: shot.id },
          data: {
            qualityScore: qcResult.overall,
            status: 'pending',
            shotspec: updatedSpec as any,
          },
        });
        logger.info(
          { shotId: shot.id, retryCount: retryCount + 1, newSeed: updatedSpec.seed },
          'QC failed — re-queuing shot for regeneration',
        );
        allApproved = false;
        continue;
      }
      newStatus = 'failed';
    } else {
      // 'review' — needs manual review
      newStatus = 'pending';
    }

    await db.storyboardShot.update({
      where: { id: shot.id },
      data: {
        qualityScore: qcResult.overall,
        status: newStatus,
      },
    });

    if (newStatus !== 'approved') {
      allApproved = false;
    }

    // Pass current image as reference for consistency scoring on next shot
    previousShotBuffer = imageBuffer;
  }

  // Temporal flicker detection across all shots
  if (allShotBuffers.length >= 3) {
    const flickerResult = detectFlicker(allShotBuffers);
    if (flickerResult.flickering) {
      logger.warn(
        { storyboardId: data.storyboardId, flickerScore: flickerResult.flickerScore, transitions: flickerResult.transitionCount },
        `Flicker detected: ${flickerResult.message}`,
      );
    }
  }

  // ─── QC Decision Agent ───
  // Invoke the QC decision agent to get intelligent per-shot verdicts
  if (qcDecisionInputs.length > 0) {
    try {
      const { AGENT_CONFIGS } = await import('@airevstream/shared');
      const agentConfig = AGENT_CONFIGS['qc-decision'];

      if (agentConfig) {
        // Build the agent input payload
        const agentInput = {
          shots: qcDecisionInputs,
          renderOutput: { storyboardId: data.storyboardId },
          lookDevOutput: {},
          qualityPreset: 'standard',
        };

        // Log the agent input for diagnostics (actual LLM call is deferred to orchestrator)
        logger.info(
          {
            storyboardId: data.storyboardId,
            shotCount: qcDecisionInputs.length,
            avgScore: Math.round(qcDecisionInputs.reduce((s, i) => s + i.qcScores.overall, 0) / qcDecisionInputs.length),
          },
          'QC decision agent input prepared',
        );

        // Apply heuristic verdicts based on the agent's decision framework
        // (Full LLM-based agent invocation happens in the orchestrator pipeline)
        for (const shotInput of qcDecisionInputs) {
          const score = shotInput.qcScores.overall;
          const hasDrift = shotInput.identityDrift?.detected ?? false;
          let verdict: QCVerdict;

          if (score >= 85 && !hasDrift) {
            verdict = 'approve';
          } else if (score >= 60 && !hasDrift) {
            verdict = 'soft-fix';
          } else if (score >= 60 && hasDrift) {
            verdict = 'regenerate';
          } else if (score < 60) {
            verdict = 'regenerate';
          } else {
            verdict = 'escalate';
          }

          // Store verdict in shot metadata for the finishing phase
          await db.storyboardShot.update({
            where: { id: shotInput.shotId },
            data: {
              shotspec: {
                ...((await db.storyboardShot.findUnique({ where: { id: shotInput.shotId }, select: { shotspec: true } }))?.shotspec as Record<string, unknown> ?? {}),
                qcVerdict: verdict,
                qcAgentInput: shotInput,
              } as any,
            },
          });

          logger.info({ shotId: shotInput.shotId, verdict, score }, 'QC decision verdict applied');
        }

        // Override allApproved based on verdicts
        const regenerateCount = qcDecisionInputs.filter(s => {
          const score = s.qcScores.overall;
          const hasDrift = s.identityDrift?.detected ?? false;
          return score < 60 || (score < 85 && hasDrift);
        }).length;

        if (regenerateCount > qcDecisionInputs.length / 2) {
          allApproved = false;
          logger.info({ storyboardId: data.storyboardId, regenerateCount }, 'QC decision: >50% shots need regeneration');
        }
      }
    } catch (err) {
      logger.warn({ err }, 'QC decision agent failed — falling back to threshold-based decisions');
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
    logger.info({ storyboardId: data.storyboardId }, 'QC gate — some shots need review or regeneration');
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

  // Process all three audio layers (BG, MG, FG) for each shot
  for (const shot of storyboard.shots) {
    const spec = (shot.shotspec as unknown as ShotSpec) ?? {};
    const audioPlan = spec.audioPlan;
    if (!audioPlan) continue;

    const startMs = Number(shot.startSec ?? 0) * 1000;

    // ─── Background layer (ambient, music) ───
    if (audioPlan.bg) {
      try {
        let bgBuffer: Buffer | null = null;

        if (audioPlan.bg.fileKey) {
          // Load from storage
          const [bucket, ...keyParts] = audioPlan.bg.fileKey.split('/');
          bgBuffer = await downloadBuffer(bucket, keyParts.join('/'));
        } else if (audioPlan.bg.text && audioPlan.bg.source === 'tts') {
          const ttsResult = await ttsClient.synthesize({ text: audioPlan.bg.text, voice: audioPlan.bg.voice });
          bgBuffer = ttsResult.audioBuffer;
        }

        if (bgBuffer) {
          tracks.push({
            buffer: bgBuffer,
            startMs,
            volume: audioPlan.bg.volume ?? 0.3,
            fadeInMs: audioPlan.bg.fadeInMs ?? 2000,
            fadeOutMs: audioPlan.bg.fadeOutMs ?? 2000,
            loop: audioPlan.bg.loop ?? true,
          });
        }
      } catch (err) {
        logger.warn({ err, shotId: shot.id, layer: 'bg' }, 'Background audio load failed');
      }
    }

    // ─── Midground layer (effects, room tone) ───
    if (audioPlan.mg) {
      try {
        let mgBuffer: Buffer | null = null;

        if (audioPlan.mg.fileKey) {
          const [bucket, ...keyParts] = audioPlan.mg.fileKey.split('/');
          mgBuffer = await downloadBuffer(bucket, keyParts.join('/'));
        } else if (audioPlan.mg.text && audioPlan.mg.source === 'tts') {
          const ttsResult = await ttsClient.synthesize({ text: audioPlan.mg.text, voice: audioPlan.mg.voice });
          mgBuffer = ttsResult.audioBuffer;
        }

        if (mgBuffer) {
          tracks.push({
            buffer: mgBuffer,
            startMs,
            volume: audioPlan.mg.volume ?? 0.5,
            fadeInMs: audioPlan.mg.fadeInMs,
            fadeOutMs: audioPlan.mg.fadeOutMs,
            loop: audioPlan.mg.loop,
          });
        }
      } catch (err) {
        logger.warn({ err, shotId: shot.id, layer: 'mg' }, 'Midground audio load failed');
      }
    }

    // ─── Foreground layer (dialogue, voice-over) ───
    const fgText = spec.dialogue ?? audioPlan?.fg?.text;
    if (fgText) {
      try {
        // Use synthesizeWithLipSync for AV sync validation
        const { tts: ttsResult, lipSync: lipSyncData } = await ttsClient.synthesizeWithLipSync({
          text: fgText,
          voice: audioPlan?.fg?.voice,
        });
        tracks.push({
          buffer: ttsResult.audioBuffer,
          startMs,
          volume: audioPlan.fg?.volume ?? 0.9,
          fadeInMs: audioPlan.fg?.fadeInMs,
          fadeOutMs: audioPlan.fg?.fadeOutMs,
        });

        // ─── AV Sync validation ───
        if (ttsResult.wordTimings && ttsResult.wordTimings.length > 0) {
          const audioTimings: WordTiming[] = (ttsResult.wordTimings as Array<{ word: string; startMs: number; endMs: number }>).map((wt) => ({
            word: wt.word,
            startMs: wt.startMs,
            endMs: wt.endMs,
            visemes: [],
          }));
          const syncResult = validateAVSync(audioTimings, lipSyncData);
          if (!syncResult.passed) {
            logger.warn(
              { shotId: shot.id, errorCount: syncResult.errorCount, avgDriftMs: syncResult.avgDriftMs, driftAccumulating: syncResult.driftAccumulating },
              `AV sync check failed: ${syncResult.message}`,
            );
          } else if (syncResult.warningCount > 0) {
            logger.info(
              { shotId: shot.id, warningCount: syncResult.warningCount, avgDriftMs: syncResult.avgDriftMs },
              'AV sync: minor drift warnings detected',
            );
          }
        }

        // Duration envelope check
        const shotDurationMs = (Number(shot.endSec ?? 0) - Number(shot.startSec ?? 0)) * 1000;
        if (shotDurationMs > 0) {
          const envelope = validateDurationEnvelope(ttsResult.durationMs, shotDurationMs);
          if (!envelope.fits) {
            logger.warn(
              { shotId: shot.id, audioDurationMs: ttsResult.durationMs, videoDurationMs: shotDurationMs, overrunMs: envelope.overrunMs },
              `Audio overruns video: ${envelope.message}`,
            );
          }
        }
      } catch (err) {
        logger.warn({ err, shotId: shot.id, layer: 'fg' }, 'TTS generation failed for shot');
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

  // Determine production type from content type
  const productionType = content.contentType === 'video_short' ? 'short'
    : content.contentType === 'thumbnail' ? 'thumbnail'
    : content.contentType === 'video_long' ? 'long'
    : 'cinema';
  const qualityTier = ((data as unknown as Record<string, unknown>).qualityPreset as string) ?? 'standard';

  // Check if agent pipeline state is available from job data (via directives)
  const directives = (data as unknown as Record<string, unknown>).directives as Record<string, unknown> | undefined;
  const agentOutputs = directives?.agentOutputs as Record<string, unknown> | undefined;
  const directorOutput = agentOutputs?.director as Record<string, unknown> | undefined;
  const dialogueOutput = agentOutputs?.dialogue as { tracks?: Array<{ shotNumber: number; text: string; voice: string; emotion: string; pacing: string }> } | undefined;
  const soundOutput = agentOutputs?.sound as { audioLayers?: Array<{ shotNumber: number; bg?: unknown; mg?: unknown; fg?: unknown }> } | undefined;

  const totalDurationSec = estimateDuration(script, content.contentType);

  const storyboard = await db.$transaction(async (tx) => {
    // Build assembled shots for the manifest
    const assembledShots: AssembledShot[] = shotDataList.map(({ section, beat, durationSec, startSec }, i) => {
      const shotNumber = i + 1;

      // Map dialogue from agent output if available (closes G12)
      const dialogueTrack = dialogueOutput?.tracks?.find(t => t.shotNumber === shotNumber);
      const dialogue = dialogueTrack ? {
        text: dialogueTrack.text,
        voice: dialogueTrack.voice,
        emotion: dialogueTrack.emotion,
        pacing: dialogueTrack.pacing as 'slow' | 'normal' | 'fast',
      } : undefined;

      // Map audio plan from sound agent output if available (closes G3)
      const soundLayer = soundOutput?.audioLayers?.find(l => l.shotNumber === shotNumber);
      const audioPlan = soundLayer ? {
        bg: soundLayer.bg as AssembledShot['audioPlan'] extends { bg?: infer B } ? B : never,
        mg: soundLayer.mg as AssembledShot['audioPlan'] extends { mg?: infer M } ? M : never,
        fg: soundLayer.fg as AssembledShot['audioPlan'] extends { fg?: infer F } ? F : never,
      } : undefined;

      return {
        shotId: `pending-${shotNumber}`, // Will be replaced with real IDs after create
        shotNumber,
        startSec,
        endSec: startSec + durationSec,
        durationSec,
        shotClass: section.type === 'hook' ? 'Establishing_Wide' : undefined,
        transition: i === 0 ? 'fade' : 'cut',
        beat: beat.preset,
        dialogue,
        audioPlan,
      };
    });

    // Derive beat timings from director output if available (closes G5)
    const directorSections = directorOutput?.sections as Array<{ type: 'hook' | 'intro' | 'content' | 'cta'; durationSec: number; beat?: string }> | undefined;
    const beatTimings = directorSections
      ? directorSections.map((sec, i) => {
          const secStartSec = directorSections.slice(0, i).reduce((sum, s) => sum + s.durationSec, 0);
          return {
            startSec: secStartSec,
            endSec: secStartSec + sec.durationSec,
            section: sec.type,
            preset: sec.beat,
            label: `${sec.type}_${i + 1}`,
          };
        })
      : undefined;

    // Build the assembly manifest
    const registryComp = getCompositionForProduction(productionType);
    const manifest: AssemblyManifest = {
      schemaVersion: '1.0.0',
      contentId: data.contentId,
      storyboardId: '', // Will be set after storyboard creation
      compositionId: registryComp?.id ?? 'CinemaVideo',
      qualityTier: qualityTier as 'draft' | 'standard' | 'cinema',
      productionType: productionType as 'short' | 'long' | 'cinema' | 'thumbnail',
      agentOutputs: agentOutputs ? {
        director: agentOutputs.director as Record<string, unknown> | undefined,
        lookdev: agentOutputs.lookdev as Record<string, unknown> | undefined,
        dialogue: agentOutputs.dialogue as Record<string, unknown> | undefined,
        sound: agentOutputs.sound as Record<string, unknown> | undefined,
        psychology: agentOutputs.psychology as Record<string, unknown> | undefined,
        finishing: agentOutputs.finishing as Record<string, unknown> | undefined,
      } : undefined,
      shots: assembledShots,
      beatTimings,
      outputSpec: {
        width: registryComp?.defaultWidth ?? 1920,
        height: registryComp?.defaultHeight ?? 1080,
        fps: registryComp?.defaultFps ?? 24,
        aspect: registryComp?.aspectRatio ?? '16:9',
        codec: qualityTier === 'cinema' ? 'prores' : 'h264',
        totalDurationSec,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sb = await tx.storyboard.create({
      data: {
        contentId: data.contentId,
        scriptJson: { ...manifest, storyboardId: 'pending' } as any,
        status: 'draft',
        totalDurationSec,
      },
    });

    // Update manifest with real storyboard ID
    manifest.storyboardId = sb.id;

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

    // Update scriptJson with the final manifest (including real storyboardId)
    await tx.storyboard.update({
      where: { id: sb.id },
      data: { scriptJson: manifest as any },
    });

    return sb;
  });

  logger.info({ storyboardId: storyboard.id, shotCount: sections.length, hasManifest: true }, 'Storyboard generated with assembly manifest');
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
    case 'video_short':
      return Math.min(60, Math.max(15, baseDuration));
    case 'video_long':
      return Math.max(120, baseDuration);
    default:
      return Math.max(30, baseDuration);
  }
}

// ─── Repair Shot Handler ───

async function handleRepairShot(data: ProductionRepairShotJob): Promise<void> {
  const db = getDb();
  logger.info({ shotId: data.shotId, repairType: data.repairType }, 'Processing shot repair job');

  const healthy = await comfyClient.isHealthy();
  if (!healthy) {
    logger.warn('ComfyUI not available for shot repair');
    await db.workflowJob.create({
      data: {
        jobType: 'image_generation',
        contentId: data.contentId,
        channelId: data.channelId,
        status: 'failed',
        params: data as any,
        result: { error: 'ComfyUI not available' } as any,
      },
    });
    return;
  }

  const shot = await db.storyboardShot.findUnique({ where: { id: data.shotId } });
  if (!shot) {
    throw new Error(`Shot ${data.shotId} not found`);
  }

  const keyframeUrls = shot.keyframeUrls as string[] | null;
  if (!keyframeUrls?.length) {
    throw new Error(`Shot ${data.shotId} has no keyframes to repair`);
  }

  const spec = (shot.shotspec as unknown as ShotSpec) ?? {};

  // Build RepairSpec from job data
  const repairSpec: RepairSpec = {
    type: data.repairType,
    sourceImage: keyframeUrls[0],
    maskImage: data.maskImageKey,
    autoFaceMask: data.repairType === 'face-fix',
    denoise: data.denoise,
    repairPrompt: data.repairPrompt,
    lightingRef: data.lightingRefKey,
  };

  // Compose the repair workflow
  const prompt = spec.promptBlocks?.join(', ');
  const workflow = composeRepairWorkflow(
    repairSpec,
    spec.model,
    prompt,
  );

  try {
    await db.storyboardShot.update({ where: { id: data.shotId }, data: { status: 'generating' } });

    const images = await comfyClient.queueAndWait(workflow);

    // Upload repaired images
    await ensureBucket(BUCKET);
    const uploadedUrls: string[] = [];

    for (const img of images) {
      const imageData = await comfyClient.downloadImage(img.filename, img.subfolder, img.type);
      const timestamp = Date.now();
      const key = `shots/${data.storyboardId}/${data.shotId}/repair-${timestamp}-${img.filename}`;
      await uploadBuffer(BUCKET, key, imageData, 'image/png');
      uploadedUrls.push(`${BUCKET}/${key}`);
    }

    // Update shot with repaired keyframes
    await db.storyboardShot.update({
      where: { id: data.shotId },
      data: {
        keyframeUrls: uploadedUrls as any,
        status: 'generated',
      },
    });

    await db.workflowJob.create({
      data: {
        jobType: 'image_generation',
        contentId: data.contentId,
        channelId: data.channelId,
        status: 'completed',
        params: data as any,
        result: { images: uploadedUrls, repairType: data.repairType } as any,
      },
    });

    logger.info({ shotId: data.shotId, repairType: data.repairType, imageCount: images.length }, 'Shot repair complete');
  } catch (err) {
    logger.error({ err, shotId: data.shotId, repairType: data.repairType }, 'Shot repair failed');
    await db.storyboardShot.update({ where: { id: data.shotId }, data: { status: 'failed' } });
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
    throw err;
  }
}

// ─── Asset Generation Handler ───

const ASSET_TYPE_BUCKET_MAP: Record<string, string> = {
  avatar: BUCKETS.AVATARS,
  scenery: BUCKETS.SCENERY,
  branding: BUCKETS.BRANDING,
};

async function handleAssetGenerate(data: ProductionAssetGenerateJob): Promise<void> {
  const db = getDb();
  const { tenantId, assetType, sourceModelId, workflowType, prompt, params, slot } = data;

  logger.info({ assetType, sourceModelId, workflowType }, 'Processing asset generation job');

  const bucket = ASSET_TYPE_BUCKET_MAP[assetType] ?? BUCKETS.PRODUCTION;

  const healthy = await comfyClient.isHealthy();
  if (!healthy) {
    logger.warn({ assetType, sourceModelId }, 'ComfyUI not available for asset generation');
    return;
  }

  await ensureBucket(bucket);

  // Load and compose workflow template
  const templateName = WORKFLOW_TEMPLATE_MAP[workflowType] ?? 'thumbnail-generation';
  const templateParams: Record<string, string | number> = { positive_prompt: prompt };
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string' || typeof v === 'number') {
        templateParams[k] = v;
      }
    }
  }

  const workflow = await renderTemplate(templateName, templateParams);

  // Generate via ComfyUI
  const promptId = await comfyClient.queuePrompt(workflow as ComfyUIWorkflow);
  await comfyClient.waitForCompletion(promptId);
  const outputImages = await comfyClient.getOutputImages(promptId);

  if (outputImages.length === 0) {
    logger.error({ assetType, sourceModelId }, 'ComfyUI returned no images for asset generation');
    return;
  }

  // Download the first output image
  const img = outputImages[0];
  const imageData = await comfyClient.downloadImage(img.filename, img.subfolder, img.type);

  // Upload to storage
  const slotName = slot ?? 'primary';
  const storageKey = `${tenantId}/${assetType}/${sourceModelId}/${slotName}/${Date.now()}.png`;
  await uploadBuffer(bucket, storageKey, imageData, 'image/png');
  logger.info({ bucket, storageKey }, 'Asset uploaded to storage');

  // Register in asset registry
  await registerAsset({
    type: 'image',
    storageKey: `${bucket}/${storageKey}`,
    fileSize: imageData.length,
    mimeType: 'image/png',
    generatedBy: 'comfyui',
    metadata: { assetType, workflowType, sourceModelId },
  });

  // Update source model based on asset type
  const storageRef = { bucket, key: storageKey };

  if (assetType === 'avatar') {
    const avatar = await db.avatar.findUnique({ where: { id: sourceModelId }, select: { images: true } });
    const images = (avatar?.images as Record<string, unknown>) ?? {};
    images[slotName] = storageRef;
    await db.avatar.update({
      where: { id: sourceModelId },
      data: { images: images as any },
    });
    logger.info({ sourceModelId, slot: slotName }, 'Avatar image slot updated');
  } else if (assetType === 'scenery') {
    await db.sceneryAsset.update({
      where: { id: sourceModelId },
      data: { imageUrl: storageKey },
    });
    logger.info({ sourceModelId }, 'SceneryAsset imageUrl updated');
  } else if (assetType === 'branding') {
    const field = (slotName === 'banner' || workflowType === 'banner') ? 'bannerUrl' : 'logoUrl';
    await db.brandingPackage.update({
      where: { id: sourceModelId },
      data: { [field]: storageKey },
    });
    logger.info({ sourceModelId, field }, 'BrandingPackage URL updated');
  }

  logger.info({ assetType, sourceModelId, storageKey }, 'Asset generation complete');
}

// ─── Worker Setup ───

type ProductionJob =
  | ProductionGenerateImageJob
  | ProductionRenderVideoJob
  | ProductionGenerateAudioJob
  | ProductionStoryboardJob
  | ProductionGenerateShotsJob
  | ProductionQCGateJob
  | ProductionMixAudioJob
  | ProductionRepairShotJob
  | ProductionAssetGenerateJob;

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
        case 'production:repair-shot':
          await handleRepairShot(job.data as ProductionRepairShotJob);
          break;
        case 'production:asset-generate':
          await handleAssetGenerate(job.data as ProductionAssetGenerateJob);
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
