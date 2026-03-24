'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChannels, apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { SIMPLE_MODE_GUARDRAILS, VISUAL_PRESETS, ALL_BUILT_IN_PRESETS } from '@airevstream/shared';
import type { ProductionDirectives, Recipe } from '@airevstream/shared';
import { IntakeScreen } from './intake-screen';
import type { IntakeResult } from './intake-screen';
import { PlanReviewCard } from './plan-review-card';
import { PipelineProgress } from './pipeline-progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Channel {
  id: string;
  name: string;
  socialAccount?: { platform: string; username: string } | null;
}

interface SimpleFormData {
  channelId: string;
  recipeId: string;
  category: string;
  topic: string;
  characterDescription: string;
  setting: string;
  emotion: string;
  hasSpeaking: boolean;
  duration: string;
  overrides: Record<string, unknown>;
  directives: ProductionDirectives;
}

const STEPS_SIMPLE = [
  { num: 1, label: 'Intake' },
  { num: 2, label: 'Describe' },
  { num: 3, label: 'Review' },
  { num: 4, label: 'Making it' },
] as const;

const SIMPLE_DURATIONS = SIMPLE_MODE_GUARDRAILS.ALLOWED_DURATIONS.map((d) => ({
  value: String(d),
  label: d < 60 ? `${d} seconds` : `${d / 60} minute`,
}));

const EMOTION_OPTIONS = [
  { value: 'exciting', label: 'Exciting' },
  { value: 'calm', label: 'Calm' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'funny', label: 'Funny' },
  { value: 'inspiring', label: 'Inspiring' },
  { value: 'mysterious', label: 'Mysterious' },
];

const INITIAL_SIMPLE_FORM: SimpleFormData = {
  channelId: '',
  recipeId: '',
  category: '',
  topic: '',
  characterDescription: '',
  setting: '',
  emotion: 'exciting',
  hasSpeaking: true,
  duration: '30',
  overrides: {},
  directives: {},
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SimpleCreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SimpleFormData>(INITIAL_SIMPLE_FORM);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [generating, setGenerating] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [planSummary, setPlanSummary] = useState<{
    title: string;
    concept: string;
    sceneCount: number;
    shotCount: number;
  } | null>(null);

  const { data: channelsData, isLoading: channelsLoading } = useChannels<Channel[]>();
  const channels = channelsData?.data ?? [];

  // Auto-select single channel
  const effectiveChannelId = form.channelId || (channels.length === 1 ? channels[0].id : '');

  const update = useCallback(
    <K extends keyof SimpleFormData>(key: K, value: SimpleFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const mergeOverrides = useCallback((newOverrides: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, ...newOverrides },
    }));
  }, []);

  // ---- Intake completion ----

  const handleIntakeComplete = useCallback((result: IntakeResult) => {
    setSelectedRecipe(result.recipe);
    setForm((prev) => ({
      ...prev,
      recipeId: result.recipe.id,
      category: result.category,
      overrides: { ...prev.overrides, ...result.resolvedOverrides },
      directives: result.directives,
    }));
    setStep(2);
  }, []);

  // ---- Navigation ----

  const canGoNext = (): boolean => {
    switch (step) {
      case 1:
        return !!form.recipeId; // IntakeScreen handles its own validation
      case 2:
        return form.topic.trim().length >= 3;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (canGoNext() && step < 4) {
      const next = step + 1;
      setStep(next);
      if (next === 3 && !planSummary) generatePlan();
      if (next === 4 && !contentId) startPipeline();
    }
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  // ---- API Actions ----

  const generatePlan = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await apiPost<{
        data: { title: string; concept: string; sceneCount: number; shotCount: number };
      }>('/content/generate-script', {
        channelId: effectiveChannelId,
        topic: form.topic,
        contentType: 'video_short',
        platforms: ['youtube'],
        duration: parseInt(form.duration, 10),
        setting: form.setting,
        emotion: form.emotion,
        hasSpeaking: form.hasSpeaking,
        characterDescription: form.characterDescription,
      });
      setPlanSummary({
        title: res.data?.title ?? form.topic,
        concept: res.data?.concept ?? `A ${form.emotion} video about ${form.topic}`,
        sceneCount: res.data?.sceneCount ?? 3,
        shotCount: res.data?.shotCount ?? Math.min(
          form.directives.targetShotCount ?? Math.ceil(parseInt(form.duration, 10) / 5),
          SIMPLE_MODE_GUARDRAILS.MAX_SHOTS,
        ),
      });
    } catch (err) {
      console.error('Failed to generate plan:', err);
      const shotCount = Math.min(
        form.directives.targetShotCount ?? Math.ceil(parseInt(form.duration, 10) / 5),
        SIMPLE_MODE_GUARDRAILS.MAX_SHOTS,
      );
      setPlanSummary({
        title: form.topic,
        concept: `A ${form.emotion} video about ${form.topic}`,
        sceneCount: Math.ceil(shotCount / 3),
        shotCount,
      });
    } finally {
      setGenerating(false);
    }
  }, [effectiveChannelId, form.topic, form.duration, form.setting, form.emotion, form.hasSpeaking, form.characterDescription, form.directives.targetShotCount]);

  const startPipeline = useCallback(async () => {
    setGenerating(true);
    try {
      const contentRes = await apiPost<{ data: { id: string } }>('/content', {
        channelId: effectiveChannelId,
        title: form.topic,
        contentType: 'video_short',
        platforms: ['youtube'],
        script: '',
        shots: [],
        status: 'generating',
      });
      const id = contentRes.data?.id;
      if (id) {
        setContentId(id);
        await apiPost('/pipeline/cinema', {
          contentId: id,
          channelId: effectiveChannelId,
          topic: form.topic,
          contentType: 'short',
          qualityPreset: 'cinema',
          duration: parseInt(form.duration, 10),
          overrides: form.overrides,
          directives: form.directives,
          setting: form.setting,
          emotion: form.emotion,
          characterDescription: form.characterDescription,
          hasSpeaking: form.hasSpeaking,
        });
        toast.success('Cinema pipeline started!');
      }
    } catch (err) {
      console.error('Failed to start pipeline:', err);
      toast.error('Failed to start pipeline');
    } finally {
      setGenerating(false);
    }
  }, [effectiveChannelId, form]);

  // ---- Screens ----

  const renderScreen1 = () => (
    <div className="space-y-6">
      {/* Channel selector — only show if multiple channels */}
      {channels.length > 1 && (
        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Channel</label>
          <select
            value={form.channelId}
            onChange={(e) => update('channelId', e.target.value)}
            className="input w-full max-w-sm"
          >
            <option value="">Select a channel...</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {channels.length === 1 && (
        <div className="text-sm text-text-secondary">
          Channel: <span className="text-text-primary font-medium">{channels[0].name}</span>
        </div>
      )}

      {channelsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-accent-blue" />
        </div>
      )}

      <IntakeScreen onComplete={handleIntakeComplete} />
    </div>
  );

  const renderScreen2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-text-primary mb-1">Describe it</h2>
        <p className="text-text-secondary text-caption">
          Tell us about your video in plain words.
          {selectedRecipe && (
            <span className="ml-1 text-accent-blue">
              Using: {selectedRecipe.name}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="md:col-span-2">
          <label className="block text-caption text-text-secondary mb-1.5">Topic</label>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => update('topic', e.target.value)}
            placeholder="e.g. Top 5 places to visit in Japan"
            className="input w-full"
            required
            minLength={3}
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Character (optional)</label>
          <input
            type="text"
            value={form.characterDescription}
            onChange={(e) => update('characterDescription', e.target.value)}
            placeholder="e.g. a friendly travel host"
            className="input w-full"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Setting (optional)</label>
          <input
            type="text"
            value={form.setting}
            onChange={(e) => update('setting', e.target.value)}
            placeholder="e.g. cherry blossom garden"
            className="input w-full"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Mood</label>
          <div className="flex flex-wrap gap-2">
            {EMOTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('emotion', opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-caption border transition-colors',
                  form.emotion === opt.value
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-border text-text-secondary hover:bg-bg-tertiary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Duration</label>
          <div className="flex gap-2">
            {SIMPLE_DURATIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => update('duration', d.value)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-md text-caption border text-center transition-colors',
                  form.duration === d.value
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue font-medium'
                    : 'border-border text-text-secondary hover:bg-bg-tertiary',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-caption text-text-secondary mb-1.5">Speaking</label>
          <div className="flex gap-3">
            {[
              { value: true, label: 'Yes, with voice' },
              { value: false, label: 'No, music only' },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => update('hasSpeaking', opt.value)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-md text-caption border text-center transition-colors',
                  form.hasSpeaking === opt.value
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue font-medium'
                    : 'border-border text-text-secondary hover:bg-bg-tertiary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderScreen3 = () => {
    const durationSec = parseInt(form.duration, 10) || 30;
    const summary = planSummary ?? {
      title: form.topic,
      concept: `A ${form.emotion} video about ${form.topic}`,
      sceneCount: 3,
      shotCount: Math.min(
        form.directives.targetShotCount ?? Math.ceil(durationSec / 5),
        SIMPLE_MODE_GUARDRAILS.MAX_SHOTS,
      ),
    };

    const visualName = selectedRecipe?.name ?? 'Default';
    const outputFormat = (form.overrides.aspect as string) ?? '16:9';

    if (generating && !planSummary) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-accent-blue mx-auto mb-3" />
            <p className="text-text-secondary text-body">Building your plan...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-section-heading text-text-primary mb-1">Review your plan</h2>
          <p className="text-text-secondary text-caption">Tweak with the buttons below, or go ahead.</p>
        </div>

        <PlanReviewCard
          plan={{
            title: summary.title,
            concept: summary.concept,
            sceneCount: summary.sceneCount,
            shotCount: summary.shotCount,
            durationSec,
            visualStyle: visualName,
            audioMood: form.emotion,
            characterType: form.category,
            outputFormat,
          }}
          onRevise={mergeOverrides}
          onRegenerate={() => generatePlan()}
          regenerating={generating}
        />
      </div>
    );
  };

  const renderScreen4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-text-primary mb-1">Making your video</h2>
        <p className="text-text-secondary text-caption">
          Sit back while the AI creates your content.
        </p>
      </div>

      {contentId ? (
        <>
          <PipelineProgress contentId={contentId} simplifiedLabels />
          <button
            onClick={() => router.push(`/studio/${contentId}`)}
            className="btn-primary flex items-center gap-2"
          >
            <Clapperboard size={16} />
            Open in Studio
          </button>
        </>
      ) : generating ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-accent-blue mx-auto mb-3" />
            <p className="text-text-secondary text-body">Starting pipeline...</p>
          </div>
        </div>
      ) : (
        <button onClick={startPipeline} className="btn-primary flex items-center gap-2">
          <Sparkles size={16} />
          Start Making
        </button>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderScreen1();
      case 2: return renderScreen2();
      case 3: return renderScreen3();
      case 4: return renderScreen4();
      default: return null;
    }
  };

  // ---- Step Indicator ----

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption text-text-secondary font-medium">
          Step {step} of {STEPS_SIMPLE.length}
        </span>
        <div className="h-1.5 flex-1 mx-4 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-blue rounded-full transition-all duration-300"
            style={{ width: `${(step / STEPS_SIMPLE.length) * 100}%` }}
          />
        </div>
        <span className="text-caption text-text-secondary">
          {Math.round((step / STEPS_SIMPLE.length) * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS_SIMPLE.map((s, i) => {
          const isCompleted = s.num < step;
          const isCurrent = s.num === step;
          return (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s.num < step) setStep(s.num);
                }}
                disabled={s.num > step}
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
                  {isCompleted ? <Check size={14} /> : s.num}
                </span>
                {s.label}
              </button>
              {i < STEPS_SIMPLE.length - 1 && (
                <div className={cn('w-8 h-px', isCompleted ? 'bg-accent-green' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {renderStepIndicator()}
      {renderCurrentStep()}

      {/* Navigation buttons (hide on intake screen since it has its own Next, and on final screen) */}
      {step > 1 && step < 4 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <button
            onClick={goBack}
            className="btn-secondary flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <button
            onClick={goNext}
            disabled={!canGoNext() || generating}
            className="btn-primary flex items-center gap-2"
          >
            {step === 3 ? 'Start Making' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
