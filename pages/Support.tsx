import React from 'react';
import { CalendarDays, LifeBuoy, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import SupportChat from '../components/SupportChat';

export const Support: React.FC = () => {
  const { profile } = useAuthStore();
  const isStaff = profile?.is_staff === true;

  if (!isStaff) {
    return (
      <div className="min-h-[100svh] min-h-[100dvh] bg-[#F6F1E7] pb-10 md:pb-16 animate-fade-in relative font-sans overflow-x-hidden text-[#3D3D3D] flex flex-col">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-10 md:pt-16">
          <div className="relative overflow-hidden rounded-[2.8rem] border border-[#DAD1C5] bg-white p-8 md:p-12 shadow-[0_35px_90px_rgba(61,61,61,0.2)] ring-1 ring-black/5">
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[#F6F1E7] via-[#ffffff] to-[#E8F1D5] opacity-90" />
              <div className="absolute left-[-20%] top-[-30%] h-[420px] w-[420px] rounded-full bg-[#a0c81d]/15 blur-[130px]" />
              <div className="absolute right-[-25%] bottom-[-40%] h-[520px] w-[520px] rounded-full bg-[#F6F1E7]/90 blur-[160px]" />
              <div className="absolute inset-0 opacity-[0.25] [background-image:radial-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:26px_26px]" />
            </div>

            <div className="relative z-10 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-[#a0c81d]" />
                  Chatt lanseras i mars 2026
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded-full border border-[#E6E1D8] text-[#6B6158] bg-[#ffffff]/70">
                  <CalendarDays className="w-3 h-3" />
                  Snart tillgänglig
                </span>
              </div>

              <h1 className="mt-6 text-3xl md:text-5xl font-black text-[#3D3D3D] font-heading tracking-tight">
                Din chatt är på väg.
              </h1>
              <p className="mt-4 text-[#6B6158] text-sm md:text-base font-medium">
                Vi bygger en snabbare, smartare chattupplevelse med bättre svar och tydligare uppföljning.
                Titta tillbaka i mars så öppnar vi stegvis.
              </p>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Snabb hjälp',
                    text: 'Få svar på frågor om kost, medlemsskap och teknik utan väntetid.'
                  },
                  {
                    title: 'Personlig uppföljning',
                    text: 'Chatten kommer komma ihåg din historik och ge bättre råd.'
                  },
                  {
                    title: 'Prioriterade svar',
                    text: 'Medlemmar får snabbare guidning när det behövs som mest.'
                  },
                  {
                    title: 'Trygg dialog',
                    text: 'Tydliga ramar och smart filtrering gör det lättare att komma vidare.'
                  }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-[#E6E1D8] bg-white/80 p-4 shadow-[0_12px_30px_rgba(61,61,61,0.08)]">
                    <div className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">{item.title}</div>
                    <p className="mt-2 text-sm text-[#6B6158]">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
                <ShieldCheck className="w-3 h-3 text-[#a0c81d]" />
                Tillgänglig för personal nu
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] min-h-[100dvh] bg-[#F6F1E7] pb-10 md:pb-16 animate-fade-in relative font-sans overflow-x-hidden text-[#3D3D3D] flex flex-col">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
            <LifeBuoy className="w-3 h-3 text-[#a0c81d]" /> Chatt
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-black text-[#3D3D3D] font-heading tracking-tight">
            Snabb hjälp, precis när du behöver den
          </h1>
          <p className="mt-3 text-[#6B6158] text-sm md:text-base font-medium">
            Skriv till oss i chatten så guidar vi dig vidare. Vi svarar vanligtvis inom några minuter.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <SupportChat />
        </div>
      </div>
    </div>
  );
};
