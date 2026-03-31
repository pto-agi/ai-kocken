import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';

type FriskvardState = {
  planId?: string;
  planLabel?: string;
  planPrice?: string;
  portal?: string;
};

export const ForlangningFriskvardTack: React.FC = () => {
  const location = useLocation();
  const state = location.state as FriskvardState | null;
  const searchParams = new URLSearchParams(location.search);

  const planPrice = (searchParams.get('price') || state?.planPrice || '').trim();
  const priceText = planPrice ? `${planPrice.replace(':-', '')} kr` : '';

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-12 md:pb-24 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-12%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[520px] h-[520px] bg-emerald-500/5 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.6rem] p-8 md:p-12 border border-[#E6E1D8] shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/15 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Friskvårdsportal</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight leading-tight">
            Tack! Det är bara ett sista steg kvar.
          </h1>

          <p className="text-[#6B6158] mt-4 text-[15px] leading-relaxed max-w-2xl">
            Din förlängning ligger nu och väntar på dig. Gå till din friskvårdsportal – exempelvis
            Benify, Epassi eller Benefits – och slutför betalningen för att köpet ska regleras
            direkt genom ditt friskvårdsbidrag.
          </p>

          {/* Steps */}
          <div className="mt-8 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none mt-0.5">🔑</span>
                <div>
                  <p className="text-sm font-bold text-[#3D3D3D]">1. Logga in i din friskvårdsportal</p>
                  <p className="text-xs text-[#8A8177] mt-0.5">Benify, Epassi, Benefits eller den portal din arbetsgivare använder.</p>
                </div>
              </div>

              <div className="border-t border-[#E6E1D8]" />

              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none mt-0.5">🔍</span>
                <div>
                  <p className="text-sm font-bold text-[#3D3D3D]">2. Sök efter <em>Private Training Online</em></p>
                  <p className="text-xs text-[#8A8177] mt-0.5">
                    Välj paketet som matchar din förlängning{priceText ? ` (${priceText})` : ''}.
                  </p>
                </div>
              </div>

              <div className="border-t border-[#E6E1D8]" />

              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none mt-0.5">🎉</span>
                <div>
                  <p className="text-sm font-bold text-[#3D3D3D]">3. Genomför betalningen – klart!</p>
                  <p className="text-xs text-[#8A8177] mt-0.5">
                    Vi kopplar betalningen till din förlängning och du får ett bekräftelsemejl när allt är aktiverat.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/profile"
              className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition flex items-center justify-center gap-2"
            >
              Mina sidor <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/uppfoljning"
              className="px-6 py-3 rounded-xl bg-[#F6F1E7] border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:text-[#a0c81d] transition flex items-center justify-center gap-2"
            >
              Uppföljning
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};
