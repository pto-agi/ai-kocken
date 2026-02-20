import React, { useMemo, useState } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import type { ChatKitOptions } from '@openai/chatkit';

const chatkitBaseOptions: Omit<ChatKitOptions, 'api'> = {
  theme: {
    colorScheme: 'light',
    radius: 'pill',
    density: 'normal',
    color: {
      accent: {
        primary: '#a0c81d',
        level: 2,
      },
      grayscale: {
        hue: 0,
        tint: 0,
      },
      surface: {
        background: '#F6F1E7',
        foreground: '#F4F0E6',
      },
    },
    typography: {
      baseSize: 16,
      fontFamily:
        '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontFamilyMono:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
      fontSources: [
        {
          family: 'OpenAI Sans',
          src: 'https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2',
          weight: 400,
          style: 'normal',
          display: 'swap',
        },
        {
          family: 'OpenAI Sans',
          src: 'https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-SemiBold.woff2',
          weight: 600,
          style: 'normal',
          display: 'swap',
        },
      ],
    },
  },
  header: {
    enabled: false,
  },
  composer: {
    placeholder: 'Skriv ditt meddelande…',
    attachments: {
      enabled: false,
    },
  },
  startScreen: {
    greeting: 'Hur kan vi hjälpa dig idag?',
    prompts: [
      { icon: 'circle-question', label: 'Medlemskap', prompt: 'Jag behöver hjälp med mitt medlemskap.' },
      { icon: 'keys', label: 'Inloggning', prompt: 'Jag kommer inte in på mitt konto.' },
      { icon: 'calendar', label: 'Veckomeny', prompt: 'Hjälp mig med min veckomeny.' },
      { icon: 'document', label: 'Beställning', prompt: 'Jag har frågor om en beställning.' },
    ],
  },
  disclaimer: {
    text: 'Behöver du teknisk support? Skriv **support** så hjälper vi dig vidare.',
  },
};

const SupportChat: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [hasThread, setHasThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sessionUrl = useMemo(() => '/api/chatkit/session', []);

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
    <div className="relative bg-[#F6F1E7] text-[#3D3D3D]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#a0c81d]/10 blur-[140px]" />
        <div className="absolute right-[-120px] top-1/3 h-[420px] w-[420px] rounded-full bg-[#ffffff]/70 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.25] [background-image:radial-gradient(rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <div className="relative flex w-full flex-col px-0 py-2 sm:px-6">
        <section className={`${hasThread ? 'pt-0' : ''}`}>
          <div className="bg-[#F6F1E7]/90 backdrop-blur">
            <div className="px-0 py-2">
              <div className="support-chatkit relative h-[60svh] min-h-[320px] sm:min-h-[380px] w-full bg-transparent">
                <div className="h-full w-full">
                  <ChatKit control={control} className="h-full w-full" />
                </div>
                {!isReady && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b1222]/60 text-sm text-[#6B6158]">
                    Laddar chatten…
                  </div>
                )}
                {chatError && (
                  <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                    Chatten kunde inte laddas: {chatError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E1D8] px-4 py-3 text-xs text-[#6B6158] sm:px-2">
              <span>Välj en snabbfråga eller skriv din egen fråga.</span>
              <span className="font-mono">Säker session</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupportChat;
