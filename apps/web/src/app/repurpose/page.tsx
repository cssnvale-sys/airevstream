'use client';

import { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Scissors,
  Upload,
  Film,
  Clock,
  Sparkles,
  Play,
  Download,
  Wand2,
  Eye,
  Share2,
  Copy,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface SourceVideo {
  id: string;
  title: string;
  duration: string;
  source: 'upload' | 'library' | 'youtube' | 'url';
}

interface ClipSuggestion {
  id: string;
  startTime: number;
  endTime: number;
  duration: string;
  hook: string;
  viralityScore: number;
  engagementType: 'trending' | 'viral' | 'educational' | 'emotional';
  captions: string[];
}

interface RepurposedClip {
  id: string;
  sourceId: string;
  startTime: number;
  endTime: number;
  duration: string;
  status: 'processing' | 'completed' | 'failed';
  platforms: string[];
  createdAt: Date;
}

const mockSuggestions: ClipSuggestion[] = [
  {
    id: 'clip-1',
    startTime: 45,
    endTime: 75,
    duration: '0:30',
    hook: 'The one mistake that cost me $50,000...',
    viralityScore: 92,
    engagementType: 'viral',
    captions: ['Eye-catching hook', 'Clear CTA', 'Trending format'],
  },
  {
    id: 'clip-2',
    startTime: 180,
    endTime: 220,
    duration: '0:40',
    hook: '3 secrets the pros don\'t want you to know',
    viralityScore: 88,
    engagementType: 'trending',
    captions: ['List format', 'High retention', 'Shareable'],
  },
  {
    id: 'clip-3',
    startTime: 320,
    endTime: 365,
    duration: '0:45',
    hook: 'Stop doing this if you want to grow faster',
    viralityScore: 85,
    engagementType: 'educational',
    captions: ['Contrarian take', 'Actionable advice', 'Hook in first 3s'],
  },
  {
    id: 'clip-4',
    startTime: 520,
    endTime: 565,
    duration: '0:45',
    hook: 'This changed everything for my business',
    viralityScore: 90,
    engagementType: 'emotional',
    captions: ['Story arc', 'Emotional peak', 'Relatable moment'],
  },
];

const mockClips: RepurposedClip[] = [
  {
    id: 'rep-1',
    sourceId: 'source-1',
    startTime: 45,
    endTime: 75,
    duration: '0:30',
    status: 'completed',
    platforms: ['TikTok', 'Instagram', 'YouTube Shorts'],
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: 'rep-2',
    sourceId: 'source-1',
    startTime: 180,
    endTime: 220,
    duration: '0:40',
    status: 'processing',
    platforms: ['TikTok'],
    createdAt: new Date(Date.now() - 3600000),
  },
];

function SuggestionCard({ 
  suggestion, 
  onSelect 
}: { 
  suggestion: ClipSuggestion; 
  onSelect: (suggestion: ClipSuggestion) => void;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 80) return 'text-amber-500';
    return 'text-blue-500';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      viral: 'badge-red',
      trending: 'badge-purple',
      educational: 'badge-blue',
      emotional: 'badge-pink',
    };
    return colors[type] || 'badge';
  };

  return (
    <div className="card hover:border-accent-purple/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge ${getTypeColor(suggestion.engagementType)}`}>
              {suggestion.engagementType}
            </span>
            <span className="text-xs text-text-secondary">
              {Math.floor(suggestion.startTime / 60)}:{String(suggestion.startTime % 60).padStart(2, '0')} - {Math.floor(suggestion.endTime / 60)}:{String(suggestion.endTime % 60).padStart(2, '0')}
            </span>
          </div>
          
          <p className="font-medium mb-2 line-clamp-2">&ldquo;{suggestion.hook}&rdquo;</p>
          
          <div className="flex flex-wrap gap-1">
            {suggestion.captions.map((caption) => (
              <span key={caption} className="badge badge-sm">
                {caption}
              </span>
            ))}
          </div>
        </div>
        
        <div className="text-center">
          <div className={`text-2xl font-bold ${getScoreColor(suggestion.viralityScore)}`}>
            {suggestion.viralityScore}
          </div>
          <div className="text-xs text-text-secondary">score</div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <span className="text-sm text-text-secondary flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {suggestion.duration}
        </span>
        <button className="btn-primary btn-sm" onClick={() => onSelect(suggestion)}>
          <Scissors className="w-4 h-4 mr-2" />
          Create Clip
        </button>
      </div>
    </div>
  );
}

function VideoUploader({ onUpload }: { onUpload: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
        ${isDragging 
          ? 'border-accent-purple bg-accent-purple/5' 
          : 'border-border hover:border-accent-purple/50 hover:bg-bg-tertiary/50'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-purple/10 flex items-center justify-center">
        <Upload className="w-8 h-8 text-accent-purple" />
      </div>
      <h3 className="text-lg font-medium mb-2">Upload Video</h3>
      <p className="text-text-secondary mb-4">
        Drag and drop or click to select a video file
      </p>
      <p className="text-xs text-text-secondary">
        Supports MP4, MOV, AVI up to 2GB
      </p>
    </div>
  );
}

export default function RepurposePage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'suggestions' | 'clips'>('upload');
  const [uploadedVideo, setUploadedVideo] = useState<SourceVideo | null>(null);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleUpload = (file: File) => {
    const video: SourceVideo = {
      id: 'source-1',
      title: file.name,
      duration: '15:30',
      source: 'upload',
    };
    setUploadedVideo(video);
    setIsAnalyzing(true);
    
    setTimeout(() => {
      setIsAnalyzing(false);
      setActiveTab('suggestions');
    }, 3000);
  };

  const handleSelectSuggestion = (suggestion: ClipSuggestion) => {
    setSelectedClips([...selectedClips, suggestion.id]);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Video Repurposing</h1>
            <p className="text-text-secondary text-lg">
              Transform long-form content into viral short clips
            </p>
          </div>
          <Link href="/library">
            <button className="btn-secondary">
              <Film className="w-4 h-4 mr-2" />
              Browse Library
            </button>
          </Link>
        </div>

        {/* Stats — dynamic from real data only */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: 'Clips Generated', value: selectedClips.length.toString(), icon: Scissors },
            { label: 'Total Views', value: '—', icon: Eye },
            { label: 'Avg. Virality Score', value: '—', icon: Zap },
            { label: 'Time Saved', value: '—', icon: Clock },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-accent-purple" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-text-secondary">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'upload' 
                  ? 'border-accent-purple text-accent-purple' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              disabled={!uploadedVideo}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'suggestions' 
                  ? 'border-accent-purple text-accent-purple' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              } ${!uploadedVideo ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Wand2 className="w-4 h-4" />
              AI Suggestions
            </button>
            <button
              onClick={() => setActiveTab('clips')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'clips' 
                  ? 'border-accent-purple text-accent-purple' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Film className="w-4 h-4" />
              My Clips
            </button>
          </div>
        </div>

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <VideoUploader onUpload={handleUpload} />
            
            <div className="space-y-4">
              <p className="text-sm font-medium text-center text-text-secondary">or import from</p>
              <div className="flex justify-center gap-4">
                <button className="btn-secondary">
                  <Film className="w-4 h-4 mr-2" />
                  Your Library
                </button>
                <button className="btn-secondary">
                  <Share2 className="w-4 h-4 mr-2" />
                  YouTube URL
                </button>
                <button className="btn-secondary">
                  <Copy className="w-4 h-4 mr-2" />
                  Paste URL
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-6">
            {uploadedVideo && (
              <div className="card p-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 bg-bg-tertiary rounded flex items-center justify-center">
                    <Film className="w-8 h-8 text-text-tertiary opacity-30" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{uploadedVideo.title}</h3>
                    <p className="text-sm text-text-secondary">
                      {uploadedVideo.duration} • {mockSuggestions.length} clip suggestions
                    </p>
                  </div>
                  <button className="btn-secondary btn-sm">
                    Change Video
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-purple" />
                  AI-Detected Viral Moments
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Target duration:</span>
                  <select className="input input-sm">
                    <option>15-30s</option>
                    <option>30-60s</option>
                    <option>60-90s</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                AI analyzed your video and found these high-engagement segments
              </p>
            </div>

            <div className="space-y-4">
              {mockSuggestions.map((suggestion) => (
                <SuggestionCard 
                  key={suggestion.id} 
                  suggestion={suggestion}
                  onSelect={handleSelectSuggestion}
                />
              ))}
            </div>

            {selectedClips.length > 0 && (
              <div className="fixed bottom-6 right-6">
                <button className="btn-primary btn-lg shadow-lg">
                  <Scissors className="w-5 h-5 mr-2" />
                  Create {selectedClips.length} Clip{selectedClips.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clips' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockClips.map((clip) => (
              <div key={clip.id} className="card overflow-hidden">
                <div className="relative aspect-[9/16] bg-bg-tertiary rounded-lg mb-4">
                  <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
                    <Film className="w-12 h-12 opacity-20" />
                  </div>
                  {clip.status === 'processing' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <div className="flex items-center gap-2 text-white">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </div>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 badge">
                    {clip.duration}
                  </span>
                  <button className="absolute bottom-2 left-2 btn-icon btn-sm">
                    <Play className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {clip.platforms.map((platform) => (
                    <span key={platform} className="badge badge-sm">
                      {platform}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{clip.createdAt.toLocaleDateString()}</span>
                  <span>{Math.floor(clip.startTime / 60)}:{String(clip.startTime % 60).padStart(2, '0')} - {Math.floor(clip.endTime / 60)}:{String(clip.endTime % 60).padStart(2, '0')}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="btn-secondary btn-sm flex-1">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </button>
                  {clip.status === 'completed' && (
                    <button className="btn-secondary btn-sm flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Processing State Modal */}
        {isAnalyzing && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="card p-8 max-w-md w-full mx-4">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-accent-purple/10 flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-accent-purple animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold">AI Analyzing Video</h3>
                <p className="text-text-secondary">
                  Our AI is scanning your video for viral moments, hooks, and high-engagement segments...
                </p>
                <div className="space-y-2">
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-accent-purple rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-text-secondary">Identifying 4 viral clip opportunities...</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
