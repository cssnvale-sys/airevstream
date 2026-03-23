/**
 * Specialized Agent Type Definitions
 *
 * Seven cinema production agents with schema-bound I/O:
 *   Director → LookDev → ShotSpec → Render → Dialogue → Sound → Finishing
 */

// ─── Agent Roles ───

export type AgentRole =
  | 'director'
  | 'lookdev'
  | 'shotspec'
  | 'render'
  | 'dialogue'
  | 'sound'
  | 'finishing';

export const AGENT_ROLES: AgentRole[] = [
  'director', 'lookdev', 'shotspec', 'render', 'dialogue', 'sound', 'finishing',
];

// ─── Agent Configuration ───

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  inputSchema: string[];
  outputSchema: string[];
  dependsOn: AgentRole[];
  qcGateAfter: boolean;
}

// ─── Agent I/O Interfaces ───

export interface DirectorInput {
  topic: string;
  contentType: string;
  targetPlatform: string;
  channelIdentity: {
    name: string;
    niches: string[];
    tone?: string;
    audience?: string;
  };
  constraints?: {
    maxDuration?: number;
    minDuration?: number;
    aspectRatio?: string;
  };
  complexityMode?: 'simple' | 'advanced' | 'complex';
}

export interface DirectorOutput {
  concept: string;
  narrative: string;
  emotionalArc: string[];
  sections: Array<{
    type: 'hook' | 'intro' | 'content' | 'cta';
    beat: string;
    description: string;
    durationSec: number;
  }>;
  visualDirection: string;
  audioDirection: string;
  totalDurationSec: number;
}

export interface LookDevInput {
  directorOutput: DirectorOutput;
  cinemaBible?: {
    lookBible?: Record<string, unknown>;
    characterBible?: Record<string, unknown>;
    environmentBible?: Record<string, unknown>;
  };
}

export interface LookDevOutput {
  globalStyle: string;
  colorPalette: string[];
  lightingScheme: string;
  lensKit: string[];
  loraRecommendations: Array<{
    name: string;
    strength: number;
    purpose: string;
  }>;
  moodBoard: string[];
  aspectRatio: string;
}

export interface ShotSpecInput {
  directorOutput: DirectorOutput;
  lookDevOutput: LookDevOutput;
  promptBible?: Record<string, unknown>;
}

export interface ShotSpecOutput {
  shots: Array<{
    shotNumber: number;
    promptBlocks: string[];
    camera: {
      lens: string;
      framing: string;
      movement: string;
      dof: string;
    };
    lighting: string;
    duration: number;
    transition: string;
    beat: string;
    generation: {
      steps: number;
      cfg: number;
      sampler: string;
      width: number;
      height: number;
    };
  }>;
}

export interface RenderInput {
  shotSpecOutput: ShotSpecOutput;
  lookDevOutput: LookDevOutput;
  qualityPreset: 'draft' | 'standard' | 'cinema';
}

export interface RenderOutput {
  renderedShots: Array<{
    shotNumber: number;
    keyframeUrl: string;
    seed: number;
    status: 'generated' | 'failed';
  }>;
  qualityReport: {
    avgScore: number;
    failedShots: number[];
  };
}

export interface DialogueInput {
  directorOutput: DirectorOutput;
  characterBible?: Record<string, unknown>;
}

export interface DialogueOutput {
  tracks: Array<{
    shotNumber: number;
    text: string;
    voice: string;
    emotion: string;
    pacing: 'slow' | 'normal' | 'fast';
  }>;
  narrationStyle: string;
}

export interface SoundInput {
  directorOutput: DirectorOutput;
  dialogueOutput: DialogueOutput;
  shotSpecOutput: ShotSpecOutput;
}

export interface SoundOutput {
  audioLayers: Array<{
    shotNumber: number;
    bg: { source: string; volume: number; description: string } | null;
    mg: { source: string; volume: number; description: string } | null;
    fg: { source: string; volume: number; description: string } | null;
  }>;
  masterVolume: number;
  mixNotes: string;
}

export interface FinishingInput {
  renderOutput: RenderOutput;
  dialogueOutput: DialogueOutput;
  soundOutput: SoundOutput;
  lookDevOutput: LookDevOutput;
}

export interface FinishingOutput {
  colorGrade: {
    temperature: number;
    contrast: number;
    saturation: number;
    lut?: string;
  };
  postProcess: {
    sharpen: number;
    filmGrain: number;
    vignette: number;
  };
  subtitles: Array<{
    startSec: number;
    endSec: number;
    text: string;
  }>;
  deliveryFormat: {
    codec: string;
    width: number;
    height: number;
    fps: number;
  };
}

// ─── Agent Task State ───

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface AgentTask {
  role: AgentRole;
  status: AgentTaskStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  qcScore?: number;
  qcPassed?: boolean;
}

export interface AgentPipelineState {
  id: string;
  contentId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  tasks: Record<AgentRole, AgentTask>;
  startedAt: string;
  completedAt?: string;
  currentAgent?: AgentRole;
}

export type ComplexityMode = 'simple' | 'advanced' | 'complex';
