/**
 * C2PA Content Provenance & Safety Pipeline
 *
 * Tracks AI-generated content provenance (model, prompt, parameters),
 * provides prompt safety linting, and generates C2PA-compatible
 * content credential manifests.
 *
 * C2PA (Coalition for Content Provenance and Authenticity) defines a
 * standard for content credentials that can be embedded in media files.
 */

// ─── Provenance Types ───

/** Provenance record for a single generation step */
export interface ProvenanceRecord {
  /** Unique ID for this provenance record */
  id: string;
  /** When this was generated */
  timestamp: string;
  /** Type of generation */
  type: 'image' | 'video' | 'audio' | 'text';
  /** AI model used */
  model: {
    name: string;
    provider: string;
    version?: string;
    checkpoint?: string;
  };
  /** Generation parameters */
  parameters: {
    prompt?: string;
    negativePrompt?: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    sampler?: string;
    width?: number;
    height?: number;
    loras?: Array<{ name: string; strength: number }>;
    controlNets?: Array<{ type: string; model: string; strength: number }>;
  };
  /** Input assets used */
  inputs: Array<{
    type: 'reference_image' | 'mask' | 'audio' | 'text';
    source: string;
    hash?: string;
  }>;
  /** Output asset */
  output: {
    storageKey: string;
    hash?: string;
    dimensions?: { width: number; height: number };
    durationMs?: number;
  };
  /** Pipeline stage */
  stage: string;
  /** Quality score if available */
  qualityScore?: number;
}

/** C2PA-compatible content credential manifest */
export interface C2PAManifest {
  /** Manifest version */
  version: '1.0';
  /** Claim generator identification */
  claimGenerator: string;
  /** Title of the content */
  title: string;
  /** Digital source type (C2PA vocabulary) */
  digitalSourceType: 'trainedAlgorithmicMedia' | 'compositeSynthetic' | 'algorithmicMedia';
  /** Creation timestamp */
  created: string;
  /** List of actions (generation steps) */
  actions: C2PAAction[];
  /** Assertions about the content */
  assertions: C2PAAssertion[];
  /** Ingredient manifests (source materials) */
  ingredients: C2PAIngredient[];
}

export interface C2PAAction {
  action: 'c2pa.created' | 'c2pa.edited' | 'c2pa.resized' | 'c2pa.transcoded';
  softwareAgent: string;
  when: string;
  parameters?: Record<string, unknown>;
}

export interface C2PAAssertion {
  label: string;
  data: Record<string, unknown>;
}

export interface C2PAIngredient {
  title: string;
  format: string;
  relationship: 'parentOf' | 'componentOf';
  hash?: string;
}

// ─── Prompt Safety Types ───

export type SafetyCategory =
  | 'violence'
  | 'sexual'
  | 'hate'
  | 'self_harm'
  | 'illegal'
  | 'pii'
  | 'copyright'
  | 'deceptive';

export interface SafetyLintResult {
  /** Whether the prompt passed safety checks */
  safe: boolean;
  /** Overall risk score (0 = safe, 100 = extremely unsafe) */
  riskScore: number;
  /** Flagged categories */
  flags: SafetyFlag[];
  /** Sanitized version of the prompt (if auto-clean is possible) */
  sanitized?: string;
}

export interface SafetyFlag {
  category: SafetyCategory;
  severity: 'low' | 'medium' | 'high';
  match: string;
  suggestion?: string;
}

// ─── Prompt Safety Lint ───

/** Pattern-based safety check rules */
const SAFETY_PATTERNS: Array<{
  category: SafetyCategory;
  severity: 'low' | 'medium' | 'high';
  patterns: RegExp[];
  suggestion: string;
}> = [
  {
    category: 'violence',
    severity: 'high',
    patterns: [/\b(gore|mutilat|dismember|torture)\b/i],
    suggestion: 'Remove graphic violence descriptions',
  },
  {
    category: 'sexual',
    severity: 'high',
    patterns: [/\b(nsfw|nude|naked|explicit|pornograph)\b/i],
    suggestion: 'Remove explicit sexual content',
  },
  {
    category: 'hate',
    severity: 'high',
    patterns: [/\b(hate\s+speech|slur|supremac)\b/i],
    suggestion: 'Remove hate speech or discriminatory content',
  },
  {
    category: 'self_harm',
    severity: 'high',
    patterns: [/\b(self.?harm|suicid)\b/i],
    suggestion: 'Remove self-harm references',
  },
  {
    category: 'deceptive',
    severity: 'medium',
    patterns: [/\b(deepfake|impersonat|fake\s+news)\b/i],
    suggestion: 'Consider adding AI-generated disclosure',
  },
  {
    category: 'pii',
    severity: 'medium',
    patterns: [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // phone
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // email
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, // SSN pattern
    ],
    suggestion: 'Remove personally identifiable information',
  },
  {
    category: 'copyright',
    severity: 'low',
    patterns: [/\b(disney|marvel|pokemon|harry\s+potter|star\s+wars)\b/i],
    suggestion: 'Consider using original character descriptions instead of copyrighted names',
  },
];

/**
 * Lint a prompt for safety issues.
 * Returns a SafetyLintResult with flags and an optional sanitized version.
 */
export function lintPrompt(prompt: string): SafetyLintResult {
  const flags: SafetyFlag[] = [];

  for (const rule of SAFETY_PATTERNS) {
    for (const pattern of rule.patterns) {
      const match = prompt.match(pattern);
      if (match) {
        flags.push({
          category: rule.category,
          severity: rule.severity,
          match: match[0],
          suggestion: rule.suggestion,
        });
      }
    }
  }

  // Calculate risk score
  const severityWeights = { high: 40, medium: 20, low: 10 };
  const riskScore = Math.min(100, flags.reduce((sum, f) => sum + severityWeights[f.severity], 0));

  // Auto-sanitize if possible (remove flagged terms)
  let sanitized: string | undefined;
  if (flags.length > 0) {
    sanitized = prompt;
    for (const rule of SAFETY_PATTERNS) {
      for (const pattern of rule.patterns) {
        sanitized = sanitized.replace(pattern, '[removed]');
      }
    }
  }

  return {
    safe: riskScore === 0,
    riskScore,
    flags,
    sanitized: flags.length > 0 ? sanitized : undefined,
  };
}

// ─── Provenance Record Creation ───

let provenanceCounter = 0;

/**
 * Create a provenance record for a generation step.
 */
export function createProvenanceRecord(
  type: ProvenanceRecord['type'],
  model: ProvenanceRecord['model'],
  parameters: ProvenanceRecord['parameters'],
  output: ProvenanceRecord['output'],
  stage: string,
  inputs: ProvenanceRecord['inputs'] = [],
): ProvenanceRecord {
  return {
    id: `prov-${Date.now()}-${++provenanceCounter}`,
    timestamp: new Date().toISOString(),
    type,
    model,
    parameters,
    inputs,
    output,
    stage,
  };
}

// ─── C2PA Manifest Generation ───

/**
 * Generate a C2PA-compatible content credential manifest from provenance records.
 */
export function generateC2PAManifest(
  title: string,
  records: ProvenanceRecord[],
): C2PAManifest {
  const actions: C2PAAction[] = records.map((r, i) => ({
    action: i === 0 ? 'c2pa.created' : 'c2pa.edited',
    softwareAgent: `AiRevStream/${r.model.provider}/${r.model.name}`,
    when: r.timestamp,
    parameters: {
      model: r.model.name,
      provider: r.model.provider,
      seed: r.parameters.seed,
      steps: r.parameters.steps,
    },
  }));

  const assertions: C2PAAssertion[] = [
    {
      label: 'c2pa.ai_generated',
      data: {
        isAiGenerated: true,
        models: [...new Set(records.map(r => r.model.name))],
        providers: [...new Set(records.map(r => r.model.provider))],
      },
    },
    {
      label: 'c2pa.quality',
      data: {
        scores: records
          .filter(r => r.qualityScore != null)
          .map(r => ({ stage: r.stage, score: r.qualityScore })),
      },
    },
  ];

  const ingredients: C2PAIngredient[] = records.flatMap(r =>
    r.inputs.map(input => ({
      title: input.source,
      format: input.type,
      relationship: 'componentOf' as const,
      hash: input.hash,
    })),
  );

  return {
    version: '1.0',
    claimGenerator: 'AiRevStream/1.0',
    title,
    digitalSourceType: 'trainedAlgorithmicMedia',
    created: records[0]?.timestamp ?? new Date().toISOString(),
    actions,
    assertions,
    ingredients,
  };
}

/**
 * Serialize a C2PA manifest to JSON for storage or embedding.
 */
export function serializeManifest(manifest: C2PAManifest): string {
  return JSON.stringify(manifest, null, 2);
}
