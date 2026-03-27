'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToken } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import { toast } from '@/lib/toast';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const message = input;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, message, contextPage: pathname }),
      });
      const data = await res.json();
      if (data.success) {
        setConversationId(data.data.conversationId);
        const aiMsg: Message = {
          id: data.data.assistantMessage?.id ?? crypto.randomUUID(),
          role: 'assistant',
          content: data.data.assistantMessage?.content ?? 'No response received.',
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        toast.error('AI request failed');
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }]);
      }
    } catch (err) {
      console.error('AI chat failed:', err);
      toast.error('AI request failed');
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="w-ai-panel bg-bg-secondary border-l border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent-purple" />
          <span className="text-card-title text-text-primary">AI Assistant</span>
        </div>
        <button onClick={onClose} className="btn-icon" aria-label="Close AI assistant">
          <X size={16} />
        </button>
      </div>

      <div className="text-caption text-text-secondary px-4 py-2 border-b border-border bg-bg-tertiary">
        Context: {pathname}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-text-secondary text-body mt-12">
            <Sparkles size={32} className="mx-auto mb-3 text-accent-purple opacity-50" />
            <p>Ask me anything about your content, accounts, or system.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg px-3 py-2 text-body max-w-[90%]',
              msg.role === 'user'
                ? 'bg-accent-blue/15 text-text-primary ml-auto'
                : 'bg-bg-tertiary text-text-primary',
            )}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="bg-bg-tertiary rounded-lg px-3 py-2 text-body text-text-secondary max-w-[90%]">
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask anything..."
            className="input flex-1"
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn-primary btn-sm">
            <Send size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
