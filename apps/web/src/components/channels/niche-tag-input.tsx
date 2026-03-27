'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface NicheTagInputProps {
  value: string[];
  onChange: (niches: string[]) => void;
  maxTags?: number;
}

export function NicheTagInput({ value, onChange, maxTags = 10 }: NicheTagInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = input.trim().toLowerCase();
      if (tag && !value.includes(tag) && value.length < maxTags) {
        onChange([...value, tag]);
        setInput('');
      }
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 input min-h-[40px] items-center">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded text-caption"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:text-accent-red transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? 'Type a niche and press Enter...' : ''}
        aria-label="Add niche tag"
        className="flex-1 min-w-[120px] bg-transparent outline-none text-text-primary placeholder:text-text-tertiary text-body"
        disabled={value.length >= maxTags}
      />
    </div>
  );
}
