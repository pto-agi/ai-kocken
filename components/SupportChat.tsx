import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { useAuthStore } from '../store/authStore';

const quickPrompts = [
  { label: 'Medlemskap', prompt: 'Jag behöver hjälp med mitt medlemskap.' },
  { label: 'Inloggning', prompt: 'Jag kommer inte in på mitt konto.' },
  { label: 'Veckomeny', prompt: 'Hjälp mig med min veckomeny.' },
  { label: 'Beställning', prompt: 'Jag har frågor om en beställning.' },
];

const SupportChat: React.FC = () => {
  const { session } = useAuthStore();
  const accessToken = session?.access_token ?? null;

  const {
    messages,
    append,
    input,
    setInput,
    handleInputChange,
    status,
    error,
  } = useChat({
    api: '/api/chat',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    key: accessToken ?? 'anonymous',
    streamProtocol: 'text',
  });

  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const isReady = status === 'ready';
  const isStreaming = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const handleLocalSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !isReady || isSending || !accessToken) return;
    setIsSending(true);
    try {
      await append({ role: 'user', content: text });
      setInput('');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickPrompt = async (text: string) => {
    if (!isReady || isSending || !accessToken) return;
    setIsSending(true);
    try {
      await append({ role: 'user', content: text });
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = (message: any) => {
    const textParts = (message.parts || []).filter((part: any) => part.type === 'text');
    const content =
      textParts.map((part: any) => part.text).join('') ||
      (typeof message.content === 'string' ? message.content : '');
    if (!content) return null;
    const isUser = message.role === 'user';

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? 'bg-[#a0c81d] text-[#0b1222]'
              : 'bg-white/80 text-[#3D3D3D] border border-[#E6E1D8]'
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative bg-[#F6F1E7] text-[#3D3D3D]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#a0c81d]/10 blur-[140px]" />
        <div className="absolute right-[-120px] top-1/3 h-[420px] w-[420px] rounded-full bg-[#ffffff]/70 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.25] [background-image:radial-gradient(rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <div className="relative flex w-full flex-col px-4 py-4 sm:px-8">
        <section className="w-full">
          <div className="rounded-[28px] border border-[#E6E1D8] bg-[#F6F1E7]/90 backdrop-blur">
            <div className="flex items-center justify-between border-b border-[#E6E1D8] px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-[#3D3D3D]">Supportchat</p>
                <p className="text-xs text-[#6B6158]">Vi hjälper dig med medlemsskapet, planer och support.</p>
              </div>
              <span className="rounded-full bg-[#a0c81d]/15 px-3 py-1 text-[11px] font-semibold text-[#64721c]">
                {isStreaming ? 'Svarar…' : 'Online'}
              </span>
            </div>

            <div className="flex h-[60svh] min-h-[360px] flex-col gap-4 overflow-y-auto px-6 py-6">
              {!accessToken && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Du måste vara inloggad för att använda chatten.
                </div>
              )}

              {!hasMessages && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[#3D3D3D]">Hur kan vi hjälpa dig idag?</p>
                    <p className="text-xs text-[#6B6158]">Välj en snabbfråga eller skriv din egen fråga.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {quickPrompts.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="rounded-2xl border border-[#E6E1D8] bg-white/70 px-4 py-3 text-left text-xs font-semibold text-[#3D3D3D] transition hover:border-[#a0c81d] hover:bg-white"
                        onClick={() => handleQuickPrompt(item.prompt)}
                        disabled={!isReady || !accessToken}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {messages.map((message) => renderMessage(message))}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-[#E6E1D8] bg-white/80 px-4 py-3 text-xs text-[#6B6158]">
                      Skriver…
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            {error && (
              <div className="mx-6 mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                Chatten kunde inte laddas: {error.message || 'Okänt fel'}
              </div>
            )}

            <form onSubmit={handleLocalSubmit} className="border-t border-[#E6E1D8] px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="sr-only" htmlFor="support-chat-input">
                    Skriv ditt meddelande
                  </label>
                  <textarea
                    id="support-chat-input"
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-[#E6E1D8] bg-white/80 px-4 py-3 text-sm text-[#3D3D3D] placeholder:text-[#9A9086] focus:border-[#a0c81d] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[#F6F1E7]"
                    placeholder="Skriv ditt meddelande…"
                    value={input}
                    onChange={handleInputChange}
                    disabled={!isReady || !accessToken || isSending}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-[#a0c81d] px-5 py-3 text-sm font-semibold text-[#0b1222] transition hover:bg-[#b6df27] disabled:cursor-not-allowed disabled:bg-[#d7e3a6]"
                  disabled={!isReady || !input.trim() || !accessToken || isSending}
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
