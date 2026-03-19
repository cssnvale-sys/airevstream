'use client';

import { useState } from 'react';

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
          <LookSection data={look} onChange={setLook} />
        )}
        {activeTab === 'character' && (
          <CharacterSection data={character} onChange={setCharacter} />
        )}
        {activeTab === 'environment' && (
          <EnvironmentSection data={environment} onChange={setEnvironment} />
        )}
        {activeTab === 'prompt' && (
          <PromptSection data={prompt} onChange={setPrompt} />
        )}
      </div>
    </div>
  );
}

// --- Section Components ---

function LookSection({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
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
    </div>
  );
}

function CharacterSection({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const wardrobe = (data.wardrobe as string[]) ?? [];

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
    </div>
  );
}

function EnvironmentSection({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });

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
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Style Tokens">
        <input
          type="text"
          value={(data.styleTokens as string) ?? ''}
          onChange={(e) => update('styleTokens', e.target.value)}
          placeholder="e.g., film noir, high contrast, moody atmosphere"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </FieldGroup>
      <FieldGroup label="Avoid Tokens (added to negative prompt)">
        <input
          type="text"
          value={(data.avoidTokens as string) ?? ''}
          onChange={(e) => update('avoidTokens', e.target.value)}
          placeholder="e.g., cartoon, anime, watermark, text"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
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
