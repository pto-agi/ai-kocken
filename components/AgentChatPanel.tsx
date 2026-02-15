import React, { useMemo, useState } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { Bot, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

type AgentChatPanelProps = {
  title?: string;
  className?: string;
};

const getSessionUrl = () => {
  const env = (import.meta as any).env || {};
  return env.VITE_CHATKIT_SESSION_URL || '/api/chatkit/session';
};

const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  title = 'Agent‑assistans',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const sessionUrl = useMemo(() => getSessionUrl(), []);

  const { control } = useChatKit({
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

  return (
    <section className={`bg-[#1e293b]/70 border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 md:px-8 py-5 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#a0c81d]/10 text-[#a0c81d] flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Mina sidor</p>
            <h3 className="text-xl font-black text-white">{title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          {isOpen ? 'Dölj' : 'Öppna'}
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 md:px-6 pb-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#0f172a] p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-slate-500 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                Live agent
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Säker session
              </div>
            </div>

            <div className="h-[60vh] min-h-[520px] rounded-2xl border border-white/10 bg-gradient-to-b from-[#0b1220] via-[#0b1220]/70 to-[#111827]">
              <ChatKit control={control} className="h-full w-full" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AgentChatPanel;
