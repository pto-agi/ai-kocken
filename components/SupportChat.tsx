import React, { useMemo, useState } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import type { ChatKitOptions } from '@openai/chatkit';

const chatkitBaseOptions: Omit<ChatKitOptions, 'api'> = {
  theme: {
    colorScheme: 'dark',
    radius: 'round',
    density: 'spacious',
    color: {
      grayscale: {
        hue: 220,
        tint: 6,
      },
      accent: {
        primary: '#a0c81d',
        level: 1,
      },
    },
    typography: {
      baseSize: 16,
      fontFamily:
        '"Poppins", "Open Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontFamilyMono:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
    },
  },
  header: {
    enabled: false,
  },
  composer: {
    placeholder: 'Hur kan vi hjälpa dig idag?',
    attachments: {
      enabled: true,
      maxCount: 5,
      maxSize: 10_485_760,
    },
  },
  startScreen: {
    greeting: 'Vad vill du ha hjälp med idag?',
  },
  disclaimer: {
    text: 'Behöver du teknisk support? Skriv **support** så hjälper vi dig vidare.',
  },
};

const getSessionUrl = () => {
  const env = (import.meta as any).env || {};
  return env.VITE_CHATKIT_SESSION_URL || '/api/chatkit/session';
};

const SupportChat: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [hasThread, setHasThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sessionUrl = useMemo(() => getSessionUrl(), []);

  const { control, sendUserMessage } = useChatKit({
    ...chatkitBaseOptions,
    onReady: () => setIsReady(true),
    onError: ({ error }) => setChatError(error?.message ?? 'Okänt fel.'),
    onThreadChange: ({ threadId }) => setHasThread(Boolean(threadId)),
    api: {
      async getClientSecret() {
        const res = await fetch(sessionUrl, { method: 'POST' });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to create ChatKit session');
        }

        const data = await res.json();
        return data.client_secret as string;
      },
    },
  });

  const handleSuggestion = async (text: string) => {
    if (!isReady || isSending) return;
    setIsSending(true);
    try {
      await sendUserMessage({ text, newThread: !hasThread });
      setHasThread(true);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-[#E6E1D8] bg-[#F6F1E7] text-[#3D3D3D] shadow-2xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#a0c81d]/10 blur-[140px]" />
        <div className="absolute right-[-120px] top-1/3 h-[420px] w-[420px] rounded-full bg-[#ffffff]/70 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.25] [background-image:radial-gradient(rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <section className={`mt-3 ${hasThread ? 'pt-2' : ''}`}>
          <div className="rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-transparent p-[1px] shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
            <div className="rounded-[27px] bg-[#F6F1E7]/95 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E1D8] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <img
                    src="/logotyp-mix.png"
                    alt="Private Training Online"
                    className="h-7 w-auto object-contain"
                    loading="eager"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#3D3D3D]">Private Training Online</p>
                    <p className="text-xs text-[#6B6158]">Kundtjänst · Svarar vanligtvis inom 2 minuter</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B6158] font-heading">
                  <button
                    type="button"
                    onClick={() => handleSuggestion('Jag behöver teknisk support.')}
                    className="rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-3 py-1 text-[#6B6158] transition-colors hover:border-[#a0c81d]/30 hover:text-[#3D3D3D]"
                  >
                    Support
                  </button>
                  <span className="rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-3 py-1">Online</span>
                </div>
              </div>

              <div className="px-4 py-4 sm:px-6">
                <div className="relative h-[60vh] min-h-[460px] w-full rounded-[22px] border border-[#E6E1D8] bg-gradient-to-b from-[#F6F1E7] via-[#F6F1E7] to-[#F6F1E7] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="h-full w-full">
                    <ChatKit control={control} className="h-full w-full" />
                  </div>
                  {!isReady && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[22px] bg-[#0b1222]/70 text-sm text-[#6B6158]">
                      Laddar chatten…
                    </div>
                  )}
                  {chatError && (
                    <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                      Chatten kunde inte laddas: {chatError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E1D8] px-5 py-4 text-xs text-[#6B6158] sm:px-6">
                <span>Välj en snabbfråga eller skriv din egen fråga.</span>
                <span className="font-mono">Säker session</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupportChat;
