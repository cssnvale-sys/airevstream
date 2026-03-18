'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useChannels, useAffiliateProducts, apiPost } from '@/hooks/use-api';
import { cn, platformIcon } from '@/lib/utils';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Play,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Channel {
  id: string;
  name: string;
  socialAccount?: { platform: string; username: string } | null;
  tone?: string | null;
  personality?: string | null;
  niches?: string[];
}

interface AffiliateProduct {
  id: string;
  name: string;
  commissionRate: number | null;
}

type ContentType = 'video_short' | 'video_long' | 'image' | 'text' | 'voice' | 'thumbnail';
type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';
type AffiliateMode = 'dedicated' | 'commercial_break';

interface ShotCard {
  id: number | string;
  description: string;
  duration: number;
  imageUrl?: string;
}

type ShotStatus = 'queued' | 'generating' | 'complete' | 'failed';

interface FormData {
  channelId: string;
  topic: string;
  contentType: ContentType;
  platforms: Platform[];
  duration: string;
  affiliateEnabled: boolean;
  affiliateProductId: string;
  affiliateMode: AffiliateMode;
  script: string;
  shots: ShotCard[];
  shotStatuses: Record<string, ShotStatus>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { num: 1, label: 'Channel' },
  { num: 2, label: 'Concept' },
  { num: 3, label: 'Script' },
  { num: 4, label: 'Storyboard' },
  { num: 5, label: 'Generate' },
  { num: 6, label: 'Review' },
] as const;

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'video_short', label: 'Short Video' },
  { value: 'video_long', label: 'Long Video' },
  { value: 'image', label: 'Image' },
  { value: 'text', label: 'Text Post' },
  { value: 'voice', label: 'Voice' },
  { value: 'thumbnail', label: 'Thumbnail' },
];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '180', label: '3 minutes' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
];

const HICC_SECTIONS = ['[HOOK]', '[INTRO]', '[CONTENT]', '[CTA]'] as const;

const INITIAL_FORM: FormData = {
  channelId: '',
  topic: '',
  contentType: 'video_short',
  platforms: [],
  duration: '60',
  affiliateEnabled: false,
  affiliateProductId: '',
  affiliateMode: 'dedicated',
  script: '',
  shots: [],
  shotStatuses: {},
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreatePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API hooks
  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: productsData } = useAffiliateProducts();

  const channels: Channel[] = (channelsData?.data as Channel[] | undefined) ?? [];
  const products: AffiliateProduct[] = (productsData?.data as AffiliateProduct[] | undefined) ?? [];

  const selectedChannel = channels.find((ch) => ch.id === formData.channelId) ?? null;

  // Form helpers
  const update = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setError(null);
    },
    [],
  );

  const togglePlatform = (platform: Platform) => {
    setFormData((prev) => {
      const next = prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform];
      return { ...prev, platforms: next };
    });
  };

  // Step navigation
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.channelId;
      case 2:
        return !!formData.topic.trim() && formData.platforms.length > 0;
      case 3:
        return !!formData.script.trim();
      case 4:
        return formData.shots.length > 0;
      case 5:
        return Object.values(formData.shotStatuses).length > 0 && Object.values(formData.shotStatuses).every((s) => s === 'complete' || s === 'generating' || s === 'failed');
      default:
        return true;
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep || (step === currentStep + 1 && canGoNext())) {
      setCurrentStep(step);
    }
  };

  const goNext = () => {
    if (canGoNext() && currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  // Generate script via API
  const generateScript = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiPost<{ data: { script: string } }>('/content/generate-script', {
        channelId: formData.channelId,
        topic: formData.topic,
        contentType: formData.contentType,
        platforms: formData.platforms,
        duration: parseInt(formData.duration, 10),
        affiliateProductId: formData.affiliateEnabled ? formData.affiliateProductId : undefined,
        affiliateMode: formData.affiliateEnabled ? formData.affiliateMode : undefined,
      });
      update('script', res.data?.script ?? '');
    } catch (err) {
      console.error('Failed to generate script:', err);
      setError('Failed to generate script. Please try again.');
      // Provide a placeholder so the user can still proceed
      if (!formData.script) {
        update(
          'script',
          `[HOOK]\nGrab attention here...\n\n[INTRO]\nIntroduce the topic: ${formData.topic}\n\n[CONTENT]\nMain content goes here...\n\n[CTA]\nCall to action...`,
        );
      }
    } finally {
      setGenerating(false);
    }
  }, [formData.channelId, formData.topic, formData.contentType, formData.platforms, formData.duration, formData.affiliateEnabled, formData.affiliateProductId, formData.affiliateMode, formData.script, update]);

  // Generate storyboard
  const generateStoryboard = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiPost<{ data: { shots: ShotCard[] } }>('/content/generate-storyboard', {
        script: formData.script,
        contentType: formData.contentType,
        duration: parseInt(formData.duration, 10),
      });
      const shots = res.data?.shots ?? [];
      update('shots', shots);
    } catch (err) {
      console.error('Failed to generate storyboard:', err);
      // Provide placeholder shots based on script sections
      const placeholder: ShotCard[] = HICC_SECTIONS.map((section, i) => ({
        id: i + 1,
        description: `${section} — Shot ${i + 1}`,
        duration: Math.round(parseInt(formData.duration, 10) / 4),
      }));
      update('shots', placeholder);
    } finally {
      setGenerating(false);
    }
  }, [formData.script, formData.contentType, formData.duration, update]);

  // Simulate generation progress
  const startGeneration = useCallback(async () => {
    setGenerating(true);
    setError(null);

    // Initialize all shots as queued
    const initialStatuses: Record<string, ShotStatus> = {};
    formData.shots.forEach((shot) => {
      initialStatuses[String(shot.id)] = 'queued';
    });
    update('shotStatuses', initialStatuses);

    // Simulate shot-by-shot generation
    for (const shot of formData.shots) {
      setFormData((prev) => ({
        ...prev,
        shotStatuses: { ...prev.shotStatuses, [String(shot.id)]: 'generating' as ShotStatus },
      }));

      try {
        const res = await apiPost<{ data: { status?: string; jobId?: string; imageUrl?: string } }>('/content/generate-shot', {
          shotId: shot.id,
          description: shot.description,
        });
        const resStatus = res.data?.status;
        const hasImage = !!res.data?.imageUrl;
        // The API returns status 'generating' with a jobId when the BullMQ job is queued.
        // Treat 'generating' (job accepted) as success so the user can proceed.
        const isAccepted = resStatus === 'generating' || resStatus === 'completed' || resStatus === 'done' || hasImage;
        setFormData((prev) => ({
          ...prev,
          shotStatuses: { ...prev.shotStatuses, [String(shot.id)]: (isAccepted ? 'complete' : 'generating') as ShotStatus },
        }));
      } catch (err) {
        console.error(`Failed to generate shot ${shot.id}:`, err);
        setFormData((prev) => ({
          ...prev,
          shotStatuses: { ...prev.shotStatuses, [String(shot.id)]: 'failed' as ShotStatus },
        }));
      }
    }

    setGenerating(false);
  }, [formData.shots, update]);

  // Submit final content
  const handleApproveAndSchedule = async () => {
    setGenerating(true);
    setError(null);
    try {
      await apiPost('/content', {
        channelId: formData.channelId,
        title: formData.topic,
        contentType: formData.contentType,
        platforms: formData.platforms,
        script: formData.script,
        shots: formData.shots,
        affiliateProductId: formData.affiliateEnabled ? formData.affiliateProductId : undefined,
        affiliateMode: formData.affiliateEnabled ? formData.affiliateMode : undefined,
        status: 'scheduled',
      });
      // Reset wizard
      setFormData(INITIAL_FORM);
      setCurrentStep(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save content';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate on step entry
  const handleStepEntry = (step: number) => {
    if (step === 3 && !formData.script) generateScript();
    if (step === 4 && formData.shots.length === 0) generateStoryboard();
    if (step === 5 && Object.keys(formData.shotStatuses).length === 0) startGeneration();
  };

  const navigateToStep = (step: number) => {
    goToStep(step);
    handleStepEntry(step);
  };

  const handleNext = () => {
    const next = currentStep + 1;
    goNext();
    if (currentStep < 6) handleStepEntry(next);
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, i) => {
        const isCompleted = step.num < currentStep;
        const isCurrent = step.num === currentStep;
        return (
          <div key={step.num} className="flex items-center gap-2">
            <button
              onClick={() => navigateToStep(step.num)}
              disabled={step.num > currentStep && !canGoNext()}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-caption font-medium transition-colors whitespace-nowrap',
                isCurrent && 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30',
                isCompleted && 'bg-accent-green/15 text-accent-green cursor-pointer',
                !isCurrent && !isCompleted && 'text-text-secondary',
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-caption font-bold shrink-0',
                  isCurrent && 'bg-accent-blue text-white',
                  isCompleted && 'bg-accent-green text-white',
                  !isCurrent && !isCompleted && 'bg-bg-tertiary text-text-secondary',
                )}
              >
                {isCompleted ? <Check size={14} /> : step.num}
              </span>
              {step.label}
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-px',
                  isCompleted ? 'bg-accent-green' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-text-primary mb-1">Select Channel</h2>
        <p className="text-text-secondary text-caption">Choose which channel this content is for.</p>
      </div>

      {channelsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent-blue" />
        </div>
      ) : (
        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Channel</label>
          <select
            value={formData.channelId}
            onChange={(e) => update('channelId', e.target.value)}
            className="input w-full max-w-md"
          >
            <option value="">Select a channel...</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {platformIcon(ch.socialAccount?.platform ?? '')} {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedChannel && (
        <div className="card max-w-md">
          <h3 className="text-card-title text-text-primary mb-3">Channel Identity</h3>
          <div className="space-y-2 text-body">
            <div className="flex justify-between">
              <span className="text-text-secondary">Platform</span>
              <span className="text-text-primary">
                {platformIcon(selectedChannel?.socialAccount?.platform ?? '')}{' '}
                {(selectedChannel?.socialAccount?.platform ?? '').charAt(0).toUpperCase() + (selectedChannel?.socialAccount?.platform ?? '').slice(1)}
              </span>
            </div>
            {selectedChannel?.personality && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Persona</span>
                <span className="text-text-primary">{selectedChannel.personality}</span>
              </div>
            )}
            {selectedChannel?.tone && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Tone</span>
                <span className="text-text-primary">{selectedChannel.tone}</span>
              </div>
            )}
            {selectedChannel?.niches?.[0] && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Niche</span>
                <span className="text-text-primary">{selectedChannel.niches[0]}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-text-primary mb-1">Concept & Configuration</h2>
        <p className="text-text-secondary text-caption">Define what content to create.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-text-secondary mb-1.5">Topic / Concept</label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="e.g. Top 5 AI Tools for Productivity"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-caption text-text-secondary mb-1.5">Content Type</label>
            <select
              value={formData.contentType}
              onChange={(e) => update('contentType', e.target.value as ContentType)}
              className="input w-full"
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-caption text-text-secondary mb-1.5">Duration</label>
            <select
              value={formData.duration}
              onChange={(e) => update('duration', e.target.value)}
              className="input w-full"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-text-secondary mb-1.5">Platforms</label>
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.value}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors',
                    formData.platforms.includes(p.value)
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-border bg-bg-secondary hover:bg-bg-tertiary',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.platforms.includes(p.value)}
                    onChange={() => togglePlatform(p.value)}
                    className="rounded border-border text-accent-blue focus:ring-accent-blue"
                  />
                  <span className="text-body text-text-primary">
                    {platformIcon(p.value)} {p.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Affiliate Integration */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-card-title text-text-primary">Affiliate Integration</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.affiliateEnabled}
              onChange={(e) => update('affiliateEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-bg-tertiary peer-focus:ring-2 peer-focus:ring-accent-blue/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-blue" />
          </label>
        </div>

        {formData.affiliateEnabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-caption text-text-secondary mb-1.5">Product</label>
              <select
                value={formData.affiliateProductId}
                onChange={(e) => update('affiliateProductId', e.target.value)}
                className="input w-full"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.commissionRate ?? 0}% commission)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-caption text-text-secondary mb-1.5">Integration Mode</label>
              <div className="flex gap-4">
                {(['dedicated', 'commercial_break'] as AffiliateMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors',
                      formData.affiliateMode === mode
                        ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                        : 'border-border text-text-secondary hover:bg-bg-tertiary',
                    )}
                  >
                    <input
                      type="radio"
                      name="affiliateMode"
                      value={mode}
                      checked={formData.affiliateMode === mode}
                      onChange={() => update('affiliateMode', mode)}
                      className="text-accent-blue focus:ring-accent-blue"
                    />
                    <span className="text-body capitalize">{mode.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section-heading text-text-primary mb-1">Script</h2>
          <p className="text-text-secondary text-caption">
            AI-generated script following H.I.C.C. structure.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateScript}
            disabled={generating}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            Regenerate
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-md px-4 py-3 text-caption text-accent-red">
          {error}
        </div>
      )}

      {/* H.I.C.C. section labels */}
      <div className="flex gap-2 flex-wrap">
        {HICC_SECTIONS.map((section) => (
          <span
            key={section}
            className="badge bg-accent-purple/15 text-accent-purple"
          >
            {section}
          </span>
        ))}
      </div>

      {generating && !formData.script ? (
        <div className="flex items-center justify-center py-16 card">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-accent-blue mx-auto mb-3" />
            <p className="text-text-secondary text-body">Generating script...</p>
          </div>
        </div>
      ) : (
        <textarea
          value={formData.script}
          onChange={(e) => update('script', e.target.value)}
          className="input w-full font-mono text-body"
          rows={20}
          placeholder="Script will appear here after generation..."
        />
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section-heading text-text-primary mb-1">Storyboard</h2>
          <p className="text-text-secondary text-caption">Visual breakdown of each shot.</p>
        </div>
        <button
          onClick={generateStoryboard}
          disabled={generating}
          className="btn-secondary btn-sm flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          Regenerate
        </button>
      </div>

      {generating && formData.shots.length === 0 ? (
        <div className="flex items-center justify-center py-16 card">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-accent-blue mx-auto mb-3" />
            <p className="text-text-secondary text-body">Generating storyboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Shot cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {formData.shots.map((shot) => (
              <div key={shot.id} className="card p-4">
                {/* Placeholder image */}
                <div className="aspect-video bg-bg-tertiary rounded-md flex items-center justify-center mb-3 border border-border">
                  {shot.imageUrl ? (
                    <img
                      src={shot.imageUrl}
                      alt={`Shot ${shot.id}`}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <ImageIcon size={32} className="text-text-secondary" />
                  )}
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="badge bg-accent-blue/15 text-accent-blue">
                    Shot {shot.id}
                  </span>
                  <span className="text-caption text-text-secondary">{shot.duration}s</span>
                </div>
                <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                  {shot.description}
                </p>
              </div>
            ))}
          </div>

          {/* Timeline bar */}
          {formData.shots.length > 0 && (
            <div className="card p-4">
              <h3 className="text-card-title text-text-primary mb-3">Timeline</h3>
              <div className="flex rounded-md overflow-hidden border border-border">
                {formData.shots.map((shot, i) => {
                  const totalDuration = formData.shots.reduce((sum, s) => sum + s.duration, 0);
                  const widthPercent = totalDuration > 0 ? (shot.duration / totalDuration) * 100 : 0;
                  const colors = [
                    'bg-accent-blue',
                    'bg-accent-green',
                    'bg-accent-amber',
                    'bg-accent-purple',
                    'bg-accent-red',
                  ];
                  return (
                    <div
                      key={shot.id}
                      className={cn(
                        'py-2 px-1 text-center text-caption text-white font-medium',
                        colors[i % colors.length],
                      )}
                      style={{ width: `${widthPercent}%`, minWidth: '40px' }}
                    >
                      S{shot.id}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-caption text-text-secondary">
                <span>0s</span>
                <span>{formData.shots.reduce((sum, s) => sum + s.duration, 0)}s</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderStep5 = () => {
    const statusIcon = (status: ShotStatus) => {
      switch (status) {
        case 'queued':
          return <div className="w-4 h-4 rounded-full bg-bg-tertiary border border-border" />;
        case 'generating':
          return <Loader2 size={16} className="animate-spin text-accent-blue" />;
        case 'complete':
          return (
            <div className="w-4 h-4 rounded-full bg-accent-green flex items-center justify-center">
              <Check size={10} className="text-white" />
            </div>
          );
        case 'failed':
          return <div className="w-4 h-4 rounded-full bg-accent-red" />;
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-section-heading text-text-primary mb-1">Generating Content</h2>
          <p className="text-text-secondary text-caption">
            Processing each shot. This may take a few minutes.
          </p>
        </div>

        <div className="card space-y-4">
          {formData.shots.map((shot) => {
            const status = formData.shotStatuses[shot.id] ?? 'queued';
            return (
              <div
                key={shot.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-md border',
                  status === 'generating' ? 'border-accent-blue/30 bg-accent-blue/5' : 'border-border',
                )}
              >
                {statusIcon(status)}
                <div className="flex-1">
                  <p className="text-body text-text-primary font-medium">Shot {shot.id}</p>
                  <p className="text-caption text-text-secondary">{shot.description}</p>
                </div>
                <span
                  className={cn(
                    'text-caption font-medium capitalize',
                    status === 'complete' && 'text-accent-green',
                    status === 'generating' && 'text-accent-blue',
                    status === 'failed' && 'text-accent-red',
                    status === 'queued' && 'text-text-secondary',
                  )}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </div>

        {!generating && (
          <button onClick={startGeneration} className="btn-primary flex items-center gap-2">
            <Play size={16} />
            Restart Generation
          </button>
        )}
      </div>
    );
  };

  const renderStep6 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-text-primary mb-1">Review & Approve</h2>
        <p className="text-text-secondary text-caption">
          Review your content before scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview panel */}
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Preview</h3>
          <div className="aspect-video bg-bg-tertiary rounded-md flex items-center justify-center border border-border">
            <div className="text-center">
              <Play size={48} className="text-text-secondary mx-auto mb-2" />
              <p className="text-caption text-text-secondary">Video preview will appear here</p>
            </div>
          </div>
        </div>

        {/* Metadata summary */}
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Content Summary</h3>
          <div className="space-y-3 text-body">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Channel</span>
              <span className="text-text-primary">{selectedChannel?.name ?? '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Topic</span>
              <span className="text-text-primary">{formData.topic}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Type</span>
              <span className="text-text-primary capitalize">
                {formData.contentType.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Platforms</span>
              <span className="text-text-primary">
                {formData.platforms.map((p) => platformIcon(p)).join(' ')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Duration</span>
              <span className="text-text-primary">
                {DURATION_OPTIONS.find((d) => d.value === formData.duration)?.label ?? formData.duration + 's'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Shots</span>
              <span className="text-text-primary">{formData.shots.length}</span>
            </div>
            {formData.affiliateEnabled && (
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Affiliate</span>
                <span className="text-text-primary capitalize">
                  {products.find((p) => p.id === formData.affiliateProductId)?.name ?? '-'} ({formData.affiliateMode.replace('_', ' ')})
                </span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-text-secondary">Script Length</span>
              <span className="text-text-primary">{formData.script.length} chars</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-md px-4 py-3 text-caption text-accent-red">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApproveAndSchedule}
          disabled={generating}
          className="btn-primary flex items-center gap-2"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Approve & Schedule
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          className="btn-secondary"
        >
          Reject & Edit Script
        </button>
        <button
          onClick={() => {
            setFormData((prev) => ({ ...prev, shots: [], shotStatuses: {} }));
            setCurrentStep(4);
          }}
          className="btn-ghost"
        >
          Regenerate
        </button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-page-title text-text-primary">Create Content</h1>
        <p className="text-text-secondary mt-1">
          Step-by-step wizard to generate and publish content.
        </p>
      </div>

      {renderStepIndicator()}

      {renderCurrentStep()}

      {/* Navigation buttons */}
      {currentStep < 6 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <button
            onClick={goBack}
            disabled={currentStep === 1}
            className="btn-secondary flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canGoNext() || generating}
            className="btn-primary flex items-center gap-2"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </AppLayout>
  );
}
