'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useGeneratePreset, savePreset } from '@/hooks/use-user-presets';
import type { Preset, PresetFamily } from '@airevstream/shared';

interface CreatePresetModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const FAMILY_COLORS: Record<PresetFamily, string> = {
  visual: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  camera: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  audio: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  edit: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  output: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  project: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
  character: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  story: 'bg-pink-500/15 border-pink-500/30 text-pink-400',
  dialogue: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
  continuity: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
};

const FAMILY_LABELS: Record<PresetFamily, string> = {
  visual: 'Visual',
  camera: 'Camera',
  audio: 'Audio',
  edit: 'Edit',
  output: 'Output',
  project: 'Project',
  character: 'Character',
  story: 'Story',
  dialogue: 'Dialogue',
  continuity: 'Continuity',
};

type ModalState = 'idle' | 'generating' | 'preview' | 'saving' | 'done';

export function CreatePresetModal({ open, onClose, onSaved }: CreatePresetModalProps) {
  const [description, setDescription] = useState('');
  const [state, setState] = useState<ModalState>('idle');
  const [preview, setPreview] = useState<Preset | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [showOverrides, setShowOverrides] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { generate, isGenerating, error: genError, reset: resetGen } = useGeneratePreset();

  if (!open) return null;

  const handleGenerate = async () => {
    if (!description.trim() || description.length < 3) return;
    setState('generating');
    const result = await generate(description);
    if (result) {
      setPreview(result.preset);
      setEditedName(result.preset.name);
      setEditedDescription(result.preset.description ?? '');
      setState('preview');
    } else {
      setState('idle');
    }
  };

  const handleRegenerate = () => {
    setPreview(null);
    resetGen();
    setState('idle');
  };

  const handleSave = async () => {
    if (!preview) return;
    setState('saving');
    setSaveError(null);

    const presetToSave: Preset = {
      ...preview,
      name: editedName || preview.name,
      description: editedDescription || preview.description,
    };

    try {
      await savePreset(presetToSave, description);
      setState('done');
      onSaved();
      // Close after brief delay
      setTimeout(() => {
        handleClose();
      }, 500);
    } catch {
      setSaveError('Failed to save preset');
      setState('preview');
    }
  };

  const handleClose = () => {
    setDescription('');
    setState('idle');
    setPreview(null);
    setEditedName('');
    setEditedDescription('');
    setShowOverrides(false);
    setSaveError(null);
    resetGen();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Create a Preset</h2>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-primary transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Description input */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Describe the style you want
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. warm sunset look with soft focus and film grain"
              className="w-full bg-bg-primary text-text-primary border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none resize-none"
              rows={2}
              maxLength={500}
              disabled={state === 'generating' || state === 'saving'}
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] text-text-tertiary">
                {description.length}/500
              </span>
              <button
                onClick={handleGenerate}
                disabled={description.length < 3 || isGenerating || state === 'saving'}
                className={cn(
                  'px-3 py-1 text-xs rounded font-medium transition-colors',
                  description.length < 3 || isGenerating || state === 'saving'
                    ? 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                    : 'bg-accent-blue text-white hover:bg-accent-blue/90',
                )}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Error */}
          {genError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {genError}
            </p>
          )}
          {saveError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {saveError}
            </p>
          )}

          {/* Preview */}
          {preview && state !== 'idle' && state !== 'generating' && (
            <div className="border border-border rounded-md p-3 space-y-3 bg-bg-primary">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Preview</span>
                <button
                  onClick={handleRegenerate}
                  disabled={state === 'saving'}
                  className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                >
                  Regenerate
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[10px] text-text-tertiary mb-0.5">Name</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full bg-bg-secondary text-text-primary border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-accent-blue outline-none"
                  maxLength={255}
                  disabled={state === 'saving'}
                />
              </div>

              {/* Family badge */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-tertiary">Family:</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', FAMILY_COLORS[preview.family])}>
                  {FAMILY_LABELS[preview.family]}
                </span>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] text-text-tertiary mb-0.5">Description</label>
                <input
                  type="text"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full bg-bg-secondary text-text-primary border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-accent-blue outline-none"
                  maxLength={500}
                  disabled={state === 'saving'}
                />
              </div>

              {/* Tags */}
              {preview.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {preview.tags.map((tag) => (
                    <span key={tag} className="text-[10px] bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Overrides (expandable) */}
              <div>
                <button
                  onClick={() => setShowOverrides(!showOverrides)}
                  className="text-[10px] text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                >
                  <span>{showOverrides ? '\u25BE' : '\u25B8'}</span>
                  Overrides
                </button>
                {showOverrides && (
                  <pre className="mt-1 text-[10px] text-text-tertiary bg-bg-tertiary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {JSON.stringify(preview.overrides, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          {preview && (
            <button
              onClick={handleSave}
              disabled={state === 'saving' || state === 'done'}
              className={cn(
                'px-4 py-1.5 text-xs rounded font-medium transition-colors',
                state === 'saving' || state === 'done'
                  ? 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                  : 'bg-accent-blue text-white hover:bg-accent-blue/90',
              )}
            >
              {state === 'saving' ? 'Saving...' : state === 'done' ? 'Saved!' : 'Save Preset'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
