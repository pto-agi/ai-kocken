import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles, ShieldCheck, AlertTriangle, Clock, Play, PauseCircle, CalendarPlus } from 'lucide-react';
import { fetchCheckoutSessionStatus } from '../utils/paymentsClient';
import { useAuthStore } from '../store/authStore';

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
  const { profile } = useAuthStore();
  const state = location.state as ForlangningTackState | null;
  const params = new URLSearchParams(location.search);
  const checkoutSessionId = params.get('session_id');
  const isFriskvard = params.get('friskvard') === '1';
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'loading' | 'success' | 'pending' | 'error'>('idle');
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState<string | null>(null);

  // Determine membership status
  const subscriptionStatus =
    (typeof profile?.subscription_status === 'string' && profile.subscription_status) ||
    (profile?.coaching_expires_at ? 'active' : 'inactive');

  const isActive = subscriptionStatus === 'active';
  const isPaused = subscriptionStatus === 'paused';
  const isExpired = subscriptionStatus === 'expired' || subscriptionStatus === 'inactive' || subscriptionStatus === 'deactivated';

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

    return () => { active = false; };
  }, [checkoutSessionId]);

  // ── Contextual content based on membership status ──
  const getContextualContent = () => {
    if (isActive) {
      return {
        headline: 'Din förlängning är registrerad!',
        subtitle: 'Tiden adderas på ditt aktiva medlemskap och ditt utgångsdatum flyttas fram.',
        icon: <CalendarPlus className="w-6 h-6" />,
        badge: 'Aktivt medlemskap',
        badgeStyle: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
        nextSteps: [
          checkoutSessionId
            ? 'Betalningen synkas automatiskt med din profil.'
            : isFriskvard
              ? 'Slutför betalningen i din friskvårdsportal så kopplar vi den till din förlängning.'
              : 'Vi bekräftar betalningen och uppdaterar ditt medlemskap.',
          `Ditt nya utgångsdatum blir ${state?.newExpiresAt || 'uppdaterat'} — du behöver inte göra något mer.`,
          'Du fortsätter träna som vanligt utan avbrott.',
        ],
        ctaLabel: 'Mina sidor',
        ctaPath: '/profile',
      };
    }

    if (isPaused) {
      return {
        headline: 'Förlängningen är registrerad!',
        subtitle: 'Tiden adderas på ditt pausade medlemskap. Du har nu fler månader innestående när du vill komma igång igen.',
        icon: <PauseCircle className="w-6 h-6" />,
        badge: 'Pausat medlemskap',
        badgeStyle: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
        nextSteps: [
          checkoutSessionId
            ? 'Betalningen synkas automatiskt med din profil.'
            : isFriskvard
              ? 'Slutför betalningen i din friskvårdsportal så kopplar vi den till din förlängning.'
              : 'Vi bekräftar betalningen och uppdaterar ditt medlemskap.',
          `Ditt nya utgångsdatum blir ${state?.newExpiresAt || 'uppdaterat'} men perioden förblir fryst tills du återaktiverar.`,
          'Redo att börja igen? Återaktivera direkt via Mina sidor.',
        ],
        ctaLabel: 'Återaktivera mitt medlemskap',
        ctaPath: '/profile/adminpanel',
      };
    }

    // Expired / inactive / deactivated
    return {
      headline: 'Välkommen tillbaka — nu kör vi igen!',
      subtitle: 'Vi har registrerat din förlängning och gör allt klart för att du ska komma igång.',
      icon: <Play className="w-6 h-6" />,
      badge: 'Ny start',
      badgeStyle: 'bg-[#a0c81d]/15 text-[#5C7A12] border-[#a0c81d]/30',
      nextSteps: [
        checkoutSessionId
          ? 'Betalningen synkas automatiskt med din profil.'
          : isFriskvard
            ? 'Slutför betalningen i din friskvårdsportal så kopplar vi den till din förlängning.'
            : 'Vi bekräftar betalningen och uppdaterar ditt medlemskap.',
        `Ditt nya utgångsdatum blir ${state?.newExpiresAt || 'uppdaterat'} och vi öppnar upp ditt konto.`,
        'Fyll i startformuläret så vi kan skräddarsy ditt nya program.',
      ],
      ctaLabel: 'Fyll i startformulär',
      ctaPath: '/start',
    };
  };

  const ctx = getContextualContent();
  const displayEmail = state?.email || checkoutEmail || profile?.email;
  const displayName = state?.fullName || profile?.full_name || '';
  const paymentLabel = isFriskvard
    ? 'Friskvårdsbidrag'
    : checkoutSessionId
      ? 'Kort / Klarna via Stripe'
      : state?.paymentMethod || '';

  // Override headline/subtitle for checkout error/pending states
  const isCheckoutError = checkoutStatus === 'error';
  const isCheckoutPending = checkoutStatus === 'pending';

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-12 md:pb-24 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-12%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[520px] h-[520px] bg-emerald-500/5 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.6rem] p-8 md:p-12 border border-[#E6E1D8] shadow-2xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                  isCheckoutError
                    ? 'bg-red-100 border-red-300 text-red-600'
                    : isCheckoutPending
                      ? 'bg-amber-100 border-amber-300 text-amber-600'
                      : 'bg-[#a0c81d]/15 border-[#a0c81d]/40 text-[#a0c81d]'
                }`}>
                  {isCheckoutError ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : isCheckoutPending ? (
                    <Clock className="w-6 h-6" />
                  ) : (
                    ctx.icon
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">
                    {isCheckoutError ? 'Betalning misslyckades' : isCheckoutPending ? 'Väntar på betalning' : 'Bekräftelse'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${ctx.badgeStyle}`}>
                    {ctx.badge}
                  </span>
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">
                {isCheckoutPending
                  ? 'Betalningen är inte slutförd'
                  : isCheckoutError
                    ? 'Något gick fel med betalningen'
                    : ctx.headline}
              </h1>
              <p className="text-[#6B6158] mt-3 max-w-2xl">
                {isCheckoutPending
                  ? 'Det verkar som att betalningen avbröts eller inte slutfördes. Du kan gå tillbaka och försöka igen.'
                  : isCheckoutError
                    ? 'Vi kunde inte bekräfta betalningen. Prova igen eller kontakta support.'
                    : ctx.subtitle}
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Link
                to={ctx.ctaPath}
                className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition flex items-center justify-center gap-2"
              >
                {ctx.ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/support"
                className="px-6 py-3 rounded-xl bg-[#F6F1E7] border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:text-[#a0c81d] transition flex items-center justify-center gap-2"
              >
                Kontakta support
              </Link>
            </div>
          </div>

          {/* Checkout verification message */}
          {checkoutMessage && (
            <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              isCheckoutError
                ? 'border-red-300 bg-red-50 text-red-800'
                : checkoutStatus === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-[#E6E1D8] bg-[#F6F1E7]/80 text-[#6B6158]'
            }`}>
              {checkoutMessage}
            </div>
          )}

          {/* Content grid */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Next steps — contextual */}
            <div className="lg:col-span-2 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">
                <Sparkles className="w-4 h-4" /> Vad händer nu?
              </div>
              <ul className="space-y-3 text-sm text-[#6B6158]">
                {ctx.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#a0c81d] shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>

              {/* Friskvård portal instructions */}
              {isFriskvard && (
                <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-sky-700 mb-2">Friskvårdsportal</p>
                  <ol className="space-y-2 text-sm text-sky-800">
                    <li>1. Logga in i din friskvårdsportal{state?.portal ? ` (${state.portal})` : ''}.</li>
                    <li>2. Sök efter <strong>Private Training Online</strong>.</li>
                    <li>3. Genomför betalningen — vi kopplar den automatiskt till din förlängning.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/80 p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">
                  <ShieldCheck className="w-4 h-4" /> Sammanfattning
                </div>
                <div className="space-y-2.5 text-sm text-[#6B6158]">
                  {displayName && (
                    <div><span className="font-black text-[#3D3D3D]">Namn:</span> {displayName}</div>
                  )}
                  {displayEmail && (
                    <div><span className="font-black text-[#3D3D3D]">E-post:</span> {displayEmail}</div>
                  )}
                  {paymentLabel && (
                    <div><span className="font-black text-[#3D3D3D]">Betalning:</span> {paymentLabel}</div>
                  )}
                  {state?.portal && (
                    <div><span className="font-black text-[#3D3D3D]">Portal:</span> {state.portal}</div>
                  )}
                  {state?.newExpiresAt && (
                    <div className="pt-2 border-t border-[#E6E1D8]">
                      <span className="font-black text-[#3D3D3D]">Nytt utgångsdatum:</span>{' '}
                      <span className="font-black text-[#a0c81d]">{state.newExpiresAt}</span>
                    </div>
                  )}
                  {state?.currentExpiresAt && (
                    <div className="text-xs text-[#8A8177]">
                      Tidigare: {state.currentExpiresAt}
                    </div>
                  )}
                  {checkoutSessionId && checkoutStatus === 'success' && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6E1D8] text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">Stripe-betalning bekräftad</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
