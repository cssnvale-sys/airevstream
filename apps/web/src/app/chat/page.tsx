'use client';

import { useEffect, useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { chat as chatApi } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Send, Plus, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  _count?: { messages: number };
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await chatApi.listConversations(token);
      setConversations(res.data?.items ?? []);
    } catch {
      // ignore
    }
  };

  const loadMessages = async (convId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await chatApi.getConversation(token, convId);
      setMessages(res.data?.messages ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleNewConversation = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await chatApi.createConversation(token);
      await loadConversations();
      setActiveId(res.data.id);
      setMessages([]);
    } catch {
      // ignore
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeId || sending) return;

    const token = getToken();
    if (!token) return;

    const userMsg = input.trim();
    setInput('');
    setSending(true);

    // Optimistic: add user message
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, role: 'user', content: userMsg, createdAt: new Date().toISOString() }]);

    try {
      const res = await chatApi.sendMessage(token, activeId, userMsg);
      // Replace with actual messages
      setMessages((prev) => [
        ...prev.filter((m) => !m.id.startsWith('temp-')),
        res.data.userMessage,
        res.data.assistantMessage,
      ]);
      loadConversations(); // refresh titles
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Sorry, I could not process that. Is Ollama running?', createdAt: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await chatApi.deleteConversation(token, id);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      loadConversations();
    } catch {
      // ignore
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-6">
        {/* Sidebar */}
        <div className="w-72 flex flex-col">
          <button onClick={handleNewConversation} className="btn-primary flex items-center gap-2 mb-4 w-full justify-center">
            <Plus size={16} /> New Chat
          </button>
          <div className="flex-1 overflow-auto space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeId === conv.id ? 'bg-brand-600/20 text-brand-400' : 'hover:bg-gray-800 text-gray-300'
                }`}
                onClick={() => setActiveId(conv.id)}
              >
                <span className="text-sm truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  className="text-gray-500 hover:text-red-400 ml-2"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col card">
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a conversation or start a new one
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto space-y-4 mb-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-800 text-gray-200'
                    }`}>
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    </div>
                  </div>
                ))}
                <div ref={messagesEnd} />
              </div>

              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the AI assistant..."
                  className="input flex-1"
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !input.trim()} className="btn-primary px-4">
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
