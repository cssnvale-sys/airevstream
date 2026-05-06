'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { EmptyState } from '@/components/ui/empty-state';
import {
  FileText,
  Video,
  Image as ImageIcon,
  Mic,
  Sparkles,
  Clock,
  Eye,
  Play,
  Filter,
  Search,
  Plus,
  TrendingUp,
  Zap,
  Palette
} from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'social' | 'youtube' | 'podcast' | 'marketing' | 'education';
  type: 'video' | 'audio' | 'image' | 'mixed';
  duration: string;
  aiFeatures: string[];
  isPro?: boolean;
}

const templates: Template[] = [
  {
    id: 'youtube-short-news',
    name: 'YouTube Short News',
    description: '60-second news recap with AI-generated script and captions',
    category: 'youtube',
    type: 'video',
    duration: '60s',
    aiFeatures: ['Script Generation', 'Auto-Captions', 'Music Sync'],
  },
  {
    id: 'instagram-reel-promo',
    name: 'Instagram Reel Promo',
    description: 'Vertical video template with trendy transitions and effects',
    category: 'social',
    type: 'video',
    duration: '30s',
    aiFeatures: ['Style Transfer', 'Auto-Captions', 'Trending Audio'],
    isPro: true,
  },
  {
    id: 'tiktok-story',
    name: 'TikTok Story Series',
    description: 'Multi-part story format with cliffhanger hooks',
    category: 'social',
    type: 'video',
    duration: '90s',
    aiFeatures: ['Script Generation', 'Voice Cloning', 'Auto-Captions'],
  },
  {
    id: 'podcast-intro',
    name: 'Podcast Intro Sequence',
    description: 'Professional podcast intro with music and voiceover',
    category: 'podcast',
    type: 'audio',
    duration: '15s',
    aiFeatures: ['Music Generation', 'Voice Synthesis'],
  },
  {
    id: 'linkedin-carousel',
    name: 'LinkedIn Carousel',
    description: 'Professional carousel post with data visualizations',
    category: 'social',
    type: 'image',
    duration: '5 slides',
    aiFeatures: ['Text Generation', 'Chart Creation'],
  },
  {
    id: 'product-demo',
    name: 'Product Demo Video',
    description: 'Showcase your product with AI-generated voiceover',
    category: 'marketing',
    type: 'video',
    duration: '2min',
    aiFeatures: ['Script Generation', 'Voice Synthesis', 'Screen Recording'],
    isPro: true,
  },
  {
    id: 'explainer-edu',
    name: 'Educational Explainer',
    description: 'Animated explainer video for complex topics',
    category: 'education',
    type: 'video',
    duration: '3min',
    aiFeatures: ['Script Generation', 'Avatar Presenter', 'Visual Assets'],
  },
  {
    id: 'ad-creative',
    name: 'Ad Creative Pack',
    description: 'Multiple ad variants for A/B testing campaigns',
    category: 'marketing',
    type: 'mixed',
    duration: '15-30s',
    aiFeatures: ['Variant Generation', 'Auto-Captions', 'CRO Optimization'],
    isPro: true,
  },
  {
    id: 'newsletter-summary',
    name: 'Video Newsletter',
    description: 'Turn written newsletter into engaging video summary',
    category: 'marketing',
    type: 'video',
    duration: '2min',
    aiFeatures: ['Text-to-Video', 'Voice Synthesis', 'Visual Selection'],
  },
  {
    id: 'tutorial-series',
    name: 'Tutorial Series',
    description: 'Step-by-step tutorial with AI-generated chapters',
    category: 'education',
    type: 'video',
    duration: '5-10min',
    aiFeatures: ['Script Generation', 'Chapter Detection', 'Captions'],
  },
];

const categories = [
  { value: 'all', label: 'All Templates', icon: Filter },
  { value: 'social', label: 'Social Media', icon: Sparkles },
  { value: 'youtube', label: 'YouTube', icon: Play },
  { value: 'podcast', label: 'Podcast', icon: Mic },
  { value: 'marketing', label: 'Marketing', icon: Zap },
  { value: 'education', label: 'Education', icon: Palette },
];

const types = [
  { value: 'all', label: 'All Types' },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Mic },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'mixed', label: 'Mixed Media', icon: FileText },
];

function TemplateCard({ template }: { template: Template }) {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      social: 'badge-pink',
      youtube: 'badge-red',
      podcast: 'badge-purple',
      marketing: 'badge-orange',
      education: 'badge-blue',
    };
    return colors[category] || 'badge';
  };

  return (
    <div className="card group hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-video bg-gradient-to-br from-bg-tertiary to-bg-secondary overflow-hidden rounded-lg mb-4">
        <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
          <div className="text-center">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <span className="text-xs opacity-50">{template.type.toUpperCase()}</span>
          </div>
        </div>
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button className="btn-secondary btn-sm">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </button>
          <Link href={`/create?template=${template.id}`}>
            <button className="btn-primary btn-sm">
              <Plus className="w-4 h-4 mr-2" />
              Use
            </button>
          </Link>
        </div>
        
        {/* Pro badge */}
        {template.isPro && (
          <span className="absolute top-2 right-2 badge bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            PRO
          </span>
        )}
        
        {/* Duration badge */}
        <span className="absolute bottom-2 left-2 badge bg-black/70 text-white border-0 text-xs">
          <Clock className="w-3 h-3 mr-1" />
          {template.duration}
        </span>
      </div>
      
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-text-primary group-hover:text-accent-purple transition-colors">
          {template.name}
        </h3>
        <span className={`badge text-xs ${getCategoryColor(template.category)}`}>
          {template.category}
        </span>
      </div>
      
      <p className="text-sm text-text-secondary line-clamp-2 mb-3">
        {template.description}
      </p>
      
      {/* AI Features */}
      <div className="flex flex-wrap gap-1 mb-3">
        {template.aiFeatures.slice(0, 3).map((feature) => (
          <span key={feature} className="badge badge-sm">
            {feature}
          </span>
        ))}
        {template.aiFeatures.length > 3 && (
          <span className="badge badge-sm">
            +{template.aiFeatures.length - 3}
          </span>
        )}
      </div>
      
      {/* Features */}
      <div className="flex flex-wrap gap-1 mb-3">
        {template.aiFeatures.slice(0, 3).map((feature) => (
          <span key={feature} className="badge badge-sm">
            {feature}
          </span>
        ))}
        {template.aiFeatures.length > 3 && (
          <span className="badge badge-sm">
            +{template.aiFeatures.length - 3}
          </span>
        )}
      </div>
      
      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-text-secondary pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {template.duration}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.aiFeatures.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesType = selectedType === 'all' || template.type === selectedType;
    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Template Gallery</h1>
          <p className="text-text-secondary text-lg">
            Jumpstart your content creation with AI-powered templates
          </p>
        </div>

        {/* Featured Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-accent-purple via-purple-600 to-pink-500 p-8 text-white">
          <div className="relative z-10">
            <span className="badge bg-white/20 text-white border-white/30 mb-4 inline-flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Most Popular
            </span>
            <h2 className="text-2xl font-bold mb-2">Tutorial Series</h2>
            <p className="text-white/80 max-w-xl mb-4">
              Create engaging educational content with AI-generated scripts, automatic chapter detection, 
              and perfectly synced captions.
            </p>
            <div className="flex gap-3">
              <Link href="/create?template=tutorial-series">
                <button className="btn-secondary">
                  <Play className="w-4 h-4 mr-2" />
                  Use Template
                </button>
              </Link>
              <button className="btn-ghost border-white/30 text-white hover:bg-white/10">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </button>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/10 to-transparent" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search templates by name, description, or AI features..."
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
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="input w-[160px]"
          >
            {types.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Showing {filteredTemplates.length} of {templates.length} templates
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Sort by:</span>
              <select className="input input-sm w-[140px]">
                <option>Most Popular</option>
                <option>Newest</option>
                <option>Highest Rated</option>
                <option>Name</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <EmptyState
              icon={Search}
              title="No templates found"
              description="Try adjusting your search or filters."
              compact
            />
          )}
        </div>

        {/* Create Custom CTA */}
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <Palette className="w-12 h-12 mx-auto mb-4 text-text-tertiary" />
          <h3 className="text-lg font-medium mb-2">Create Custom Template</h3>
          <p className="text-text-secondary max-w-md mx-auto mb-4">
            Have a specific format you use repeatedly? Save your workflow as a custom template 
            for faster content creation.
          </p>
          <Link href="/create?saveAsTemplate=true">
            <button className="btn-secondary">
              <Plus className="w-4 h-4 mr-2" />
              Create from Current Workflow
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
