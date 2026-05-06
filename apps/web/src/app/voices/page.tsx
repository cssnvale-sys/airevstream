'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { EmptyState } from '@/components/ui/empty-state';
import { useApi, apiPost, apiDelete } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { Mic, Plus, Play, Trash2, Loader2, Volume2, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Voice {
  voiceId: string;
  name: string;
  description?: string;
  previewUrl?: string;
  samples: Array<{
    sampleId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  category: 'cloned' | 'generated' | 'premade';
  createdAt: string;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-12 w-12 rounded-xl bg-bg-tertiary mb-4" />
      <div className="h-5 w-32 bg-bg-tertiary rounded mb-2" />
      <div className="h-4 w-20 bg-bg-tertiary rounded" />
    </div>
  );
}

export default function VoicesPage() {
  const { data: voicesRes, isLoading, error: voicesError, mutate } = useApi<Voice[]>('/voices');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);

  const voices = (voicesRes as any)?.data ?? [];
  const clonedVoices = voices.filter((v: Voice) => v.category === 'cloned');
  const premadeVoices = voices.filter((v: Voice) => v.category === 'premade');

  // Handle error state
  if (voicesError) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-accent-red" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Failed to load voices</h2>
            <p className="text-sm text-text-secondary mb-6">
              {voicesError instanceof Error ? voicesError.message : 'An error occurred while loading voices.'}
            </p>
            <button type="button" onClick={() => mutate()} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleDelete = useCallback(async (voiceId: string) => {
    if (!confirm('Are you sure you want to delete this voice? This action cannot be undone.')) {
      return;
    }

    setDeletingVoiceId(voiceId);
    try {
      await apiDelete(`/voices/${voiceId}`);
      toast.success('Voice deleted successfully');
      mutate();
    } catch (err) {
      toast.error('Failed to delete voice');
    } finally {
      setDeletingVoiceId(null);
    }
  }, [mutate]);

  const handlePreview = useCallback(async (voice: Voice) => {
    if (!voice.previewUrl) {
      toast.info('No preview available for this voice');
      return;
    }

    setPreviewingVoiceId(voice.voiceId);
    const audio = new Audio(voice.previewUrl);
    audio.onended = () => setPreviewingVoiceId(null);
    audio.onerror = () => {
      toast.error('Failed to play preview');
      setPreviewingVoiceId(null);
    };
    await audio.play();
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-page-title text-text-primary">Voice Library</h1>
            <p className="text-text-secondary mt-1">
              Manage cloned voices and voice profiles for your content.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Clone Voice
          </button>
        </div>
      </div>

      {/* Cloned Voices Section */}
      <div className="mb-8">
        <h2 className="text-section-heading text-text-primary mb-4 flex items-center gap-2">
          <Mic size={18} className="text-accent-purple" />
          Your Cloned Voices
          <span className="text-sm font-normal text-text-secondary">({clonedVoices.length})</span>
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : clonedVoices.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No cloned voices yet"
            description="Clone your voice or create custom voice profiles for consistent narration across your content."
            action={{ label: 'Clone Your First Voice', onClick: () => setShowCreateModal(true), icon: Plus }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clonedVoices.map((voice: Voice) => (
              <div key={voice.voiceId} className="card group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                    <Mic size={24} className="text-accent-purple" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePreview(voice)}
                      disabled={previewingVoiceId === voice.voiceId || !voice.previewUrl}
                      className="btn-icon btn-sm"
                      title="Play preview"
                    >
                      {previewingVoiceId === voice.voiceId ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(voice.voiceId)}
                      disabled={deletingVoiceId === voice.voiceId}
                      className="btn-icon btn-sm text-accent-red hover:text-accent-red"
                      title="Delete voice"
                    >
                      {deletingVoiceId === voice.voiceId ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-text-primary truncate" title={voice.name}>
                  {voice.name}
                </h3>
                {voice.description && (
                  <p className="text-sm text-text-secondary truncate mt-1">{voice.description}</p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Volume2 size={12} />
                    {voice.samples.length} sample{voice.samples.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(voice.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Premade Voices Section */}
      <div>
        <h2 className="text-section-heading text-text-primary mb-4 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-accent-green" />
          Premade Voices
          <span className="text-sm font-normal text-text-secondary">({premadeVoices.length})</span>
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {premadeVoices.map((voice: Voice) => (
              <div key={voice.voiceId} className="card opacity-75">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
                    <Volume2 size={18} className="text-text-secondary" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePreview(voice)}
                    disabled={previewingVoiceId === voice.voiceId || !voice.previewUrl}
                    className="btn-icon btn-sm"
                    title={!voice.previewUrl ? 'No preview available for this voice' : 'Play preview'}
                  >
                    {previewingVoiceId === voice.voiceId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                </div>
                <h3 className="font-medium text-text-primary text-sm truncate">{voice.name}</h3>
                <span className="badge mt-2">{voice.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <VoiceCloneModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            mutate();
          }}
        />
      )}
    </AppLayout>
  );
}

function VoiceCloneModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const audioFiles = selected.filter(f => f.type.startsWith('audio/'));
    if (audioFiles.length !== selected.length) {
      toast.warning('Some files were skipped (only audio files allowed)');
    }
    setFiles(prev => [...prev, ...audioFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a name for the voice');
      return;
    }
    if (files.length === 0) {
      toast.error('Please upload at least one audio sample');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      if (description) formData.append('description', description.trim());
      files.forEach(file => formData.append('files', file));

      await apiPost('/voices', formData);
      toast.success('Voice clone created successfully!');
      onSuccess();
    } catch (err) {
      toast.error('Failed to create voice clone');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={!isUploading ? onClose : undefined} />
      <div className="relative w-full max-w-lg bg-bg-primary rounded-xl shadow-2xl border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text-primary">Clone New Voice</h2>
          <p className="text-text-secondary text-sm mt-1">
            Upload audio samples to create a custom voice clone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Voice Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., My Voice, Narrator Joe"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description of the voice..."
              className="input w-full h-20 resize-none"
            />
          </div>

          <div>
            <label className="label">Audio Samples *</label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent-blue/50 transition-colors">
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="voice-samples"
              />
              <label htmlFor="voice-samples" className="cursor-pointer">
                <Mic size={32} className="mx-auto mb-2 text-text-secondary" />
                <p className="text-text-secondary text-sm">
                  <span className="text-accent-blue">Click to upload</span> or drag and drop
                </p>
                <p className="text-text-secondary text-xs mt-1">
                  WAV, MP3, or M4A (max 10MB each)
                </p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-bg-secondary rounded-lg">
                    <Volume2 size={16} className="text-accent-blue" />
                    <span className="flex-1 text-sm text-text-primary truncate">{file.name}</span>
                    <span className="text-xs text-text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1 hover:bg-bg-tertiary rounded"
                    >
                      <Trash2 size={14} className="text-accent-red" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !name.trim() || files.length === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Mic size={18} />
                  Clone Voice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
