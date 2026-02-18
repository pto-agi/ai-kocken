import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ShoppingBasket, ArrowRight, Sparkles, Truck } from 'lucide-react';

type OrderItem = {
  id: string;
  title: string;
  qty: number;
  price: number;
};

type OrderState = {
  items: OrderItem[];
  total: number;
  createdAt: string;
  shipping: {
    name: string;
    line1: string;
    line2?: string;
    postalCode: string;
    city: string;
    country: string;
    phone: string;
  };
};

export const RefillTack: React.FC = () => {
  const location = useLocation();
  const state = location.state as OrderState | null;

  if (!state || !state.items?.length) {
    return (
      <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-24 pt-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-[2rem] p-8 border border-[#DAD1C5] shadow-[0_25px_70px_rgba(61,61,61,0.18)]">
            <h1 className="text-2xl font-black text-[#3D3D3D]">Ingen beställning att visa</h1>
            <p className="text-[#6B6158] mt-2">
              Gå tillbaka till shopen för att lägga en beställning.
            </p>
            <Link
              to="/refill"
              className="inline-flex mt-6 px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition"
            >
              Till Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-24 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-12%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-[#DAD1C5] shadow-[0_35px_90px_rgba(61,61,61,0.2)] ring-1 ring-black/5">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1D5] via-[#F6F1E7] to-white opacity-90 rounded-[2.5rem]" />
          <div className="relative">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/15 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Bekräftelse</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">
                  Tack! Din beställning är mottagen.
                </h1>
                <p className="text-[#6B6158] mt-3 max-w-2xl">
                  Vi återkommer med leveransinformation. Här är en summering av din beställning.
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
                  to="/refill"
                  className="px-6 py-3 rounded-xl bg-white/90 border border-[#DAD1C5] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:text-[#a0c81d] transition flex items-center justify-center gap-2"
                >
                  Beställ igen
                </Link>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl border border-[#DAD1C5] bg-white/90 p-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">
                  <ShoppingBasket className="w-4 h-4" /> Beställningsrader
                </div>
                <div className="space-y-3">
                  {state.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-[#3D3D3D]">{item.title}</p>
                        <p className="text-[10px] text-[#8A8177] font-bold uppercase tracking-widest mt-1">Antal: {item.qty}</p>
                      </div>
                      <div className="text-sm font-black text-[#3D3D3D]">{item.qty * item.price} kr</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-[#DAD1C5] pt-4 flex items-center justify-between text-sm font-bold text-[#6B6158]">
                  <span>Total</span>
                  <span className="text-[#3D3D3D] text-lg">{state.total} kr</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DAD1C5] bg-white/90 p-6 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                  <Truck className="w-4 h-4" /> Leverans
                </div>
                <div className="text-sm text-[#6B6158] space-y-1">
                  <div className="font-bold text-[#3D3D3D]">{state.shipping.name || 'Kund'}</div>
                  <div>{state.shipping.line1}</div>
                  {state.shipping.line2 && <div>{state.shipping.line2}</div>}
                  <div>{state.shipping.postalCode} {state.shipping.city}</div>
                  <div>{state.shipping.country}</div>
                  <div>{state.shipping.phone}</div>
                </div>
                <div className="rounded-xl bg-[#F4F0E6] border border-[#DAD1C5] p-4 text-xs text-[#6B6158]">
                  Vi kontaktar dig om leveransdetaljer eller om något behöver bekräftas.
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                  <Sparkles className="w-4 h-4" /> Tack för din beställning
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
