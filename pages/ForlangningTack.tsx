import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { fetchCheckoutSessionStatus } from '../utils/paymentsClient';

type ForlangningTackState = {
  fullName?: string;
  email?: string;
  paymentMethod?: string;
  portal?: string;
  newExpiresAt?: string;
  currentExpiresAt?: string;
  billingStartsAt?: string;
};

export const ForlangningTack: React.FC = () => {
  const location = useLocation();
  const state = location.state as ForlangningTackState | null;
  const params = new URLSearchParams(location.search);
  const checkoutSessionId = params.get('session_id');
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'loading' | 'success' | 'pending' | 'error'>('idle');
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutSessionId) return;
    let active = true;
    setCheckoutStatus('loading');
    setCheckoutMessage('Verifierar betalning...');

    (async () => {
      try {
        const data = await fetchCheckoutSessionStatus(checkoutSessionId);
        if (!active) return;
        const paymentStatus = String(data.payment_status || '');
        const status = String(data.status || '');
        setCheckoutEmail((data.customer_email as string) || null);

        if (paymentStatus === 'paid' || status === 'complete') {
          setCheckoutStatus('success');
          setCheckoutMessage('Betalningen är bekräftad och din förlängning aktiveras automatiskt.');
          return;
        }

        setCheckoutStatus('pending');
        setCheckoutMessage('Checkout är påbörjad men ännu inte slutförd.');
      } catch (error) {
        if (!active) return;
        setCheckoutStatus('error');
        setCheckoutMessage(error instanceof Error ? error.message : 'Kunde inte verifiera betalning.');
      }
    })();

    return () => {
      active = false;
    };
  }, [checkoutSessionId]);

  const hasSummary = Boolean(state && (state.newExpiresAt || state.paymentMethod)) || Boolean(checkoutEmail);

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
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                  checkoutStatus === 'error'
                    ? 'bg-red-100 border-red-300 text-red-600'
                    : checkoutStatus === 'pending'
                      ? 'bg-amber-100 border-amber-300 text-amber-600'
                      : 'bg-[#a0c81d]/15 border-[#a0c81d]/40 text-[#a0c81d]'
                }`}>
                  {checkoutStatus === 'error' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : checkoutStatus === 'pending' ? (
                    <Clock className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                </div>
                <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">
                  {checkoutStatus === 'error' ? 'Betalning misslyckades' : checkoutStatus === 'pending' ? 'Väntar på betalning' : 'Bekräftelse'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">
                {checkoutStatus === 'pending'
                  ? 'Betalningen är inte slutförd'
                  : checkoutStatus === 'error'
                    ? 'Något gick fel med betalningen'
                    : 'Tack! Din förlängning är registrerad.'}
              </h1>
              <p className="text-[#6B6158] mt-3 max-w-2xl">
                {checkoutStatus === 'pending'
                  ? 'Det verkar som att betalningen avbröts eller inte slutfördes. Du kan gå tillbaka och försöka igen.'
                  : checkoutStatus === 'error'
                    ? 'Vi kunde inte bekräfta betalningen. Prova igen eller kontakta support.'
                    : checkoutSessionId
                      ? 'Vi har mottagit din betalning och verifierar status.'
                      : 'Vi hanterar nu betalningen separat med dig och uppdaterar medlemskapet enligt din bekräftelse.'}
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

          {checkoutMessage && (
            <div
              className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
                checkoutStatus === 'error'
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : checkoutStatus === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-[#E6E1D8] bg-[#F6F1E7]/80 text-[#6B6158]'
              }`}
            >
              {checkoutMessage}
            </div>
          )}

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">
                <Sparkles className="w-4 h-4" /> Nästa steg
              </div>
              <ul className="space-y-3 text-sm text-[#6B6158]">
                <li>{checkoutSessionId ? 'Vi synkar betalning mot din profil automatiskt.' : 'Vi bekräftar betalning och uppdaterar medlemskapet.'}</li>
                <li>Nytt utgångsdatum aktiveras enligt bekräftelsen.</li>
                <li>Vid frågor hjälper vi dig direkt via support.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">
                  <ShieldCheck className="w-4 h-4" /> Sammanfattning
                </div>
                {hasSummary ? (
                  <div className="space-y-2 text-sm text-[#6B6158]">
                    {state?.fullName && <div><span className="font-black text-[#3D3D3D]">Namn:</span> {state.fullName}</div>}
                    {(state?.email || checkoutEmail) && <div><span className="font-black text-[#3D3D3D]">E-post:</span> {state?.email || checkoutEmail}</div>}
                    {state?.paymentMethod && <div><span className="font-black text-[#3D3D3D]">Betalning:</span> {state.paymentMethod}</div>}
                    {state?.portal && <div><span className="font-black text-[#3D3D3D]">Portal:</span> {state.portal}</div>}
                    {state?.newExpiresAt && (
                      <div><span className="font-black text-[#3D3D3D]">Nytt utgångsdatum:</span> {state.newExpiresAt}</div>
                    )}
                    {checkoutSessionId && (
                      <div><span className="font-black text-[#3D3D3D]">Checkout-ID:</span> {checkoutSessionId}</div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#6B6158]">Förlängningen är mottagen och under hantering.</p>
                )}
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
