'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  UserCircle,
  Video,
  Play,
  Plus,
  Search,
  Sparkles,
  Wand2,
  Eye,
  Download,
  Mic,
  Languages,
  Palette,
  Shirt,
} from 'lucide-react';
import Link from 'next/link';

interface Avatar {
  id: string;
  name: string;
  description: string;
  type: 'ai' | 'photo';
  category: 'professional' | 'casual' | 'character' | 'custom';
  voiceId?: string;
  languages: string[];
  outfits: string[];
  emotions: string[];
  isPro?: boolean;
}

interface GeneratedVideo {
  id: string;
  avatarId: string;
  script: string;
  status: 'generating' | 'completed' | 'failed';
  duration: string;
  createdAt: Date;
}

const presetAvatars: Avatar[] = [
  {
    id: 'anna-professional',
    name: 'Anna',
    description: 'Professional female presenter, perfect for business content',
    type: 'ai',
    category: 'professional',
    voiceId: 'anna-voice',
    languages: ['en', 'es', 'fr', 'de'],
    outfits: ['business', 'casual', 'formal'],
    emotions: ['neutral', 'happy', 'excited', 'serious'],
  },
  {
    id: 'marcus-business',
    name: 'Marcus',
    description: 'Confident male presenter for corporate videos',
    type: 'ai',
    category: 'professional',
    voiceId: 'marcus-voice',
    languages: ['en', 'es', 'fr', 'de', 'it'],
    outfits: ['suit', 'smart-casual', 'casual'],
    emotions: ['neutral', 'friendly', 'authoritative', 'enthusiastic'],
    isPro: true,
  },
  {
    id: 'sophie-casual',
    name: 'Sophie',
    description: 'Friendly and approachable for lifestyle content',
    type: 'ai',
    category: 'casual',
    voiceId: 'sophie-voice',
    languages: ['en', 'es'],
    outfits: ['casual', 'sporty', 'cozy'],
    emotions: ['cheerful', 'relaxed', 'excited', 'thoughtful'],
  },
  {
    id: 'james-casual',
    name: 'James',
    description: 'Relatable guy-next-door for tutorials and reviews',
    type: 'ai',
    category: 'casual',
    voiceId: 'james-voice',
    languages: ['en', 'en-uk', 'en-au'],
    outfits: ['casual', 'outdoor', 'athletic'],
    emotions: ['friendly', 'excited', 'curious', 'focused'],
  },
  {
    id: 'chef-antonio',
    name: 'Chef Antonio',
    description: 'Animated chef character for cooking content',
    type: 'ai',
    category: 'character',
    voiceId: 'antonio-voice',
    languages: ['en', 'it', 'es', 'fr'],
    outfits: ['chef-white', 'chef-black', 'apron'],
    emotions: ['enthusiastic', 'surprised', 'approving', 'concentrated'],
    isPro: true,
  },
  {
    id: 'professor-einstein',
    name: 'Professor Einstein',
    description: 'Knowledgeable professor for educational content',
    type: 'ai',
    category: 'character',
    voiceId: 'professor-voice',
    languages: ['en', 'de', 'fr'],
    outfits: ['academic', 'casual', 'lab-coat'],
    emotions: ['thoughtful', 'curious', 'excited', 'serious'],
  },
  {
    id: 'narrator-neutral',
    name: 'Narrator',
    description: 'Neutral AI presenter for news and documentaries',
    type: 'ai',
    category: 'professional',
    voiceId: 'narrator-voice',
    languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'],
    outfits: ['neutral', 'minimal'],
    emotions: ['neutral', 'serious', 'interested'],
    isPro: true,
  },
  {
    id: 'host-sarah',
    name: 'Sarah',
    description: 'Energetic host for entertainment and variety shows',
    type: 'ai',
    category: 'casual',
    voiceId: 'sarah-voice',
    languages: ['en', 'es'],
    outfits: ['trendy', 'professional', 'party'],
    emotions: ['energetic', 'excited', 'happy', 'surprised', 'dramatic'],
  },
];

const mockVideos: GeneratedVideo[] = [
  {
    id: 'vid-1',
    avatarId: 'anna-professional',
    script: 'Welcome to our quarterly business review...',
    status: 'completed',
    duration: '2:34',
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: 'vid-2',
    avatarId: 'chef-antonio',
    script: 'Today we\'re making the perfect pasta...',
    status: 'generating',
    duration: '5:12',
    createdAt: new Date(Date.now() - 3600000),
  },
];

function AvatarCard({ avatar, onSelect }: { avatar: Avatar; onSelect: (avatar: Avatar) => void }) {
  return (
    <div 
      className="card group hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => onSelect(avatar)}
    >
      <div className="relative aspect-[3/4] bg-gradient-to-br from-bg-tertiary to-bg-secondary overflow-hidden rounded-lg mb-4">
        <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
          <UserCircle className="w-20 h-20 opacity-20" />
        </div>
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button className="btn-secondary btn-sm">
            <Play className="w-4 h-4 mr-2" />
            Preview
          </button>
        </div>
        
        {/* Pro badge */}
        {avatar.isPro && (
          <span className="absolute top-2 right-2 badge bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            PRO
          </span>
        )}
        
        {/* Category badge */}
        <span className="absolute bottom-2 left-2 badge bg-black/70 text-white border-0 text-xs capitalize">
          {avatar.category}
        </span>
      </div>
      
      <h3 className="font-semibold text-text-primary group-hover:text-accent-purple transition-colors">
        {avatar.name}
      </h3>
      <p className="text-sm text-text-secondary line-clamp-2 mt-1">
        {avatar.description}
      </p>
      
      {/* Languages */}
      <div className="flex flex-wrap gap-1 mt-3">
        {avatar.languages.slice(0, 4).map((lang) => (
          <span key={lang} className="badge badge-sm">
            {lang.toUpperCase()}
          </span>
        ))}
        {avatar.languages.length > 4 && (
          <span className="badge badge-sm">
            +{avatar.languages.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AvatarsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'avatars' | 'videos'>('avatars');
  const [script, setScript] = useState('');

  const filteredAvatars = presetAvatars.filter((avatar) => {
    const matchesSearch = 
      avatar.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      avatar.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || avatar.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectAvatar = (avatar: Avatar) => {
    setSelectedAvatar(avatar);
    setIsCreateModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">AI Avatars</h1>
            <p className="text-text-secondary text-lg">
              Create videos with AI-powered virtual presenters
            </p>
          </div>
          <Link href="/create?mode=avatar">
            <button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              New Avatar Video
            </button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('avatars')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'avatars' 
                  ? 'border-accent-purple text-accent-purple' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <UserCircle className="w-4 h-4" />
              Avatar Library
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'videos' 
                  ? 'border-accent-purple text-accent-purple' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Video className="w-4 h-4" />
              My Videos
            </button>
          </div>
        </div>

        {activeTab === 'avatars' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search avatars..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input w-full pl-10"
                />
              </div>
              
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input w-[180px]"
              >
                <option value="all">All Categories</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="character">Character</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAvatars.map((avatar) => (
                <AvatarCard 
                  key={avatar.id} 
                  avatar={avatar} 
                  onSelect={handleSelectAvatar}
                />
              ))}
            </div>

            {/* Create Custom Avatar */}
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <Wand2 className="w-12 h-12 mx-auto mb-4 text-text-tertiary" />
              <h3 className="text-lg font-medium mb-2">Create Custom Avatar</h3>
              <p className="text-text-secondary max-w-md mx-auto mb-4">
                Upload your own photo or video to create a custom AI avatar that looks and sounds like you.
              </p>
              <Link href="/avatars/custom">
                <button className="btn-secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Custom Avatar
                </button>
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div>
            {mockVideos.length === 0 ? (
              <div className="card p-12 text-center">
                <Video className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No videos yet</h3>
                <p className="text-text-secondary max-w-md mx-auto mb-4">
                  Create your first AI avatar video. Select an avatar and provide a script to generate a talking-head video.
                </p>
                <button className="btn-secondary" onClick={() => setActiveTab('avatars')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Video
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockVideos.map((video) => (
                  <div key={video.id} className="card overflow-hidden">
                    <div className="relative aspect-[9/16] bg-bg-tertiary rounded-lg mb-4">
                      <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
                        <Video className="w-12 h-12 opacity-20" />
                      </div>
                      {video.status === 'generating' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <div className="flex items-center gap-2 text-white">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Generating...
                          </div>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 badge">
                        {video.duration}
                      </span>
                      <button className="absolute bottom-2 left-2 btn-icon btn-sm">
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                      {video.script}
                    </p>
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{video.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="btn-secondary btn-sm flex-1">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </button>
                      {video.status === 'completed' && (
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
          </div>
        )}

        {/* Create Video Modal */}
        {isCreateModalOpen && selectedAvatar && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-purple to-purple-600 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Create Video with {selectedAvatar.name}</h2>
                      <p className="text-sm text-text-secondary">
                        Generate an AI presenter video
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="btn-icon"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Script */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Script
                  </label>
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Enter the script your AI avatar will speak..."
                    className="input w-full min-h-[120px] resize-y"
                  />
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{script.length} characters</span>
                    <span>~{Math.ceil(script.length / 15)} seconds estimated</span>
                  </div>
                </div>
                
                {/* Settings */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Languages className="w-4 h-4" />
                      Language
                    </label>
                    <select className="input w-full">
                      {selectedAvatar.languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Shirt className="w-4 h-4" />
                      Outfit
                    </label>
                    <select className="input w-full">
                      {selectedAvatar.outfits.map((outfit) => (
                        <option key={outfit} value={outfit}>
                          {outfit.charAt(0).toUpperCase() + outfit.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Emotion
                    </label>
                    <select className="input w-full">
                      {selectedAvatar.emotions.map((emotion) => (
                        <option key={emotion} value={emotion}>
                          {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Voice Preview */}
                <div className="p-4 bg-bg-tertiary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-accent-purple" />
                      <div>
                        <p className="font-medium">Voice Preview</p>
                        <p className="text-sm text-text-secondary">{selectedAvatar.name}&apos;s voice</p>
                      </div>
                    </div>
                    <button className="btn-secondary btn-sm">
                      <Play className="w-4 h-4 mr-2" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn-primary">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Video
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
