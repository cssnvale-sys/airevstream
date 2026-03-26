'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Loader2, Check, X } from 'lucide-react';
import { useUpload, type UploadResult } from '@/hooks/use-upload';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  bucket: string;
  onUploaded: (ref: UploadResult) => void;
  disabled?: boolean;
}

export function FileUpload({
  accept = 'image/*',
  maxSizeMB = 10,
  bucket,
  onUploaded,
  disabled = false,
}: FileUploadProps) {
  const { upload, uploading, progress, error: uploadError, reset } = useUpload();
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [completedFile, setCompletedFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Validate size
      if (file.size > maxSizeBytes) {
        return `File exceeds maximum size of ${maxSizeMB}MB`;
      }

      // Validate type against accept string
      if (accept && accept !== '*') {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileType = file.type;
        const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;

        const isAccepted = acceptedTypes.some((accepted) => {
          if (accepted.startsWith('.')) {
            return fileExt === accepted.toLowerCase();
          }
          if (accepted.endsWith('/*')) {
            const category = accepted.split('/')[0];
            return fileType.startsWith(`${category}/`);
          }
          return fileType === accepted;
        });

        if (!isAccepted) {
          return `File type not accepted. Allowed: ${accept}`;
        }
      }

      return null;
    },
    [accept, maxSizeBytes, maxSizeMB],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setValidationError(null);
      setCompletedFile(null);
      reset();

      const err = validateFile(file);
      if (err) {
        setValidationError(err);
        return;
      }

      try {
        const result = await upload(file, bucket);
        setCompletedFile(result.fileName);
        onUploaded(result);
      } catch {
        // Error state is already set by useUpload
      }
    },
    [bucket, onUploaded, upload, reset, validateFile],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !uploading) {
        setDragOver(true);
      }
    },
    [disabled, uploading],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (disabled || uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, uploading, handleFile],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input value so the same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  }, [disabled, uploading]);

  const displayError = validationError || uploadError;

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
          'cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-50',
          uploading && 'cursor-wait',
          dragOver
            ? 'border-accent-blue bg-accent-blue/10'
            : 'border-border bg-bg-secondary hover:bg-bg-tertiary',
          displayError && 'border-accent-red',
          completedFile && !uploading && !displayError && 'border-green-500',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            <p className="text-sm text-text-secondary">Uploading...</p>
            <div className="w-full max-w-xs">
              <div className="h-2 w-full rounded-full bg-bg-tertiary">
                <div
                  className="h-2 rounded-full bg-accent-blue transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-text-secondary">
                {progress}%
              </p>
            </div>
          </>
        ) : completedFile && !displayError ? (
          <>
            <Check className="h-8 w-8 text-green-500" />
            <p className="text-sm text-text-primary">{completedFile}</p>
            <p className="text-xs text-text-secondary">
              Click or drag to replace
            </p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-text-secondary" />
            <p className="text-sm text-text-primary">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-text-secondary">
              {accept === 'image/*' ? 'Images' : accept} up to {maxSizeMB}MB
            </p>
          </>
        )}
      </div>

      {displayError && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-accent-red">
          <X className="h-4 w-4 flex-shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}
