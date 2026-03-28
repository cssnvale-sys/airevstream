'use client';

import { useState, useCallback, useEffect } from 'react';
import { Save, Sparkles, ImageIcon } from 'lucide-react';
import { LoadingButton } from '@/components/ui/loading-button';
import { apiPut, apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { FileUpload } from '@/components/ui/file-upload';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { BUCKETS } from '@airevstream/shared';
import { cn } from '@/lib/utils';
import type { UploadResult } from '@/hooks/use-upload';

interface BrandingEditorProps {
  channelId: string;
  branding: {
    id: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    colors: Record<string, string>;
    fonts: Record<string, string>;
  } | null;
  onUpdated: () => void;
}

export function BrandingEditor({ channelId, branding, onUpdated }: BrandingEditorProps) {
  const [logoKey, setLogoKey] = useState<string | null>(branding?.logoUrl ?? null);
  const [bannerKey, setBannerKey] = useState<string | null>(branding?.bannerUrl ?? null);
  const [colors, setColors] = useState<Record<string, string>>(
    branding?.colors ?? { primary: '#3b82f6', secondary: '#1e293b', accent: '#8b5cf6' },
  );
  const [fonts, setFonts] = useState<Record<string, string>>(
    branding?.fonts ?? { heading: '', body: '' },
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Sync state when branding prop changes
  useEffect(() => {
    setLogoKey(branding?.logoUrl ?? null);
    setBannerKey(branding?.bannerUrl ?? null);
    setColors(branding?.colors ?? { primary: '#3b82f6', secondary: '#1e293b', accent: '#8b5cf6' });
    setFonts(branding?.fonts ?? { heading: '', body: '' });
  }, [branding]);

  const { url: logoUrl, isLoading: logoLoading } = usePresignedUrl(
    logoKey ? BUCKETS.BRANDING : null,
    logoKey,
  );
  const { url: bannerUrl, isLoading: bannerLoading } = usePresignedUrl(
    bannerKey ? BUCKETS.BRANDING : null,
    bannerKey,
  );

  const handleLogoUploaded = useCallback((ref: UploadResult) => {
    setLogoKey(ref.key);
  }, []);

  const handleBannerUploaded = useCallback((ref: UploadResult) => {
    setBannerKey(ref.key);
  }, []);

  const handleColorChange = useCallback((key: string, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFontChange = useCallback((key: string, value: string) => {
    setFonts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut(`/channels/${channelId}/branding`, {
        logoUrl: logoKey,
        bannerUrl: bannerKey,
        colors,
        fonts,
      });
      toast.success('Branding saved');
      onUpdated();
    } catch (err) {
      console.error('Failed to save branding:', err);
      toast.error('Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiPost(`/channels/${channelId}/branding/generate`, { type: 'logo' });
      toast.success('Generation started');
      onUpdated();
    } catch (err) {
      console.error('Failed to generate branding:', err);
      toast.error('Failed to generate branding');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo & Banner row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logo */}
        <div>
          <label className="block text-body text-text-secondary mb-2">Logo</label>
          {logoUrl && (
            <div className={cn(
              'w-full h-32 rounded-md overflow-hidden bg-bg-tertiary flex items-center justify-center mb-2',
              logoLoading && 'animate-pulse',
            )}>
              <img src={logoUrl} alt="Channel logo" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {!logoUrl && !logoLoading && (
            <div className="w-full h-32 rounded-md bg-bg-tertiary flex items-center justify-center mb-2">
              <ImageIcon size={32} className="text-text-tertiary" />
            </div>
          )}
          <FileUpload
            bucket={BUCKETS.BRANDING}
            accept="image/*"
            maxSizeMB={5}
            onUploaded={handleLogoUploaded}
            disabled={saving}
          />
        </div>

        {/* Banner */}
        <div>
          <label className="block text-body text-text-secondary mb-2">Banner</label>
          {bannerUrl && (
            <div className={cn(
              'w-full h-32 rounded-md overflow-hidden bg-bg-tertiary flex items-center justify-center mb-2',
              bannerLoading && 'animate-pulse',
            )}>
              <img src={bannerUrl} alt="Channel banner" className="w-full h-full object-cover" />
            </div>
          )}
          {!bannerUrl && !bannerLoading && (
            <div className="w-full h-32 rounded-md bg-bg-tertiary flex items-center justify-center mb-2">
              <ImageIcon size={32} className="text-text-tertiary" />
            </div>
          )}
          <FileUpload
            bucket={BUCKETS.BRANDING}
            accept="image/*"
            maxSizeMB={10}
            onUploaded={handleBannerUploaded}
            disabled={saving}
          />
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="block text-body text-text-secondary mb-2">Colors</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(['primary', 'secondary', 'accent'] as const).map((colorKey) => (
            <div key={colorKey} className="flex items-center gap-2">
              <input
                id={`brand-color-${colorKey}`}
                type="color"
                value={colors[colorKey] ?? '#000000'}
                onChange={(e) => handleColorChange(colorKey, e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                disabled={saving}
                aria-label={`${colorKey.charAt(0).toUpperCase() + colorKey.slice(1)} color picker`}
              />
              <div className="flex-1 min-w-0">
                <label htmlFor={`brand-color-hex-${colorKey}`} className="text-xs text-text-secondary capitalize">{colorKey}</label>
                <input
                  id={`brand-color-hex-${colorKey}`}
                  type="text"
                  value={colors[colorKey] ?? ''}
                  onChange={(e) => handleColorChange(colorKey, e.target.value)}
                  className="w-full px-2 py-1 rounded bg-bg-primary border border-border text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  placeholder="#000000"
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <label className="block text-body text-text-secondary mb-2">Fonts</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="font-heading" className="block text-xs text-text-tertiary mb-1">
              Heading
            </label>
            <input
              id="font-heading"
              type="text"
              value={fonts.heading ?? ''}
              onChange={(e) => handleFontChange('heading', e.target.value)}
              className="input w-full text-sm"
              placeholder="e.g. Inter, Montserrat"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="font-body" className="block text-xs text-text-tertiary mb-1">
              Body
            </label>
            <input
              id="font-body"
              type="text"
              value={fonts.body ?? ''}
              onChange={(e) => handleFontChange('body', e.target.value)}
              className="input w-full text-sm"
              placeholder="e.g. Open Sans, Roboto"
              disabled={saving}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <LoadingButton
          onClick={handleSave}
          loading={saving}
          loadingText="Saving..."
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-body bg-accent-blue text-white hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          Save Branding
        </LoadingButton>
        <LoadingButton
          onClick={handleGenerate}
          loading={generating}
          loadingText="Generating..."
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-body border border-border text-text-secondary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={16} />
          Auto-generate
        </LoadingButton>
      </div>
    </div>
  );
}
