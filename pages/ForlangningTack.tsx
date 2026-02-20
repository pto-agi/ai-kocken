import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';

export const ForlangningTack: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-12 md:pb-24 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-12%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[520px] h-[520px] bg-emerald-500/5 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.6rem] p-8 md:p-12 border border-[#E6E1D8] shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/15 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Bekräftelse</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">
                Tack! Din förlängning är mottagen.
              </h1>
              <p className="text-[#6B6158] mt-3 max-w-2xl">
                Vi har registrerat din förlängning. Ditt medlemskap uppdateras och du behåller dina klientpriser
                utan avbrott. Om vi behöver något mer hör vi av oss via e‑post.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Link
                to="/profile"
                className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition flex items-center justify-center gap-2"
              >
                Mina sidor <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/support"
                className="px-6 py-3 rounded-xl bg-[#F6F1E7] border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:text-[#a0c81d] transition flex items-center justify-center gap-2"
              >
                Kontakta support
              </Link>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">
                <Sparkles className="w-4 h-4" /> Nästa steg
              </div>
              <ul className="space-y-3 text-sm text-[#6B6158]">
                <li>Vi bekräftar förlängningen och uppdaterar din period.</li>
                <li>Du får automatiskt tillgång till klientpriser och premiumfunktioner.</li>
                <li>Har du frågor om din förlängning? Hör av dig så hjälper vi dig direkt.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">
                  <ShieldCheck className="w-4 h-4" /> Tryggt & klart
                </div>
                <h2 className="text-lg font-black text-[#3D3D3D]">Allt är registrerat</h2>
                <p className="text-[#6B6158] text-sm mt-2">
                  Din förlängning är säkrad. Vi återkopplar om något behöver kompletteras.
                </p>
              </div>
              <Link
                to="/forlangning"
                className="px-5 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition flex items-center justify-center gap-2"
              >
                Tillbaka till förlängning
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
