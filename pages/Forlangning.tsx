import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CreditCard, Sparkles, User2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { computeYearEndOffer } from '../utils/extensionOffer';

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

const FORLANGNING_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/uc9x2zz/';
const FORLANGNING_MONTHS_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/u0jqozb/';

type FlowStep = 'intro' | 'offer' | 'confirm';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  payment: string;
  portal: string;
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

export const Forlangning: React.FC = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuthStore();

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

  const offer = useMemo(() => computeYearEndOffer({
    coachingExpiresAt: profile?.coaching_expires_at || null,
    monthlyPrice: 249,
  }), [profile?.coaching_expires_at]);

  const isPortalRequired = form.payment === 'Jag betalar via friskvårdsportal';

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
    if (!form.payment) {
      return 'Välj betalningsmetod.';
    }
    if (isPortalRequired && !form.portal) {
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
    setError(null);
    setStatus('sending');

    const payload = {
      source: 'forlangning',
      campaign: 'year_end_offer',
      campaign_year: offer.campaignYear,
      monthly_price: offer.monthlyPrice,
      month_count: offer.monthCount,
      billable_days: offer.billableDays,
      calculation_mode: offer.calculationMode,
      total_price: offer.totalPrice,
      current_expires_at: offer.currentExpiresAt || '',
      billing_starts_at: offer.billingStartsAt,
      new_expires_at: offer.newExpiresAt,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      email: form.email.trim(),
      payment_method: form.payment,
      wellness_portal: isPortalRequired ? form.portal : '',
    };

    const body = new URLSearchParams(
      Object.entries(payload).map(([key, value]) => [key, String(value ?? '')])
    ).toString();

    try {
      let res: Response | null = null;

      try {
        res = await fetch(FORLANGNING_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
      } catch (err) {
        console.warn('Forlangning webhook primary failed, retrying no-cors:', err);
        await fetch(FORLANGNING_WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body,
        });
        res = null;
      }

      if (res && !res.ok) throw new Error('Webhook failed');

      const roundedMonthsExtended = Math.max(0, Math.round(offer.monthCount));
      const monthsPayload = new URLSearchParams({
        name: payload.name,
        email: payload.email,
        months_extended: `${roundedMonthsExtended} månader`,
      }).toString();

      let monthsRes: Response | null = null;

      try {
        monthsRes = await fetch(FORLANGNING_MONTHS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: monthsPayload,
        });
      } catch (err) {
        console.warn('Forlangning months webhook primary failed, retrying no-cors:', err);
        await fetch(FORLANGNING_MONTHS_WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: monthsPayload,
        });
        monthsRes = null;
      }

      if (monthsRes && !monthsRes.ok) throw new Error('Months webhook failed');

      const formNotificationPayload = {
        source: 'forlangning',
        submitted_at: new Date().toISOString(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        current_expires_at: offer.currentExpiresAt || 'Ej registrerat',
        new_expires_at: offer.newExpiresAt,
        billing_starts_at: offer.billingStartsAt,
        months_extended: `${roundedMonthsExtended} månader`,
        month_count: String(offer.monthCount),
        total_price: String(offer.totalPrice),
        payment_method: form.payment,
        wellness_portal: isPortalRequired ? form.portal : '',
        campaign_year: String(offer.campaignYear),
      };

      try {
        const notificationRes = await fetch('/api/form-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formNotificationPayload),
        });
        if (!notificationRes.ok) {
          console.warn('Forlangning notification non-200:', notificationRes.status);
        }
      } catch (notificationErr) {
        console.warn('Forlangning notification error:', notificationErr);
      }

      navigate('/tack-forlangning', {
        state: {
          fullName: payload.name,
          email: payload.email,
          paymentMethod: payload.payment_method,
          portal: payload.wellness_portal,
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

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-16 pt-20 md:pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 animate-fade-in space-y-5">
        <div className="bg-[#E8F1D5]/85 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-[#E6E1D8] shadow-2xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#8A8177] mb-4">
            <Sparkles className="w-4 h-4 text-[#a0c81d]" />
            Förlängning
            <span className="ml-auto text-[#6B6158] tracking-[0.14em]">
              Steg {step === 'intro' ? '1' : step === 'offer' ? '2' : '3'} av 3
            </span>
          </div>

          {step === 'intro' && (
            <div className="space-y-4">
              <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">Hej {displayName}, säkra din plats året ut.</h1>
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
                    className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-2.5 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                    placeholder="Förnamn"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Efternamn</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-2.5 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
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
                  className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-2.5 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                  placeholder="E-postadress"
                />
              </div>

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
                        name="payment"
                        value={option}
                        checked={form.payment === option}
                        onChange={() => setForm((prev) => ({ ...prev, payment: option, portal: '' }))}
                        className="accent-[#a0c81d]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {isPortalRequired && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Friskvårdsportal</label>
                  <select
                    value={form.portal}
                    onChange={(e) => setForm((prev) => ({ ...prev, portal: e.target.value }))}
                    className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-2.5 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                  >
                    <option value="">Välj portal</option>
                    {PORTAL_OPTIONS.map((portal) => (
                      <option key={portal} value={portal}>{portal}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
                  <div>Betalning: {form.payment}</div>
                  <div>{isPortalRequired ? `Portal: ${form.portal}` : 'Portal: —'}</div>
                </div>

                <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3 text-sm text-[#6B6158]">
                  <div className="font-black text-[#3D3D3D]">Förlängningen registreras direkt när du bekräftar.</div>
                  <div className="mt-1">Betalningen hanteras separat med dig av teamet efter att förlängningen skickats in.</div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('offer');
                  }}
                  className="px-5 py-3 rounded-xl bg-white/70 border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:bg-white transition"
                >
                  Tillbaka
                </button>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {status === 'sending' ? 'Registrerar...' : 'Bekräfta förlängning'}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-[#E6E1D8] bg-white/70 px-4 py-3 text-sm text-[#6B6158] flex items-start gap-2">
          <CreditCard className="w-4 h-4 mt-0.5 text-[#6B6158]" />
          <span>
            Har du frågor om betalning eller erbjudandet? <Link to="/support" className="font-black text-[#3D3D3D] hover:text-[#5C7A12]">Kontakta support</Link>.
          </span>
        </div>
      </div>
    </div>
  );
};
