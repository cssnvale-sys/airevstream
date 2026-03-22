'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';

interface ProvenanceViewerProps {
  contentId: string;
}

interface ProvenanceData {
  contentId: string;
  title: string;
  records: Array<{
    id: string;
    timestamp: string;
    type: string;
    model: { name: string; provider: string };
    parameters: {
      prompt?: string;
      seed?: number;
      steps?: number;
      cfg?: number;
    };
    stage: string;
    qualityScore?: number;
  }>;
  manifest: {
    version: string;
    claimGenerator: string;
    digitalSourceType: string;
    actions: Array<{ action: string; softwareAgent: string; when: string }>;
    assertions: Array<{ label: string; data: Record<string, unknown> }>;
  };
  safetyScores: Array<{ shotNumber: number; safetyScore: number }>;
}

export function ProvenanceViewer({ contentId }: ProvenanceViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useApi<ProvenanceData>(`/content/provenance?contentId=${contentId}`);

  const prov = data?.data;
  if (!prov) return null;

  const { records, manifest, safetyScores } = prov;
  const hasUnsafe = safetyScores.some(s => s.safetyScore > 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-bg-tertiary hover:bg-border text-sm font-medium text-text-primary"
      >
        <span>Provenance</span>
        <span className="text-xs text-text-tertiary">{records.length} records</span>
      </button>

      {expanded && (
        <div className="p-3 space-y-3 text-xs">
          {/* C2PA Badge */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-bg-tertiary rounded border border-border">
            <span className="text-accent-blue font-medium">C2PA</span>
            <span className="text-text-secondary">AI-Generated Content</span>
            <span className="ml-auto text-text-tertiary">{manifest.version}</span>
          </div>

          {/* Safety Status */}
          {hasUnsafe && (
            <div className="px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 rounded text-accent-orange">
              Some shots have safety warnings
            </div>
          )}

          {/* Model Info */}
          <div>
            <div className="text-text-secondary font-medium mb-1">Models Used</div>
            {[...new Set(records.map(r => `${r.model.provider}/${r.model.name}`))].map(model => (
              <div key={model} className="text-text-primary">{model}</div>
            ))}
          </div>

          {/* Generation Records */}
          <div>
            <div className="text-text-secondary font-medium mb-1">Generation Log</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {records.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 text-text-secondary">
                  <span className="text-text-tertiary w-4">{i + 1}</span>
                  <span className="text-text-primary">{r.stage}</span>
                  {r.parameters.seed && (
                    <span className="text-text-tertiary">seed:{r.parameters.seed}</span>
                  )}
                  {r.qualityScore != null && (
                    <span className={r.qualityScore >= 85 ? 'text-accent-green' : r.qualityScore >= 60 ? 'text-accent-orange' : 'text-accent-red'}>
                      QC:{r.qualityScore}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Manifest Actions */}
          <div>
            <div className="text-text-secondary font-medium mb-1">Content Credentials</div>
            <div className="text-text-tertiary">
              <div>Generator: {manifest.claimGenerator}</div>
              <div>Source: {manifest.digitalSourceType}</div>
              <div>Actions: {manifest.actions.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
