import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuthStore } from '../store/authStore';
import { MessageSquarePlus, RotateCcw, Clock, ChevronLeft } from 'lucide-react';

// ——————————————————————————————————————————
// Types
// ——————————————————————————————————————————

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

// ——————————————————————————————————————————
// Quick prompts
// ——————————————————————————————————————————

const quickPrompts = [
  { label: '💪 Byta övning', prompt: 'Jag vill ha hjälp att byta ut en övning.' },
  { label: '📅 Utgångsdatum', prompt: 'Jag vill veta mitt utgångsdatum.' },
  { label: '⏸️ Pausa medlemskap', prompt: 'Jag vill pausa mitt medlemskap.' },
  { label: '🔄 Förläng medlemskap', prompt: 'Jag vill förlänga mitt medlemskap.' },
  { label: '🧾 Kvitto / Friskvård', prompt: 'Jag behöver ett kvitto för friskvårdsbidrag.' },
  { label: '📦 Beställa produkter', prompt: 'Jag vill beställa kosttillskott.' },
];

// ——————————————————————————————————————————
// Helpers
// ——————————————————————————————————————————

let idCounter = 0;
const nextId = () => `msg-${Date.now()}-${++idCounter}`;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} tim sedan`;
  const days = Math.floor(hrs / 24);
  return `${days} dag${days > 1 ? 'ar' : ''} sedan`;
}

// ——————————————————————————————————————————
// SSE chat sender
// ——————————————————————————————————————————

async function sendChatSSE(
  messages: ChatMsg[],
  accessToken: string,
  conversationId: string | null,
  onChunk: (text: string) => void,
  onDone: (conversationId: string | null) => void,
  onError: (message: string) => void,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        conversation_id: conversationId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as any)?.error || `Servern svarade ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Kunde inte läsa svarsflödet');

    const decoder = new TextDecoder();
    let buffer = '';
    let resultConvId: string | null = conversationId;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const rawData = line.slice(6);
          try {
            const data = JSON.parse(rawData);
            if (currentEvent === 'chunk' && data?.text) {
              onChunk(data.text);
            } else if (currentEvent === 'meta' && data?.conversation_id) {
              resultConvId = data.conversation_id;
            } else if (currentEvent === 'error') {
              throw new Error(data?.message || 'Agent error');
            }
          } catch (parseErr: any) {
            if (parseErr?.message && parseErr.message !== 'Agent error' && !parseErr.message.startsWith('Unexpected')) {
              throw parseErr;
            }
          }
        }
      }
    }

    onDone(resultConvId);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      onError('Timeout – servern svarade inte i tid. Försök igen.');
    } else {
      onError(err?.message || 'Okänt fel');
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ——————————————————————————————————————————
// Component
// ——————————————————————————————————————————

const SupportChat: React.FC = () => {
  const { session } = useAuthStore();
  const accessToken = session?.access_token ?? null;

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Conversation history state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Retry state
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const hasMessages = messages.length > 0;

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/chat-conversations', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data?.conversations || []);
      }
    } catch {
      // Silent fail – conversation list is not critical
    } finally {
      setLoadingHistory(false);
    }
  }, [accessToken]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load a specific conversation's messages
  const loadConversation = async (convId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/chat-conversations?id=${convId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMsg[] = (data?.messages || []).map((m: any) => ({
          id: m.id || nextId(),
          role: m.role,
          content: m.content,
        }));
        setMessages(msgs);
        setConversationId(convId);
        setError(null);
        setShowHistory(false);
      }
    } catch {
      setError('Kunde inte ladda konversationen.');
    }
  };

  // Start new conversation
  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setLastFailedInput(null);
    setShowHistory(false);
  };

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !accessToken) return;

    setError(null);
    setLastFailedInput(null);

    const userMsg: ChatMsg = { id: nextId(), role: 'user', content: text.trim() };
    const assistantMsg: ChatMsg = { id: nextId(), role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    const allMessagesForApi = [...messages, userMsg];

    await sendChatSSE(
      allMessagesForApi,
      accessToken,
      conversationId,
      // onChunk
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      // onDone
      (newConvId) => {
        setIsStreaming(false);
        if (newConvId) setConversationId(newConvId);
        loadConversations(); // Refresh sidebar
      },
      // onError
      (errMsg) => {
        setIsStreaming(false);
        setError(errMsg);
        setLastFailedInput(text.trim());
        // Remove the empty assistant message
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant' && !last.content.trim()) {
            updated.pop();
          }
          return updated;
        });
      },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleRetry = () => {
    if (lastFailedInput) sendMessage(lastFailedInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ——————————————————————————————————————————
  // Render message bubble
  // ——————————————————————————————————————————

  const renderMessage = (msg: ChatMsg) => {
    if (!msg.content && msg.role === 'assistant') return null;
    const isUser = msg.role === 'user';

    return (
      <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${isUser
              ? 'bg-[#a0c81d] text-[#0b1222]'
              : 'bg-white/90 text-[#3D3D3D] border border-[#E6E1D8]'
            }`}
        >
          <div className="prose prose-sm max-w-none text-inherit [&_a]:text-[#4a7c10] [&_a]:underline">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  };

  // ——————————————————————————————————————————
  // Render
  // ——————————————————————————————————————————

  return (
    <div className="relative bg-[#F6F1E7] text-[#3D3D3D]">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#a0c81d]/10 blur-[140px]" />
        <div className="absolute right-[-120px] top-1/3 h-[420px] w-[420px] rounded-full bg-[#ffffff]/70 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.25] [background-image:radial-gradient(rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <div className="relative flex w-full gap-4 px-4 py-4 sm:px-8">
        {/* ——— Conversation history sidebar (desktop) ——— */}
        <aside className="hidden lg:flex w-72 flex-col rounded-[28px] border border-[#E6E1D8] bg-[#F6F1E7]/90 backdrop-blur overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E6E1D8] px-5 py-4">
            <p className="text-xs font-semibold text-[#3D3D3D]">Konversationer</p>
            <button
              type="button"
              onClick={startNewChat}
              className="rounded-xl bg-[#a0c81d]/15 p-2 text-[#64721c] transition hover:bg-[#a0c81d]/25"
              title="Ny chatt"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {loadingHistory && (
              <p className="text-[11px] text-[#9A9086] px-2 py-4 text-center">Laddar…</p>
            )}
            {!loadingHistory && conversations.length === 0 && (
              <p className="text-[11px] text-[#9A9086] px-2 py-4 text-center">Inga tidigare chattar</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 text-xs transition ${conversationId === conv.id
                    ? 'bg-[#a0c81d]/15 text-[#3D3D3D] font-semibold'
                    : 'text-[#6B6158] hover:bg-white/60'
                  }`}
              >
                <p className="truncate font-medium">{conv.title}</p>
                <p className="text-[10px] text-[#9A9086] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeAgo(conv.updated_at)}
                </p>
              </button>
            ))}
          </div>
        </aside>

        {/* ——— Main chat area ——— */}
        <section className="flex-1 min-w-0">
          <div className="rounded-[28px] border border-[#E6E1D8] bg-[#F6F1E7]/90 backdrop-blur flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6E1D8] px-6 py-4">
              <div className="flex items-center gap-3">
                {/* Mobile back button to history */}
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="lg:hidden rounded-xl bg-white/60 p-2 text-[#6B6158] transition hover:bg-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <p className="text-sm font-semibold text-[#3D3D3D]">PTO Coach</p>
                  <p className="text-xs text-[#6B6158]">Vi hjälper dig med medlemsskapet, planer och support.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="rounded-xl bg-[#a0c81d]/10 p-2 text-[#64721c] transition hover:bg-[#a0c81d]/20"
                  title="Ny chatt"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                </button>
                <span className="rounded-full bg-[#a0c81d]/15 px-3 py-1 text-[11px] font-semibold text-[#64721c]">
                  {isStreaming ? 'Svarar…' : 'Online'}
                </span>
              </div>
            </div>

            {/* Mobile history overlay */}
            {showHistory && (
              <div className="lg:hidden border-b border-[#E6E1D8] bg-white/40 px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
                {conversations.length === 0 && (
                  <p className="text-[11px] text-[#9A9086] text-center py-2">Inga tidigare chattar</p>
                )}
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => loadConversation(conv.id)}
                    className="w-full text-left rounded-xl px-3 py-2 text-xs text-[#6B6158] hover:bg-white/60 transition"
                  >
                    <span className="truncate block">{conv.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Messages area */}
            <div className="flex h-[60svh] min-h-[360px] flex-col gap-4 overflow-y-auto px-6 py-6">
              {!accessToken && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Du måste vara inloggad för att använda chatten.
                </div>
              )}

              {/* Welcome state */}
              {!hasMessages && (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a0c81d]/15">
                      <span className="text-2xl">💬</span>
                    </div>
                    <p className="text-base font-semibold text-[#3D3D3D]">Hur kan vi hjälpa dig idag?</p>
                    <p className="mt-1 text-xs text-[#6B6158]">Välj en snabbfråga eller skriv fritt nedan.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {quickPrompts.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="rounded-2xl border border-[#E6E1D8] bg-white/70 px-4 py-3 text-left text-xs font-medium text-[#3D3D3D] transition hover:border-[#a0c81d] hover:bg-white hover:shadow-sm"
                        onClick={() => sendMessage(item.prompt)}
                        disabled={isStreaming || !accessToken}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              <div className="flex flex-col gap-4">
                {messages.map((msg) => renderMessage(msg))}

                {/* Streaming indicator */}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-[#E6E1D8] bg-white/80 px-4 py-3 text-xs text-[#6B6158]">
                      <div className="flex items-center gap-2">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#a0c81d] animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#a0c81d] animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#a0c81d] animate-bounce [animation-delay:300ms]" />
                        </span>
                        <span>PTO Coach tänker…</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error + retry */}
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    <p>{error}</p>
                    {lastFailedInput && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-red-100 px-3 py-1.5 text-[11px] font-semibold text-red-800 transition hover:bg-red-200"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Försök igen
                      </button>
                    )}
                  </div>
                )}

                <div ref={endRef} />
              </div>
            </div>

            {/* Input area */}
            <form onSubmit={handleSubmit} className="border-t border-[#E6E1D8] px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="sr-only" htmlFor="support-chat-input">
                    Skriv ditt meddelande
                  </label>
                  <textarea
                    ref={inputRef}
                    id="support-chat-input"
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-[#E6E1D8] bg-white/80 px-4 py-3 text-sm text-[#3D3D3D] placeholder:text-[#9A9086] focus:border-[#a0c81d] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[#F6F1E7]"
                    placeholder="Skriv ditt meddelande…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming || !accessToken}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-[#a0c81d] px-5 py-3 text-sm font-semibold text-[#0b1222] transition hover:bg-[#b6df27] disabled:cursor-not-allowed disabled:bg-[#d7e3a6]"
                  disabled={isStreaming || !input.trim() || !accessToken}
                >
                  Skicka
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[#6B6158]">
                <span>Vi sparar inga känsliga uppgifter i chatten.</span>
                <span className="font-mono">Säker session</span>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupportChat;
