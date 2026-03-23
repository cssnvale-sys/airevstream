'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';

interface ChannelInfo {
  id: string;
  name: string;
  socialAccount: {
    platform: string;
    username: string;
  };
}

interface CinemaBibleData {
  id: string;
  channelId: string;
  version: number;
  lookBible: Record<string, unknown> | null;
  characterBible: Record<string, unknown> | null;
  environmentBible: Record<string, unknown> | null;
  promptBible: Record<string, unknown> | null;
  shotspecTemplate: Record<string, unknown> | null;
  channel: ChannelInfo;
}

interface BibleEditorProps {
  bible: CinemaBibleData;
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

interface LoraEntry {
  name: string;
  strength: number;
  clipStrength?: number;
  triggerWords?: string[];
}

interface ColorPipelineData {
  lut?: string;
  temperature?: number;
  tint?: number;
  contrast?: number;
  saturation?: number;
  highlights?: number;
  shadows?: number;
  blacks?: number;
  whites?: number;
}

interface ComfyUIModelsResponse {
  available: boolean;
  checkpoints: string[];
  loras: string[];
  controlNets: string[];
}

type TabId = 'look' | 'character' | 'environment' | 'prompt';

const TABS: { id: TabId; label: string }[] = [
  { id: 'look', label: 'Look & Style' },
  { id: 'character', label: 'Characters' },
  { id: 'environment', label: 'Environments' },
  { id: 'prompt', label: 'Prompts' },
];

export function BibleEditor({ bible, onSave }: BibleEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('look');
  const [saving, setSaving] = useState(false);

  // Fetch available ComfyUI models for LoRA pickers
  const { data: modelsData } = useApi<ComfyUIModelsResponse>('/comfyui/models');
  const availableLoras = (modelsData?.data?.loras ?? []) as string[];

  // Local state for each section
  const [look, setLook] = useState<Record<string, unknown>>(bible.lookBible ?? {});
  const [character, setCharacter] = useState<Record<string, unknown>>(bible.characterBible ?? {});
  const [environment, setEnvironment] = useState<Record<string, unknown>>(bible.environmentBible ?? {});
  const [prompt, setPrompt] = useState<Record<string, unknown>>(bible.promptBible ?? {});

  async function handleSave() {
    setSaving(true);
    await onSave(bible.id, {
      lookBible: look,
      characterBible: character,
      environmentBible: environment,
      promptBible: prompt,
    });
    setSaving(false);
  }

  return (
    <div className="bg-bg-secondary rounded-lg border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-text-primary">
            {bible.channel.name}
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {bible.channel.socialAccount.platform} &middot; @{bible.channel.socialAccount.username} &middot; v{bible.version}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-accent-blue text-white rounded-md hover:bg-accent-blue/90 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'look' && (
          <LookSection data={look} onChange={setLook} availableLoras={availableLoras} />
        )}
        {activeTab === 'character' && (
          <CharacterSection data={character} onChange={setCharacter} availableLoras={availableLoras} />
        )}
        {activeTab === 'environment' && (
          <EnvironmentSection data={environment} onChange={setEnvironment} availableLoras={availableLoras} />
        )}
        {activeTab === 'prompt' && (
          <PromptSection data={prompt} onChange={setPrompt} />
        )}
      </div>
    </div>
  );
}

// --- Reusable LoRA List Editor ---

function LoraListEditor({
  loras,
  onChange,
  availableLoras,
}: {
  loras: LoraEntry[];
  onChange: (loras: LoraEntry[]) => void;
  availableLoras: string[];
}) {
  const addLora = () => {
    onChange([...loras, { name: '', strength: 1.0, clipStrength: 1.0, triggerWords: [] }]);
  };

  const updateLora = (index: number, updates: Partial<LoraEntry>) => {
    const updated = [...loras];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeLora = (index: number) => {
    onChange(loras.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {loras.map((lora, i) => (
        <div key={i} className="p-3 bg-bg-tertiary rounded-md border border-border space-y-2">
          <div className="flex items-center gap-2">
            {availableLoras.length > 0 ? (
              <select
                value={lora.name}
                onChange={(e) => updateLora(i, { name: e.target.value })}
                className="flex-1 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              >
                <option value="">Select LoRA...</option>
                {availableLoras.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={lora.name}
                onChange={(e) => updateLora(i, { name: e.target.value })}
                placeholder="LoRA model name"
                className="flex-1 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
            )}
            <button
              onClick={() => removeLora(i)}
              className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-tertiary">Strength ({lora.strength.toFixed(2)})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={lora.strength}
                onChange={(e) => updateLora(i, { strength: parseFloat(e.target.value) })}
                className="w-full accent-accent-blue"
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary">CLIP Strength ({(lora.clipStrength ?? 1.0).toFixed(2)})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={lora.clipStrength ?? 1.0}
                onChange={(e) => updateLora(i, { clipStrength: parseFloat(e.target.value) })}
                className="w-full accent-accent-blue"
              />
            </div>
          </div>
          <div>
            <input
              type="text"
              value={(lora.triggerWords ?? []).join(', ')}
              onChange={(e) => updateLora(i, { triggerWords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="Trigger words (comma-separated)"
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-xs focus:ring-1 focus:ring-accent-blue outline-none"
            />
          </div>
        </div>
      ))}
      <button
        onClick={addLora}
        className="text-accent-blue text-sm hover:underline"
      >
        + Add LoRA
      </button>
    </div>
  );
}

// --- Color Pipeline Editor ---

const COLOR_PIPELINE_FIELDS: { key: keyof ColorPipelineData; label: string; min: number; max: number; step: number; defaultVal: number }[] = [
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, step: 1, defaultVal: 0 },
  { key: 'whites', label: 'Whites', min: -100, max: 100, step: 1, defaultVal: 0 },
];

function ColorPipelineEditor({
  pipeline,
  onChange,
}: {
  pipeline: ColorPipelineData;
  onChange: (p: ColorPipelineData) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-text-tertiary">LUT File</label>
        <input
          type="text"
          value={pipeline.lut ?? ''}
          onChange={(e) => onChange({ ...pipeline, lut: e.target.value })}
          placeholder="e.g., luts/cinematic-warm.cube"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {COLOR_PIPELINE_FIELDS.map((field) => {
          const val = (pipeline[field.key] as number) ?? field.defaultVal;
          return (
            <div key={field.key}>
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>{field.label}</span>
                <span>{val}</span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={val}
                onChange={(e) => onChange({ ...pipeline, [field.key]: parseFloat(e.target.value) })}
                className="w-full accent-accent-blue"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Key-Value List Editor ---

function KeyValueEditor({
  entries,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const pairs = Object.entries(entries);

  const updatePair = (oldKey: string, newKey: string, value: string) => {
    const updated = { ...entries };
    if (oldKey !== newKey) delete updated[oldKey];
    updated[newKey] = value;
    onChange(updated);
  };

  const removePair = (key: string) => {
    const updated = { ...entries };
    delete updated[key];
    onChange(updated);
  };

  const addPair = () => {
    const key = `setup_${pairs.length + 1}`;
    onChange({ ...entries, [key]: '' });
  };

  return (
    <div className="space-y-2">
      {pairs.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => updatePair(key, e.target.value, value)}
            placeholder={keyPlaceholder}
            className="w-1/3 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => updatePair(key, key, e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
          />
          <button
            onClick={() => removePair(key)}
            className="text-red-400 hover:text-red-300 text-sm px-2"
          >
            Remove
          </button>
        </div>
      ))}
      <button onClick={addPair} className="text-accent-blue text-sm hover:underline">
        + Add entry
      </button>
    </div>
  );
}

// --- Section Components ---

function LookSection({ data, onChange, availableLoras }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; availableLoras: string[] }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const loras = (data.loras as LoraEntry[]) ?? [];
  const lensKit = (data.lensKit as string[]) ?? [];
  const colorPipeline = (data.colorPipeline as ColorPipelineData) ?? {};

  return (
    <div className="space-y-4">
      <FieldGroup label="Logline">
        <textarea
          value={(data.logline as string) ?? ''}
          onChange={(e) => update('logline', e.target.value)}
          placeholder="One-line summary of the project's visual and narrative identity"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[60px] focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Global Style">
        <textarea
          value={(data.globalStyle as string) ?? ''}
          onChange={(e) => update('globalStyle', e.target.value)}
          placeholder="e.g., cinematic, moody lighting, film grain, anamorphic lens flare"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[80px] focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Negative Prompt">
        <textarea
          value={(data.negativePrompt as string) ?? ''}
          onChange={(e) => update('negativePrompt', e.target.value)}
          placeholder="e.g., worst quality, low quality, blurry, deformed"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[80px] focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Lighting">
          <input
            type="text"
            value={(data.lighting as string) ?? ''}
            onChange={(e) => update('lighting', e.target.value)}
            placeholder="e.g., golden hour, studio three-point"
            className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
          />
        </FieldGroup>
        <FieldGroup label="Grain">
          <input
            type="text"
            value={(data.grain as string) ?? ''}
            onChange={(e) => update('grain', e.target.value)}
            placeholder="e.g., 35mm film grain, subtle noise"
            className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
          />
        </FieldGroup>
      </div>
      <FieldGroup label="Aspect Ratio">
        <select
          value={(data.aspectRatio as string) ?? '16:9'}
          onChange={(e) => update('aspectRatio', e.target.value)}
          className="bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
        >
          <option value="16:9">16:9 (Widescreen)</option>
          <option value="9:16">9:16 (Vertical)</option>
          <option value="2.39:1">2.39:1 (Anamorphic)</option>
          <option value="4:3">4:3 (Classic)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
      </FieldGroup>

      {/* NEW: LoRA Models */}
      <FieldGroup label="LoRA Models">
        <LoraListEditor loras={loras} onChange={(v) => update('loras', v)} availableLoras={availableLoras} />
      </FieldGroup>

      {/* NEW: Lens Kit */}
      <FieldGroup label="Lens Kit">
        <div className="space-y-2">
          {lensKit.map((lens, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={lens}
                onChange={(e) => {
                  const updated = [...lensKit];
                  updated[i] = e.target.value;
                  update('lensKit', updated);
                }}
                placeholder="e.g., 35mm f/1.4, 85mm f/1.2, 24mm f/2.8"
                className="flex-1 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
              <button
                onClick={() => update('lensKit', lensKit.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300 text-sm px-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => update('lensKit', [...lensKit, ''])}
            className="text-accent-blue text-sm hover:underline"
          >
            + Add lens
          </button>
        </div>
      </FieldGroup>

      {/* NEW: Color Pipeline */}
      <FieldGroup label="Color Pipeline">
        <ColorPipelineEditor
          pipeline={colorPipeline}
          onChange={(v) => update('colorPipeline', v)}
        />
      </FieldGroup>

      {/* NEW: Style References */}
      <FieldGroup label="Style References (MinIO keys)">
        <div className="space-y-2">
          {((data.styleRefs as string[]) ?? []).map((ref, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={ref}
                onChange={(e) => {
                  const updated = [...((data.styleRefs as string[]) ?? [])];
                  updated[i] = e.target.value;
                  update('styleRefs', updated);
                }}
                placeholder="e.g., references/style-ref-001.png"
                className="flex-1 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
              <button
                onClick={() => update('styleRefs', ((data.styleRefs as string[]) ?? []).filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300 text-sm px-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => update('styleRefs', [...((data.styleRefs as string[]) ?? []), ''])}
            className="text-accent-blue text-sm hover:underline"
          >
            + Add reference
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}

function CharacterSection({ data, onChange, availableLoras }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; availableLoras: string[] }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const wardrobe = (data.wardrobe as string[]) ?? [];
  const characterLoras = (data.characterLoras as Record<string, LoraEntry>) ?? {};

  const addCharacterLora = () => {
    const key = `character_${Object.keys(characterLoras).length + 1}`;
    update('characterLoras', { ...characterLoras, [key]: { name: '', strength: 1.0, clipStrength: 1.0, triggerWords: [] } });
  };

  const updateCharacterLora = (charKey: string, newCharKey: string, lora: LoraEntry) => {
    const updated = { ...characterLoras };
    if (charKey !== newCharKey) delete updated[charKey];
    updated[newCharKey] = lora;
    update('characterLoras', updated);
  };

  const removeCharacterLora = (charKey: string) => {
    const updated = { ...characterLoras };
    delete updated[charKey];
    update('characterLoras', updated);
  };

  return (
    <div className="space-y-4">
      <FieldGroup label="Voice ID">
        <input
          type="text"
          value={(data.voiceId as string) ?? ''}
          onChange={(e) => update('voiceId', e.target.value)}
          placeholder="TTS voice profile ID"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Face Reference (MinIO key)">
        <input
          type="text"
          value={(data.faceRef as string) ?? ''}
          onChange={(e) => update('faceRef', e.target.value)}
          placeholder="e.g., references/face-ref-001.png"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Wardrobe Items">
        <div className="space-y-2">
          {wardrobe.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const updated = [...wardrobe];
                  updated[i] = e.target.value;
                  update('wardrobe', updated);
                }}
                className="flex-1 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
              <button
                onClick={() => update('wardrobe', wardrobe.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300 text-sm px-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => update('wardrobe', [...wardrobe, ''])}
            className="text-accent-blue text-sm hover:underline"
          >
            + Add wardrobe item
          </button>
        </div>
      </FieldGroup>
      <FieldGroup label="Never Change List">
        <textarea
          value={((data.neverChangeList as string[]) ?? []).join('\n')}
          onChange={(e) => update('neverChangeList', e.target.value.split('\n').filter(Boolean))}
          placeholder="One item per line -- aspects that must never change between shots"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[80px] focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>

      {/* NEW: Character LoRAs */}
      <FieldGroup label="Character LoRAs">
        <div className="space-y-3">
          {Object.entries(characterLoras).map(([charKey, lora]) => (
            <div key={charKey} className="p-3 bg-bg-tertiary rounded-md border border-border space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={charKey}
                  onChange={(e) => updateCharacterLora(charKey, e.target.value, lora)}
                  placeholder="Character name"
                  className="w-1/3 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-accent-blue outline-none"
                />
                {availableLoras.length > 0 ? (
                  <select
                    value={lora.name}
                    onChange={(e) => updateCharacterLora(charKey, charKey, { ...lora, name: e.target.value })}
                    className="flex-1 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
                  >
                    <option value="">Select LoRA...</option>
                    {availableLoras.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={lora.name}
                    onChange={(e) => updateCharacterLora(charKey, charKey, { ...lora, name: e.target.value })}
                    placeholder="LoRA model name"
                    className="flex-1 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
                  />
                )}
                <button
                  onClick={() => removeCharacterLora(charKey)}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-tertiary">Strength ({lora.strength.toFixed(2)})</label>
                  <input
                    type="range"
                    min="0" max="2" step="0.05"
                    value={lora.strength}
                    onChange={(e) => updateCharacterLora(charKey, charKey, { ...lora, strength: parseFloat(e.target.value) })}
                    className="w-full accent-accent-blue"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-tertiary">CLIP ({(lora.clipStrength ?? 1.0).toFixed(2)})</label>
                  <input
                    type="range"
                    min="0" max="2" step="0.05"
                    value={lora.clipStrength ?? 1.0}
                    onChange={(e) => updateCharacterLora(charKey, charKey, { ...lora, clipStrength: parseFloat(e.target.value) })}
                    className="w-full accent-accent-blue"
                  />
                </div>
              </div>
              <input
                type="text"
                value={(lora.triggerWords ?? []).join(', ')}
                onChange={(e) => updateCharacterLora(charKey, charKey, { ...lora, triggerWords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="Trigger words (comma-separated)"
                className="w-full bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-xs focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
          ))}
          <button onClick={addCharacterLora} className="text-accent-blue text-sm hover:underline">
            + Add character LoRA
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}

function EnvironmentSection({ data, onChange, availableLoras }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; availableLoras: string[] }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const lightingSetups = (data.lightingSetups as Record<string, string>) ?? {};
  const envLoras = (data.environmentLoras as Record<string, LoraEntry>) ?? {};

  const addEnvLora = () => {
    const key = `env_${Object.keys(envLoras).length + 1}`;
    update('environmentLoras', { ...envLoras, [key]: { name: '', strength: 1.0, clipStrength: 1.0, triggerWords: [] } });
  };

  const updateEnvLora = (envKey: string, newEnvKey: string, lora: LoraEntry) => {
    const updated = { ...envLoras };
    if (envKey !== newEnvKey) delete updated[envKey];
    updated[newEnvKey] = lora;
    update('environmentLoras', updated);
  };

  const removeEnvLora = (envKey: string) => {
    const updated = { ...envLoras };
    delete updated[envKey];
    update('environmentLoras', updated);
  };

  return (
    <div className="space-y-4">
      <FieldGroup label="Location Motifs">
        <textarea
          value={((data.locationMotifs as string[]) ?? []).join('\n')}
          onChange={(e) => update('locationMotifs', e.target.value.split('\n').filter(Boolean))}
          placeholder="One location per line -- recurring locations in your content"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[80px] focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Weather Options">
        <textarea
          value={((data.weather as string[]) ?? []).join('\n')}
          onChange={(e) => update('weather', e.target.value.split('\n').filter(Boolean))}
          placeholder="One per line -- e.g., overcast, golden hour, foggy morning"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[80px] focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Depth Map Reference (MinIO key)">
        <input
          type="text"
          value={(data.depthMapRef as string) ?? ''}
          onChange={(e) => update('depthMapRef', e.target.value)}
          placeholder="e.g., references/depth-map-001.png"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>

      {/* NEW: Lighting Setups */}
      <FieldGroup label="Lighting Setups">
        <KeyValueEditor
          entries={lightingSetups}
          onChange={(v) => update('lightingSetups', v)}
          keyPlaceholder="Setup name"
          valuePlaceholder="e.g., three-point key=5600K fill=4500K rim=warm"
        />
      </FieldGroup>

      {/* NEW: Environment LoRAs */}
      <FieldGroup label="Environment LoRAs">
        <div className="space-y-3">
          {Object.entries(envLoras).map(([envKey, lora]) => (
            <div key={envKey} className="p-3 bg-bg-tertiary rounded-md border border-border space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={envKey}
                  onChange={(e) => updateEnvLora(envKey, e.target.value, lora)}
                  placeholder="Environment name"
                  className="w-1/3 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-accent-blue outline-none"
                />
                {availableLoras.length > 0 ? (
                  <select
                    value={lora.name}
                    onChange={(e) => updateEnvLora(envKey, envKey, { ...lora, name: e.target.value })}
                    className="flex-1 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
                  >
                    <option value="">Select LoRA...</option>
                    {availableLoras.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={lora.name}
                    onChange={(e) => updateEnvLora(envKey, envKey, { ...lora, name: e.target.value })}
                    placeholder="LoRA model name"
                    className="flex-1 bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
                  />
                )}
                <button
                  onClick={() => removeEnvLora(envKey)}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-tertiary">Strength ({lora.strength.toFixed(2)})</label>
                  <input
                    type="range" min="0" max="2" step="0.05"
                    value={lora.strength}
                    onChange={(e) => updateEnvLora(envKey, envKey, { ...lora, strength: parseFloat(e.target.value) })}
                    className="w-full accent-accent-blue"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-tertiary">CLIP ({(lora.clipStrength ?? 1.0).toFixed(2)})</label>
                  <input
                    type="range" min="0" max="2" step="0.05"
                    value={lora.clipStrength ?? 1.0}
                    onChange={(e) => updateEnvLora(envKey, envKey, { ...lora, clipStrength: parseFloat(e.target.value) })}
                    className="w-full accent-accent-blue"
                  />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addEnvLora} className="text-accent-blue text-sm hover:underline">
            + Add environment LoRA
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}

function PromptSection({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <FieldGroup label="Quality Tokens">
        <input
          type="text"
          value={(data.qualityTokens as string) ?? ''}
          onChange={(e) => update('qualityTokens', e.target.value)}
          placeholder="e.g., masterpiece, best quality, cinematic, 8k"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Style Tokens">
        <input
          type="text"
          value={(data.styleTokens as string) ?? ''}
          onChange={(e) => update('styleTokens', e.target.value)}
          placeholder="e.g., film noir, high contrast, moody atmosphere"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Avoid Tokens (added to negative prompt)">
        <input
          type="text"
          value={(data.avoidTokens as string) ?? ''}
          onChange={(e) => update('avoidTokens', e.target.value)}
          placeholder="e.g., cartoon, anime, watermark, text"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue focus:border-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Global Style Prompt">
        <textarea
          value={(data.globalStyle as string) ?? ''}
          onChange={(e) => update('globalStyle', e.target.value)}
          placeholder="Global style applied to all shots. This gets prepended to every prompt."
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[100px] focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Negative Block">
        <textarea
          value={(data.negativeBlock as string) ?? ''}
          onChange={(e) => update('negativeBlock', e.target.value)}
          placeholder="Negative prompt block applied to all generations"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[100px] focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Slot Rules (slot name → allowed values)">
        <div className="space-y-2">
          {Object.entries((data.slotRules as Record<string, string[]>) ?? {}).map(([slot, values]) => (
            <div key={slot} className="flex gap-2">
              <input
                type="text"
                value={slot}
                onChange={(e) => {
                  const rules = { ...((data.slotRules as Record<string, string[]>) ?? {}) };
                  const oldValues = rules[slot] ?? [];
                  delete rules[slot];
                  rules[e.target.value] = oldValues;
                  update('slotRules', rules);
                }}
                placeholder="Slot name"
                className="w-1/3 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
              <input
                type="text"
                value={(values ?? []).join(', ')}
                onChange={(e) => {
                  const rules = { ...((data.slotRules as Record<string, string[]>) ?? {}) };
                  rules[slot] = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  update('slotRules', rules);
                }}
                placeholder="Allowed values (comma-separated)"
                className="flex-1 bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
              <button
                onClick={() => {
                  const rules = { ...((data.slotRules as Record<string, string[]>) ?? {}) };
                  delete rules[slot];
                  update('slotRules', rules);
                }}
                className="text-red-400 hover:text-red-300 text-sm px-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const rules = { ...((data.slotRules as Record<string, string[]>) ?? {}) };
              rules[`slot_${Object.keys(rules).length + 1}`] = [];
              update('slotRules', rules);
            }}
            className="text-accent-blue text-sm hover:underline"
          >
            + Add slot rule
          </button>
        </div>
      </FieldGroup>
      <FieldGroup label="Per-Character Prompt Blocks">
        <div className="space-y-3">
          {Object.entries((data.perCharacterBlocks as Record<string, string[]>) ?? {}).map(([charKey, blocks]) => (
            <div key={charKey} className="p-3 bg-bg-tertiary rounded-md border border-border space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={charKey}
                  onChange={(e) => {
                    const pcb = { ...((data.perCharacterBlocks as Record<string, string[]>) ?? {}) };
                    const oldBlocks = pcb[charKey] ?? [];
                    delete pcb[charKey];
                    pcb[e.target.value] = oldBlocks;
                    update('perCharacterBlocks', pcb);
                  }}
                  placeholder="Character name"
                  className="bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-accent-blue outline-none"
                />
                <button
                  onClick={() => {
                    const pcb = { ...((data.perCharacterBlocks as Record<string, string[]>) ?? {}) };
                    delete pcb[charKey];
                    update('perCharacterBlocks', pcb);
                  }}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={(blocks ?? []).join('\n')}
                onChange={(e) => {
                  const pcb = { ...((data.perCharacterBlocks as Record<string, string[]>) ?? {}) };
                  pcb[charKey] = e.target.value.split('\n').filter(Boolean);
                  update('perCharacterBlocks', pcb);
                }}
                placeholder="One prompt block per line"
                className="w-full bg-bg-secondary text-text-primary border border-border rounded-md p-2 text-xs resize-y min-h-[60px] focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
          ))}
          <button
            onClick={() => {
              const pcb = { ...((data.perCharacterBlocks as Record<string, string[]>) ?? {}) };
              pcb[`character_${Object.keys(pcb).length + 1}`] = [];
              update('perCharacterBlocks', pcb);
            }}
            className="text-accent-blue text-sm hover:underline"
          >
            + Add character block
          </button>
        </div>
      </FieldGroup>
      <FieldGroup label="Per-Environment Prompt Blocks">
        <div className="space-y-3">
          {Object.entries((data.perEnvironmentBlocks as Record<string, string[]>) ?? {}).map(([envKey, blocks]) => (
            <div key={envKey} className="p-3 bg-bg-tertiary rounded-md border border-border space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={envKey}
                  onChange={(e) => {
                    const peb = { ...((data.perEnvironmentBlocks as Record<string, string[]>) ?? {}) };
                    const oldBlocks = peb[envKey] ?? [];
                    delete peb[envKey];
                    peb[e.target.value] = oldBlocks;
                    update('perEnvironmentBlocks', peb);
                  }}
                  placeholder="Environment name"
                  className="bg-bg-secondary text-text-primary border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-accent-blue outline-none"
                />
                <button
                  onClick={() => {
                    const peb = { ...((data.perEnvironmentBlocks as Record<string, string[]>) ?? {}) };
                    delete peb[envKey];
                    update('perEnvironmentBlocks', peb);
                  }}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={(blocks ?? []).join('\n')}
                onChange={(e) => {
                  const peb = { ...((data.perEnvironmentBlocks as Record<string, string[]>) ?? {}) };
                  peb[envKey] = e.target.value.split('\n').filter(Boolean);
                  update('perEnvironmentBlocks', peb);
                }}
                placeholder="One prompt block per line"
                className="w-full bg-bg-secondary text-text-primary border border-border rounded-md p-2 text-xs resize-y min-h-[60px] focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
          ))}
          <button
            onClick={() => {
              const peb = { ...((data.perEnvironmentBlocks as Record<string, string[]>) ?? {}) };
              peb[`environment_${Object.keys(peb).length + 1}`] = [];
              update('perEnvironmentBlocks', peb);
            }}
            className="text-accent-blue text-sm hover:underline"
          >
            + Add environment block
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}

// --- Shared Components ---

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}
