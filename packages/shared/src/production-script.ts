/**
 * Timecoded Production Script Generator
 *
 * Merges all 8 cinema agent outputs (Director, LookDev, ShotSpec, Dialogue,
 * Sound, Psychology, Finishing, QC) into a single unified second-by-second
 * master production script.
 *
 * This is the one document that contains every visual direction, camera move,
 * character blocking, dialogue line, background/foreground noise, SFX cue,
 * and on-screen text — all timestamped to the second.
 */

import type {
  TimecodedCue,
  TimecodedProductionScript,
  AssemblyManifest,
  AssembledShot,
} from './types.js';
import type {
  DirectorOutput,
  LookDevOutput,
  ShotSpecOutput,
  DialogueOutput,
  SoundOutput,
  PsychologyOutput,
  FinishingOutput,
} from './agents/agent-types.js';

// ─── Type Guards ───

function isDirectorOutput(o: unknown): o is DirectorOutput {
  return !!o && typeof o === 'object' && 'concept' in o && 'sections' in o;
}

function isLookDevOutput(o: unknown): o is LookDevOutput {
  return !!o && typeof o === 'object' && 'globalStyle' in o;
}

function isShotSpecOutput(o: unknown): o is ShotSpecOutput {
  return !!o && typeof o === 'object' && 'shots' in o && Array.isArray((o as any).shots);
}

function isDialogueOutput(o: unknown): o is DialogueOutput {
  return !!o && typeof o === 'object' && 'tracks' in o;
}

function isSoundOutput(o: unknown): o is SoundOutput {
  return !!o && typeof o === 'object' && 'audioLayers' in o;
}

function isPsychologyOutput(o: unknown): o is PsychologyOutput {
  return !!o && typeof o === 'object' && 'persuasionScore' in o;
}

function isFinishingOutput(o: unknown): o is FinishingOutput {
  return !!o && typeof o === 'object' && 'colorGrade' in o;
}

// ─── Helpers ───

/** Format seconds as MM:SS timecode */
function formatTimecode(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Determine H.I.C.C. section for a shot based on its time position vs beat timings */
function getSectionForTime(
  startSec: number,
  beatTimings?: AssemblyManifest['beatTimings'],
): 'hook' | 'intro' | 'content' | 'cta' {
  if (!beatTimings || beatTimings.length === 0) {
    // Fallback: first 15% = hook, next 20% = intro, next 55% = content, last 10% = cta
    return 'content';
  }
  for (const bt of beatTimings) {
    if (startSec >= bt.startSec && startSec < bt.endSec) {
      return bt.section;
    }
  }
  return 'content';
}

/** Get beat preset for a shot from beat timings */
function getBeatPresetForTime(
  startSec: number,
  beatTimings?: AssemblyManifest['beatTimings'],
): string | undefined {
  if (!beatTimings || beatTimings.length === 0) return undefined;
  for (const bt of beatTimings) {
    if (startSec >= bt.startSec && startSec < bt.endSec) {
      return bt.preset;
    }
  }
  return undefined;
}

/** Get the section type from the director's sections array for a given shot index */
function getSectionFromDirector(
  shotIndex: number,
  directorOutput?: DirectorOutput,
): 'hook' | 'intro' | 'content' | 'cta' {
  if (!directorOutput?.sections) return 'content';
  let cumulative = 0;
  for (const section of directorOutput.sections) {
    cumulative += section.durationSec;
    // Approximate: assign shot to section based on cumulative duration
    // This is a fallback — beat timings are more precise
  }
  return 'content';
}

// ─── Main Generator ───

export interface BuildProductionScriptParams {
  contentId: string;
  storyboardId: string;
  title: string;
  contentType: string;
  platform: string;
  agentOutputs?: Record<string, unknown>;
  assembledShots: AssembledShot[];
  beatTimings?: AssemblyManifest['beatTimings'];
  subtitles?: AssemblyManifest['subtitles'];
  outputSpec?: AssemblyManifest['outputSpec'];
}

/**
 * Build a unified TimecodedProductionScript from all agent outputs.
 *
 * This function takes the scattered outputs from 8 specialized agents and
 * merges them into a single document where every element — visual, camera,
 * dialogue, sound, SFX, character blocking — is timestamped to the second.
 */
export function buildProductionScript(params: BuildProductionScriptParams): TimecodedProductionScript {
  const {
    contentId,
    storyboardId,
    title,
    contentType,
    platform,
    agentOutputs = {},
    assembledShots,
    beatTimings,
    subtitles,
    outputSpec,
  } = params;

  // Parse agent outputs with type guards
  const director = isDirectorOutput(agentOutputs.director) ? agentOutputs.director : undefined;
  const lookdev = isLookDevOutput(agentOutputs.lookdev) ? agentOutputs.lookdev : undefined;
  const shotspec = isShotSpecOutput(agentOutputs.shotspec) ? agentOutputs.shotspec : undefined;
  const dialogue = isDialogueOutput(agentOutputs.dialogue) ? agentOutputs.dialogue : undefined;
  const sound = isSoundOutput(agentOutputs.sound) ? agentOutputs.sound : undefined;
  const psychology = isPsychologyOutput(agentOutputs.psychology) ? agentOutputs.psychology : undefined;
  const finishing = isFinishingOutput(agentOutputs.finishing) ? agentOutputs.finishing : undefined;

  // Calculate total duration
  const totalDurationSec = outputSpec?.totalDurationSec
    ?? assembledShots.reduce((sum, s) => sum + s.durationSec, 0)
    ?? director?.totalDurationSec
    ?? 0;

  // ─── Build per-shot cues ───
  const shotSpecMap = new Map<number, ShotSpecOutput['shots'][number]>();
  if (shotspec?.shots) {
    for (const s of shotspec.shots) {
      shotSpecMap.set(s.shotNumber, s);
    }
  }

  const dialogueMap = new Map<number, DialogueOutput['tracks'][number]>();
  if (dialogue?.tracks) {
    for (const t of dialogue.tracks) {
      dialogueMap.set(t.shotNumber, t);
    }
  }

  const soundMap = new Map<number, SoundOutput['audioLayers'][number]>();
  if (sound?.audioLayers) {
    for (const l of sound.audioLayers) {
      soundMap.set(l.shotNumber, l);
    }
  }

  // Psychology per-shot maps
  const hookOptMap = new Map<number, PsychologyOutput['hookOptimizations'][number]>();
  const ctaRewriteMap = new Map<number, PsychologyOutput['ctaRewrites'][number]>();
  const emotionalTriggerMap = new Map<number, PsychologyOutput['emotionalTriggers'][number]>();
  if (psychology) {
    for (const h of psychology.hookOptimizations ?? []) hookOptMap.set(h.shotNumber, h);
    for (const c of psychology.ctaRewrites ?? []) ctaRewriteMap.set(c.shotNumber, c);
    for (const e of psychology.emotionalTriggers ?? []) emotionalTriggerMap.set(e.shotNumber, e);
  }

  const cues: TimecodedCue[] = assembledShots.map((shot, idx) => {
    const shotNum = shot.shotNumber;
    const spec = shotSpecMap.get(shotNum);
    const dlg = dialogueMap.get(shotNum);
    const snd = soundMap.get(shotNum);
    const hookOpt = hookOptMap.get(shotNum);
    const ctaRewrite = ctaRewriteMap.get(shotNum);
    const emotionalTrigger = emotionalTriggerMap.get(shotNum);

    const section = getSectionForTime(shot.startSec, beatTimings);
    const beatPreset = getBeatPresetForTime(shot.startSec, beatTimings) ?? spec?.beat ?? shot.beat;

    // Visual description from shot spec prompt blocks or assembled shot
    const visualDescription = spec?.promptBlocks?.join(', ')
      ?? `Shot ${shotNum}: ${section} section, ${beatPreset ?? 'standard'} mood`;

    // Camera from shot spec or assembled shot
    const camera = {
      lens: spec?.camera?.lens ?? shot.camera?.lens,
      framing: spec?.camera?.framing ?? shot.camera?.framing,
      movement: spec?.camera?.movement ?? shot.camera?.movement,
      dof: spec?.camera?.dof ?? shot.camera?.dof,
      stabilization: shot.camera?.stabilization,
    };

    // Dialogue — apply psychology optimizations if available
    let dialogueEntry: TimecodedCue['dialogue'] | undefined;
    if (dlg) {
      let text = dlg.text;
      // Apply hook optimization if this is in the hook section
      if (section === 'hook' && hookOpt) {
        text = hookOpt.optimized;
      }
      // Apply CTA rewrite if this is in the CTA section
      if (section === 'cta' && ctaRewrite) {
        text = ctaRewrite.optimized;
      }
      dialogueEntry = {
        text,
        voice: dlg.voice,
        emotion: dlg.emotion,
        pacing: dlg.pacing as 'slow' | 'normal' | 'fast',
      };
    } else if (shot.dialogue) {
      dialogueEntry = shot.dialogue;
    }

    // Audio layers from sound agent or assembled shot's audioPlan
    const audioBg = snd?.bg
      ? {
          source: snd.bg.source,
          volume: snd.bg.volume,
          description: snd.bg.description,
          loop: true,
        }
      : shot.audioPlan?.bg
      ? {
          source: shot.audioPlan.bg.source ?? 'generate',
          volume: shot.audioPlan.bg.volume ?? 0.3,
          description: shot.audioPlan.bg.text ?? 'ambient background',
          loop: true,
        }
      : undefined;

    const audioMg = snd?.mg
      ? {
          source: snd.mg.source,
          volume: snd.mg.volume,
          description: snd.mg.description,
        }
      : shot.audioPlan?.mg
      ? {
          source: shot.audioPlan.mg.source ?? 'generate',
          volume: shot.audioPlan.mg.volume ?? 0.5,
          description: shot.audioPlan.mg.text ?? 'midground effects',
        }
      : undefined;

    const audioFg = snd?.fg
      ? {
          source: snd.fg.source,
          volume: snd.fg.volume,
          description: snd.fg.description,
        }
      : shot.audioPlan?.fg
      ? {
          source: shot.audioPlan.fg.source ?? 'tts',
          volume: shot.audioPlan.fg.volume ?? 0.9,
          description: shot.audioPlan.fg.text ?? 'dialogue',
        }
      : undefined;

    // SFX cues — extract from sound descriptions
    const sfxCues = extractSfxCues(snd, shot);

    // Character blocking — derive from shot spec and emotional triggers
    let characterBlocking: string | undefined;
    if (emotionalTrigger) {
      characterBlocking = `${emotionalTrigger.trigger} trigger: ${emotionalTrigger.placement}`;
    }

    // Text overlay — from emotional trigger or section
    let textOverlay: TimecodedCue['textOverlay'] | undefined;
    if (section === 'hook' && hookOpt) {
      textOverlay = {
        text: hookOpt.optimized.slice(0, 50),
        position: 'center',
        animation: 'fade-in',
      };
    }

    // Generation params
    const generation = spec?.generation
      ? {
          steps: spec.generation.steps,
          cfg: spec.generation.cfg,
          sampler: spec.generation.sampler,
          width: spec.generation.width,
          height: spec.generation.height,
          seed: shot.seed,
        }
      : undefined;

    // Per-shot color grade
    const colorGrade = shot.colorGrade
      ? {
          temperature: shot.colorGrade.temperature,
          contrast: shot.colorGrade.contrast,
          saturation: shot.colorGrade.saturation,
          filmGrain: shot.colorGrade.filmGrain,
          vignette: shot.colorGrade.vignette,
        }
      : undefined;

    return {
      startTime: formatTimecode(shot.startSec),
      endTime: formatTimecode(shot.endSec),
      startSec: shot.startSec,
      endSec: shot.endSec,
      shotNumber: shotNum,
      section,
      beatPreset,
      shotClass: shot.shotClass,
      visualDescription,
      camera,
      transition: shot.transition ?? (idx === 0 ? 'fade' : 'cut'),
      cameraMotion: undefined, // Populated if Ken Burns data exists
      dialogue: dialogueEntry,
      audioBg,
      audioMg,
      audioFg,
      sfxCues: sfxCues.length > 0 ? sfxCues : undefined,
      characterBlocking,
      textOverlay,
      generation,
      colorGrade,
      qualityScore: shot.qualityScore,
    };
  });

  // ─── Build header info ───
  const now = new Date().toISOString();

  const script: TimecodedProductionScript = {
    schemaVersion: '1.0.0',
    contentId,
    storyboardId,
    title,

    // Director info
    concept: director?.concept ?? 'Untitled production',
    narrative: director?.narrative ?? '',
    emotionalArc: director?.emotionalArc ?? [],
    totalDurationSec,
    platform,
    contentType,

    // LookDev info
    globalStyle: lookdev?.globalStyle,
    colorPalette: lookdev?.colorPalette,
    lightingScheme: lookdev?.lightingScheme,
    lensKit: lookdev?.lensKit,
    aspectRatio: lookdev?.aspectRatio,

    // Sound info
    masterVolume: sound?.masterVolume,
    mixNotes: sound?.mixNotes,

    // Finishing info
    globalColorGrade: finishing?.colorGrade,
    postProcess: finishing?.postProcess,

    // Psychology info
    persuasionScore: psychology?.persuasionScore,
    retentionTechniques: psychology?.retentionTechniques,

    // The shot sheet
    cues,

    // Beat timings
    beatTimings: beatTimings?.map(bt => ({
      startSec: bt.startSec,
      endSec: bt.endSec,
      section: bt.section,
      preset: bt.preset,
      label: bt.label,
    })),

    // Subtitles from finishing
    subtitles,

    // Delivery format
    deliveryFormat: finishing?.deliveryFormat ?? (outputSpec
      ? {
          codec: outputSpec.codec,
          width: outputSpec.width,
          height: outputSpec.height,
          fps: outputSpec.fps,
        }
      : undefined),

    createdAt: now,
    updatedAt: now,
  };

  return script;
}

// ─── SFX Cue Extraction ───

/**
 * Extract precise SFX cues from sound agent descriptions.
 * Parses descriptions like "ambient forest with bird chirps and wind rustling"
 * into individual timestamped cues spread across the shot duration.
 */
function extractSfxCues(
  snd: SoundOutput['audioLayers'][number] | undefined,
  shot: AssembledShot,
): Array<{ timeSec: number; description: string; volume: number }> {
  const cues: Array<{ timeSec: number; description: string; volume: number }> = [];
  const shotDuration = shot.durationSec;

  // Extract from midground layer (where SFX typically live)
  if (snd?.mg?.description) {
    const sfxItems = parseSfxDescription(snd.mg.description);
    for (let i = 0; i < sfxItems.length; i++) {
      // Spread SFX across the shot duration
      const offset = shotDuration * (i + 0.5) / Math.max(sfxItems.length, 1);
      cues.push({
        timeSec: Math.round(offset * 10) / 10,
        description: sfxItems[i],
        volume: snd.mg.volume,
      });
    }
  }

  // Also check background for ambient cues
  if (snd?.bg?.description) {
    const bgItems = parseSfxDescription(snd.bg.description);
    // Background SFX are ambient — place at start and midpoint
    for (let i = 0; i < Math.min(bgItems.length, 2); i++) {
      const offset = i === 0 ? 0.5 : shotDuration * 0.5;
      cues.push({
        timeSec: Math.round(offset * 10) / 10,
        description: bgItems[i],
        volume: snd.bg.volume,
      });
    }
  }

  return cues;
}

/**
 * Parse a sound description string into individual SFX items.
 * e.g., "ambient forest with bird chirps and wind rustling" →
 *   ["ambient forest", "bird chirps", "wind rustling"]
 */
function parseSfxDescription(desc: string): string[] {
  // Split on common conjunctions and commas
  const parts = desc
    .split(/\s+(?:and|with|then|followed by)\s+|,\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  // If the description is short and has no conjunctions, return as single item
  if (parts.length === 0 && desc.trim().length > 0) {
    return [desc.trim()];
  }

  return parts;
}

// ─── Formatting ───

/**
 * Format the production script as a human-readable text document.
 * This is the "shot sheet" format that a human producer or director would read.
 */
export function formatProductionScriptAsText(script: TimecodedProductionScript): string {
  const lines: string[] = [];

  // Header
  lines.push('═'.repeat(80));
  lines.push(`  PRODUCTION SCRIPT: ${script.title}`);
  lines.push('═'.repeat(80));
  lines.push('');
  lines.push(`  Concept: ${script.concept}`);
  lines.push(`  Narrative: ${script.narrative}`);
  lines.push(`  Emotional Arc: ${script.emotionalArc.join(' → ')}`);
  lines.push(`  Duration: ${formatTimecode(script.totalDurationSec)} (${script.totalDurationSec}s)`);
  lines.push(`  Platform: ${script.platform}`);
  lines.push(`  Type: ${script.contentType}`);
  lines.push('');

  // Global visual identity
  if (script.globalStyle || script.colorPalette) {
    lines.push('── GLOBAL VISUAL IDENTITY ──');
    if (script.globalStyle) lines.push(`  Style: ${script.globalStyle}`);
    if (script.lightingScheme) lines.push(`  Lighting: ${script.lightingScheme}`);
    if (script.colorPalette) lines.push(`  Palette: ${script.colorPalette.join(', ')}`);
    if (script.lensKit) lines.push(`  Lenses: ${script.lensKit.join(', ')}`);
    if (script.aspectRatio) lines.push(`  Aspect: ${script.aspectRatio}`);
    lines.push('');
  }

  // Global audio
  if (script.masterVolume !== undefined || script.mixNotes) {
    lines.push('── GLOBAL AUDIO ──');
    if (script.masterVolume !== undefined) lines.push(`  Master Volume: ${script.masterVolume}`);
    if (script.mixNotes) lines.push(`  Mix Notes: ${script.mixNotes}`);
    lines.push('');
  }

  // Psychology
  if (script.persuasionScore !== undefined) {
    lines.push('── PSYCHOLOGY ──');
    lines.push(`  Persuasion Score: ${script.persuasionScore}/100`);
    if (script.retentionTechniques?.length) {
      lines.push(`  Retention: ${script.retentionTechniques.join('; ')}`);
    }
    lines.push('');
  }

  // Color grade
  if (script.globalColorGrade || script.postProcess) {
    lines.push('── COLOR GRADE ──');
    if (script.globalColorGrade) {
      const cg = script.globalColorGrade;
      const parts: string[] = [];
      if (cg.temperature !== undefined) parts.push(`temp=${cg.temperature}`);
      if (cg.contrast !== undefined) parts.push(`contrast=${cg.contrast}`);
      if (cg.saturation !== undefined) parts.push(`sat=${cg.saturation}`);
      if (cg.lut) parts.push(`LUT=${cg.lut}`);
      lines.push(`  ${parts.join(', ')}`);
    }
    if (script.postProcess) {
      const pp = script.postProcess;
      const parts: string[] = [];
      if (pp.sharpen !== undefined) parts.push(`sharpen=${pp.sharpen}`);
      if (pp.filmGrain !== undefined) parts.push(`grain=${pp.filmGrain}`);
      if (pp.vignette !== undefined) parts.push(`vignette=${pp.vignette}`);
      if (parts.length) lines.push(`  Post: ${parts.join(', ')}`);
    }
    lines.push('');
  }

  // The shot sheet
  lines.push('═'.repeat(80));
  lines.push('  SHOT SHEET — SECOND BY SECOND');
  lines.push('═'.repeat(80));
  lines.push('');

  for (const cue of script.cues) {
    lines.push(`┌─ ${cue.startTime} → ${cue.endTime} │ Shot ${cue.shotNumber} │ ${cue.section.toUpperCase()} │ ${cue.beatPreset ?? '—'} ────────`);
    lines.push(`│ VISUAL:    ${cue.visualDescription}`);
    lines.push(`│ CAMERA:    ${cue.camera.lens ?? '—'} | ${cue.camera.framing ?? '—'} | ${cue.camera.movement ?? '—'} | DOF: ${cue.camera.dof ?? '—'}`);
    lines.push(`│ TRANSITION: ${cue.transition}`);

    if (cue.dialogue) {
      lines.push(`│ DIALOGUE:  "${cue.dialogue.text}"`);
      lines.push(`│           voice=${cue.dialogue.voice} emotion=${cue.dialogue.emotion} pacing=${cue.dialogue.pacing}`);
    }

    if (cue.audioBg) {
      lines.push(`│ AUDIO BG:  ${cue.audioBg.description} (vol: ${cue.audioBg.volume}${cue.audioBg.loop ? ', loop' : ''})`);
    }
    if (cue.audioMg) {
      lines.push(`│ AUDIO MG:  ${cue.audioMg.description} (vol: ${cue.audioMg.volume})`);
    }
    if (cue.audioFg) {
      lines.push(`│ AUDIO FG:  ${cue.audioFg.description} (vol: ${cue.audioFg.volume})`);
    }

    if (cue.sfxCues?.length) {
      for (const sfx of cue.sfxCues) {
        lines.push(`│ SFX @+${sfx.timeSec}s: ${sfx.description} (vol: ${sfx.volume})`);
      }
    }

    if (cue.characterBlocking) {
      lines.push(`│ BLOCKING:  ${cue.characterBlocking}`);
    }

    if (cue.textOverlay) {
      lines.push(`│ TEXT:      "${cue.textOverlay.text}" (${cue.textOverlay.position}, ${cue.textOverlay.animation})`);
    }

    if (cue.generation) {
      const g = cue.generation;
      const parts: string[] = [];
      if (g.steps) parts.push(`steps=${g.steps}`);
      if (g.cfg) parts.push(`cfg=${g.cfg}`);
      if (g.sampler) parts.push(`sampler=${g.sampler}`);
      if (g.width && g.height) parts.push(`${g.width}x${g.height}`);
      if (g.seed) parts.push(`seed=${g.seed}`);
      if (parts.length) lines.push(`│ GEN:       ${parts.join(', ')}`);
    }

    if (cue.qualityScore !== undefined) {
      lines.push(`│ QC SCORE:  ${cue.qualityScore}/100`);
    }

    lines.push(`└${'─'.repeat(78)}`);
    lines.push('');
  }

  // Beat timings summary
  if (script.beatTimings?.length) {
    lines.push('── BEAT TIMINGS ──');
    for (const bt of script.beatTimings) {
      lines.push(`  ${formatTimecode(bt.startSec)}–${formatTimecode(bt.endSec)} | ${bt.section.toUpperCase()} | ${bt.preset ?? '—'} | ${bt.label}`);
    }
    lines.push('');
  }

  // Subtitles
  if (script.subtitles?.length) {
    lines.push('── SUBTITLES ──');
    for (const sub of script.subtitles) {
      lines.push(`  ${formatTimecode(sub.startSec)}–${formatTimecode(sub.endSec)} | ${sub.text}`);
    }
    lines.push('');
  }

  // Delivery format
  if (script.deliveryFormat) {
    lines.push('── DELIVERY ──');
    const df = script.deliveryFormat;
    lines.push(`  ${df.codec} | ${df.width}x${df.height} | ${df.fps}fps`);
    lines.push('');
  }

  lines.push('═'.repeat(80));
  lines.push(`  END OF PRODUCTION SCRIPT`);
  lines.push('═'.repeat(80));

  return lines.join('\n');
}