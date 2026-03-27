'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { FileUpload } from '@/components/ui/file-upload';
import { LoadingButton } from '@/components/ui/loading-button';
import { BUCKETS } from '@airevstream/shared';
import type { UploadResult } from '@/hooks/use-upload';

interface CreateAvatarModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateAvatarModal({ open, onClose, onCreated }: CreateAvatarModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faceUpload, setFaceUpload] = useState<UploadResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => nameRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, submitting, onClose]);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setFaceUpload(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    resetForm();
    onClose();
  }, [submitting, resetForm, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      // Step 1: Create the avatar
      const res = await apiPost<{ success: boolean; data: { id: string } }>('/avatars', {
        name: name.trim(),
        description: description.trim()
          ? { physical: description.trim() }
          : undefined,
      });

      const avatarId = res.data.id;

      // Step 2: Attach face image if uploaded
      if (faceUpload) {
        await apiPost(`/avatars/${avatarId}/images`, {
          slot: 'face',
          bucket: faceUpload.bucket,
          key: faceUpload.key,
        });
      }

      toast.success('Avatar created');
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create avatar:', err);
      toast.error('Failed to create avatar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-avatar-title"
    >
      <div
        className="card w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="create-avatar-title" className="text-h3 text-text-primary">
            New Avatar
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 rounded"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="avatar-name" className="block text-body text-text-secondary mb-1">
              Name <span className="text-accent-red">*</span>
            </label>
            <input
              ref={nameRef}
              id="avatar-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="e.g. Alex the Tech Reviewer"
              required
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="avatar-description" className="block text-body text-text-secondary mb-1">
              Description
            </label>
            <textarea
              id="avatar-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="Physical description, personality traits, style notes..."
              disabled={submitting}
            />
          </div>

          {/* Face image upload */}
          <div>
            <label className="block text-body text-text-secondary mb-1">
              Face Image
            </label>
            <FileUpload
              bucket={BUCKETS.AVATARS}
              accept="image/*"
              maxSizeMB={10}
              onUploaded={setFaceUpload}
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={submitting}
              disabled={!name.trim()}
              loadingText="Creating..."
              className="btn-primary"
            >
              Create Avatar
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
