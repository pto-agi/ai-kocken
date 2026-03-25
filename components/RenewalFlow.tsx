import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, User2 } from 'lucide-react';
import { computeYearEndOffer } from '../utils/extensionOffer';
import EmbeddedCheckoutCard from './EmbeddedCheckoutCard';
import { isPaymentsV2Enabled } from '../utils/paymentFeatureFlags';
import { createCheckoutSession } from '../utils/paymentsClient';

const PAYMENT_OPTIONS = [
  'Jag betalar via friskvårdsportal',
  'Faktura utan extra avgifter',
  'Swish (123 003 73 17)',
  'Delbetalning',
];

const PORTAL_OPTIONS = [
  'Benify / Benifex',
  'Epassi',
  'Benefits',
  'Wellnet',
  'Söderberg & Partners',
  'Edenred',
];



type FlowStep = 'intro' | 'offer' | 'confirm';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  payment: string;
  portal: string;
};

type RenewalFlowProps = {
  profile: {
    full_name?: string | null;
    email?: string | null;
    coaching_expires_at?: string | null;
  } | null;
  session: {
    access_token?: string | null;
    user?: { id?: string | null; email?: string | null };
  } | null;
  compact?: boolean;
};

function formatDate(value?: string | null): string {
  if (!value) return 'Ej registrerat';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('sv-SE');
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const [firstName = '', ...rest] = trimmed.split(' ');
  return { firstName, lastName: rest.join(' ') };
}

export const RenewalFlow: React.FC<RenewalFlowProps> = ({ profile, session, compact = false }) => {
  const navigate = useNavigate();
  const paymentsV2 = isPaymentsV2Enabled();

  const [step, setStep] = useState<FlowStep>('intro');
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    payment: '',
    portal: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'friskvardsbidrag'>('stripe');

  const offer = useMemo(() => computeYearEndOffer({
    coachingExpiresAt: profile?.coaching_expires_at || null,
    monthlyPrice: 249,
  }), [profile?.coaching_expires_at]);

  const isPortalRequired = !paymentsV2 && form.payment === 'Jag betalar via friskvårdsportal';

  useEffect(() => {
    if (!profile && !session?.user?.email) return;

    const nameParts = splitName(profile?.full_name || '');
    const email = profile?.email || session?.user?.email || '';

    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || nameParts.firstName,
      lastName: prev.lastName || nameParts.lastName,
      email: prev.email || email,
    }));
  }, [profile?.full_name, profile?.email, session?.user?.email]);

  const validateForm = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      return 'Fyll i förnamn, efternamn och e-post.';
    }
    if (!paymentsV2 && !form.payment) {
      return 'Välj betalningsmetod.';
    }
    if (!paymentsV2 && isPortalRequired && !form.portal) {
      return 'Välj vilken friskvårdsportal du använder.';
    }
    return null;
  };

  const handleContinue = () => {
    setError(null);

    if (offer.monthCount <= 0) {
      setError('Din period ser redan ut att täcka året ut. Kontakta support för nästa erbjudande.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStep('confirm');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (paymentsV2) return;
    setError(null);
    setStatus('sending');

    try {
      const forlangningRes = await fetch('/api/economy/forlangning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          month_count: offer.monthCount,
          total_price: offer.totalPrice,
          current_expires_at: offer.currentExpiresAt || '',
          new_expires_at: offer.newExpiresAt,
          billing_starts_at: offer.billingStartsAt,
          payment_method: form.payment,
          wellness_portal: isPortalRequired ? form.portal : '',
          campaign_year: offer.campaignYear,
        }),
      });

      if (!forlangningRes.ok) throw new Error('Förlängning request failed');

      navigate('/tack-forlangning', {
        state: {
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          email: form.email.trim(),
          paymentMethod: form.payment,
          portal: isPortalRequired ? form.portal : '',
          newExpiresAt: offer.newExpiresAt,
          currentExpiresAt: offer.currentExpiresAt,
          billingStartsAt: offer.billingStartsAt,
        },
      });
    } catch (err) {
      console.error('Forlangning submit error:', err);
      setStatus('error');
      setError('Kunde inte registrera förlängningen just nu. Försök igen.');
      return;
    }

    setStatus('idle');
  };

  const displayName = profile?.full_name?.trim() || `${form.firstName} ${form.lastName}`.trim() || 'vän';
  const padding = compact ? 'p-5 md:p-6' : 'p-6 md:p-8';
  const inputClass = 'w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-2.5 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none';

  return (
    <div className={`bg-[#E8F1D5]/85 backdrop-blur-xl rounded-[2rem] ${padding} border border-[#E6E1D8] shadow-2xl`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#8A8177] mb-4">
        <Sparkles className="w-4 h-4 text-[#a0c81d]" />
        Förlängning
        <span className="ml-auto text-[#6B6158] tracking-[0.14em]">
          Steg {step === 'intro' ? '1' : step === 'offer' ? '2' : '3'} av 3
        </span>
      </div>

      {step === 'intro' && (
        <div className="space-y-4">
          <h2 className={`${compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} font-black text-[#3D3D3D]`}>
            Hej {displayName}, säkra din plats året ut.
          </h2>
          <p className="text-sm md:text-base text-[#6B6158] font-medium">
            Ditt nuvarande utgångsdatum är <span className="font-black text-[#3D3D3D]">{formatDate(profile?.coaching_expires_at)}</span>.
          </p>

          <div className="rounded-2xl border border-[#E6E1D8] bg-white/70 p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-[#8A8177] mb-2">Kampanj</p>
            <p className="text-sm text-[#6B6158]">
              Förläng året ut till <span className="font-black text-[#3D3D3D]">{offer.campaignEndsAt}</span> med ett personligt erbjudande anpassat till din period.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#F6F1E7] border border-[#E6E1D8] text-[11px] font-bold uppercase tracking-wide text-[#6B6158]">
                Tar ca 30 sekunder
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#F6F1E7] border border-[#E6E1D8] text-[11px] font-bold uppercase tracking-wide text-[#6B6158]">
                Ingen betalning i detta steg
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('offer');
            }}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition inline-flex items-center justify-center gap-2"
          >
            Se ditt personliga erbjudande
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'offer' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#E6E1D8] bg-white/70 p-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8A8177]">Ditt erbjudande</p>
            {offer.monthCount > 0 ? (
              <>
                <p className="text-lg font-black text-[#3D3D3D]">Ditt personliga pris: {offer.totalPrice} kr</p>
                <p className="text-sm text-[#6B6158]">
                  Nytt utgångsdatum blir <span className="font-black text-[#3D3D3D]">{offer.newExpiresAt}</span> efter bekräftelse.
                </p>
                <p className="text-sm text-[#6B6158]">
                  Beräknat från <span className="font-black text-[#3D3D3D]">{offer.billingStartsAt}</span> till <span className="font-black text-[#3D3D3D]">{offer.campaignEndsAt}</span> baserat på din period.
                </p>
              </>
            ) : (
              <p className="text-sm text-[#6B6158]">
                Din period täcker redan året ut. Kontakta support för nästa kampanj.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Förnamn</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                className={inputClass}
                placeholder="Förnamn"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Efternamn</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                className={inputClass}
                placeholder="Efternamn"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">E-post</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={inputClass}
              placeholder="E-postadress"
            />
          </div>

          {!paymentsV2 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Betalningsmetod</p>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      form.payment === option ? 'border-[#a0c81d]/60 bg-[#F6F1E7]' : 'border-[#E6E1D8] bg-[#F6F1E7]/60'
                    }`}
                  >
                    <span className="text-sm text-[#3D3D3D]">{option}</span>
                    <input
                      type="radio"
                      name="renewal-payment"
                      value={option}
                      checked={form.payment === option}
                      onChange={() => setForm((prev) => ({ ...prev, payment: option, portal: '' }))}
                      className="accent-[#a0c81d]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {isPortalRequired && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Friskvårdsportal</label>
              <select
                value={form.portal}
                onChange={(e) => setForm((prev) => ({ ...prev, portal: e.target.value }))}
                className={inputClass}
              >
                <option value="">Välj portal</option>
                {PORTAL_OPTIONS.map((portal) => (
                  <option key={portal} value={portal}>{portal}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('intro');
              }}
              className="px-5 py-3 rounded-xl bg-white/70 border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:bg-white transition"
            >
              Tillbaka
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition inline-flex items-center justify-center gap-2"
            >
              Fortsätt
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-[#E6E1D8] bg-white/70 p-4 space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8A8177]">Bekräfta förlängning</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#6B6158]">
              <div className="flex items-start gap-2">
                <User2 className="w-4 h-4 mt-0.5 text-[#6B6158]" />
                <span>{form.firstName} {form.lastName}</span>
              </div>
              <div>{form.email}</div>
              <div>Nuvarande utgångsdatum: {offer.currentExpiresAt || 'Ej registrerat'}</div>
              <div>Nytt utgångsdatum: <span className="font-black text-[#3D3D3D]">{offer.newExpiresAt}</span></div>
              <div>Betalning: {paymentsV2 ? 'Kort/Wallet/Klarna via Stripe' : form.payment}</div>
              <div>{paymentsV2 ? 'Portal: —' : isPortalRequired ? `Portal: ${form.portal}` : 'Portal: —'}</div>
            </div>

            <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3 text-sm text-[#6B6158]">
              <div className="font-black text-[#3D3D3D]">
                {paymentsV2 ? 'Förlängningen aktiveras automatiskt när betalningen är klar.' : 'Förlängningen registreras direkt när du bekräftar.'}
              </div>
              <div className="mt-1">
                {paymentsV2 ? 'Slutför betalningen i den säkra checkouten nedan.' : 'Betalningen hanteras separat med dig av teamet efter att förlängningen skickats in.'}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('offer');
              }}
              className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6158] hover:text-[#3D3D3D] transition"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              Tillbaka till erbjudande
            </button>
            {paymentsV2 ? (
              <div className="rounded-2xl border border-[#E6E1D8] bg-white/70 p-4 space-y-4">
                {/* Payment method toggle */}
                <div className="flex gap-2">
                  <label
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                      paymentMethod === 'stripe'
                        ? 'border-[#a0c81d] bg-[#a0c81d]/10'
                        : 'border-[#E6E1D8] bg-white/60 hover:bg-white/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="stripe"
                      checked={paymentMethod === 'stripe'}
                      onChange={() => setPaymentMethod('stripe')}
                      className="accent-[#a0c81d]"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">💳 Kort / Klarna</span>
                  </label>
                  <label
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                      paymentMethod === 'friskvardsbidrag'
                        ? 'border-[#a0c81d] bg-[#a0c81d]/10'
                        : 'border-[#E6E1D8] bg-white/60 hover:bg-white/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="friskvardsbidrag"
                      checked={paymentMethod === 'friskvardsbidrag'}
                      onChange={() => setPaymentMethod('friskvardsbidrag')}
                      className="accent-[#a0c81d]"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">🏥 Friskvårdsbidrag</span>
                  </label>
                </div>

                {paymentMethod === 'stripe' ? (
                  <EmbeddedCheckoutCard
                    accessToken={session?.access_token || null}
                    payload={{
                      flow: 'forlangning',
                      mode: 'payment',
                      userId: session?.user?.id,
                      email: form.email.trim(),
                      fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
                      forlangningOffer: {
                        monthlyPrice: offer.monthlyPrice,
                        monthCount: offer.monthCount,
                        totalPrice: offer.totalPrice,
                        campaignYear: offer.campaignYear,
                        billableDays: offer.billableDays,
                        calculationMode: offer.calculationMode,
                        currentExpiresAt: offer.currentExpiresAt,
                        billingStartsAt: offer.billingStartsAt,
                        newExpiresAt: offer.newExpiresAt,
                      },
                      successPath: '/tack-forlangning',
                      cancelPath: '/forlangning',
                    }}
                    buttonLabel="Gå till säker betalning"
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#F6F1E7]/70 border border-[#E6E1D8] text-sm text-[#3D3D3D]">
                      <p className="font-bold mb-1">Betalning via friskvårdsbidrag</p>
                      <p className="text-xs text-[#6B6158]">
                        Din beställning registreras och en bekräftelse skickas till dig via e-post.
                        Administratör godkänner innan tjänsten aktiveras.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={status === 'sending'}
                      onClick={async () => {
                        setStatus('sending');
                        setError(null);
                        try {
                          const result = await createCheckoutSession(
                            {
                              flow: 'forlangning',
                              mode: 'payment',
                              paymentMethod: 'friskvardsbidrag',
                              userId: session?.user?.id,
                              email: form.email.trim(),
                              fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
                              forlangningOffer: {
                                monthlyPrice: offer.monthlyPrice,
                                monthCount: offer.monthCount,
                                totalPrice: offer.totalPrice,
                                campaignYear: offer.campaignYear,
                                billableDays: offer.billableDays,
                                calculationMode: offer.calculationMode,
                                currentExpiresAt: offer.currentExpiresAt,
                                billingStartsAt: offer.billingStartsAt,
                                newExpiresAt: offer.newExpiresAt,
                              },
                            },
                            session?.access_token,
                          );
                          if (result.friskvard) {
                            navigate('/tack-forlangning?friskvard=1');
                          } else {
                            setError(result.error || 'Något gick fel');
                            setStatus('error');
                          }
                        } catch (e: any) {
                          setError(e?.message || 'Kunde inte skicka beställning');
                          setStatus('error');
                        }
                      }}
                      className="w-full px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition inline-flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {status === 'sending' ? 'Registrerar...' : 'Beställ med friskvårdsbidrag'}
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="submit"
                disabled={status === 'sending'}
                className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition inline-flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {status === 'sending' ? 'Registrerar...' : 'Bekräfta förlängning'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
