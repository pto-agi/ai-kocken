import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Wallet
} from 'lucide-react';

const PLAN_OPTIONS = [
  {
    id: '3',
    label: '3 månader',
    price: '1795 kr',
    discounted: '1495:-',
    highlight: false
  },
  {
    id: '6',
    label: '6 månader',
    price: '3960 kr',
    discounted: '1995:-',
    highlight: false
  },
  {
    id: '12',
    label: '12 månader',
    price: '7920 kr',
    discounted: '2995:-',
    highlight: true,
    tag: 'Rekommenderas'
  }
];

const PAYMENT_OPTIONS = [
  'Jag betalar via friskvårdsportal',
  'Faktura utan extra avgifter',
  'Swish (123 003 73 17)',
  'Delbetalning'
];

const PORTAL_OPTIONS = [
  'Benify / Benifex',
  'Epassi',
  'Benefits',
  'Wellnet',
  'Söderberg & Partners',
  'Edenred'
];

const FRISKVARD_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/uc9x2zz/';
const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  '3': 'https://betalning.privatetrainingonline.se/b/3cIfZg8s37dt9mK8ITcfK0w?locale=sv',
  '6': 'https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv',
  '12': 'https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv'
};

const buildStripeLink = (baseUrl: string, email: string) => {
  try {
    const url = new URL(baseUrl);
    if (email) url.searchParams.set('prefilled_email', email);
    return url.toString();
  } catch (err) {
    console.warn('Invalid Stripe payment link URL', err);
    return baseUrl;
  }
};

export const Forlangning: React.FC = () => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    plan: '',
    payment: '',
    portal: ''
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isPortalRequired = form.payment === 'Jag betalar via friskvårdsportal';

  const selectedPlan = useMemo(() => PLAN_OPTIONS.find((p) => p.id === form.plan), [form.plan]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('Fyll i namn och e-post.');
      setStatus('error');
      return;
    }

    if (!form.plan) {
      setError('Välj hur många månader du vill förlänga med.');
      setStatus('error');
      return;
    }

    if (!form.payment) {
      setError('Välj betalningsalternativ.');
      setStatus('error');
      return;
    }

    if (isPortalRequired && !form.portal) {
      setError('Välj friskvårdsportal.');
      setStatus('error');
      return;
    }

    setStatus('sending');

    if (!isPortalRequired) {
      const stripeBaseUrl = STRIPE_PAYMENT_LINKS[form.plan];
      if (!stripeBaseUrl) {
        setStatus('error');
        setError('Kunde inte hitta betalningslänk för vald period.');
        return;
      }

      const redirectUrl = buildStripeLink(stripeBaseUrl, form.email.trim());
      window.location.href = redirectUrl;
      return;
    }

    try {
      const payload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        extension_months: selectedPlan?.label || form.plan,
        payment_method: form.payment,
        wellness_portal: isPortalRequired ? form.portal : '',
        source: 'forlangning'
      };

      let res: Response | null = null;
      try {
        res = await fetch(FRISKVARD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        // Likely CORS/network; retry with no-cors to still deliver to Zapier
        console.warn('Webhook primary failed, retrying no-cors:', err);
        await fetch(FRISKVARD_WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });
        res = null;
      }

      if (res && !res.ok) throw new Error('Webhook failed');

      setStatus('success');
      setForm({ firstName: '', lastName: '', email: '', plan: '', payment: '', portal: '' });
    } catch (err) {
      console.error('Forlangning webhook error:', err);
      setStatus('error');
      setError('Kunde inte skicka förlängningen. Försök igen.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.8rem] p-8 md:p-12 border border-[#E6E1D8] shadow-2xl mb-12 overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-[320px] h-[320px] bg-[#a0c81d]/10 rounded-full blur-[120px]"></div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
              <Sparkles className="w-3 h-3 text-[#a0c81d]" /> Klienterbjudande
            </div>
            <h1 className="mt-6 text-3xl md:text-5xl font-black text-[#3D3D3D] font-heading tracking-tight">
              Förläng ditt medlemskap till exklusiva priser
            </h1>
            <p className="mt-4 text-[#6B6158] text-sm md:text-base font-medium max-w-2xl">
              Passa på att förlänga ditt medlemskap innan utgångsdatumet för att kunna nyttja dina unika klientpriser.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#6B6158]">
              {[
                'Upp till 70% förlängningsrabatt med priser som bättre än vad som erbjuds någon annan stans.',
                'Betalning med friskvårdsbidrag.',
                'Månader som adderas på ditt redan befintliga medlemskap.',
                'Garanterat bättre priser.'
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#a0c81d] mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {PLAN_OPTIONS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, plan: plan.id }))}
              aria-pressed={form.plan === plan.id}
              className={`relative text-left rounded-[2rem] border p-6 md:p-8 shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#a0c81d]/40 ${
                form.plan === plan.id
                  ? 'border-[#a0c81d] bg-[#E8F1D5] shadow-[0_20px_60px_rgba(160,200,29,0.2)]'
                  : plan.highlight
                    ? 'border-[#a0c81d]/60 bg-[#E8F1D5] shadow-[0_20px_60px_rgba(160,200,29,0.18)]'
                    : 'border-[#E6E1D8] bg-[#eadfd9]/80'
              }`}
            >
              {(plan.highlight || form.plan === plan.id) && (
                <div className={`absolute top-5 right-5 rounded-full text-[10px] font-black uppercase tracking-widest px-3 py-1 ${
                  form.plan === plan.id
                    ? 'bg-[#3D3D3D] text-[#F6F1E7]'
                    : 'bg-[#a0c81d] text-[#F6F1E7]'
                }`}>
                  {form.plan === plan.id ? 'Vald' : plan.tag}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#6B6158]">
                <BadgePercent className="w-4 h-4 text-[#a0c81d]" /> Förlängning
              </div>
              <h3 className="mt-4 text-2xl font-black text-[#3D3D3D]">{plan.label}</h3>
              <div className="mt-3 text-[#6B6158] text-sm">Ordinarie: <span className="line-through">{plan.price}</span></div>
              <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{plan.discounted}</div>
              <p className="mt-3 text-xs text-[#6B6158]">Månader som adderas direkt på din nuvarande period.</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 border border-[#E6E1D8] shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Betalningsalternativ</p>
                <h2 className="text-2xl font-black text-[#3D3D3D]">Välj det som passar dig</h2>
              </div>
            </div>

            <div className="space-y-4 text-sm text-[#6B6158]">
              {[
                'Betala med ditt friskvårdsbidrag',
                'Månaderna adderas ovanpå ditt aktiva medlemskap',
                'Faktura utan extra kostnad',
                'Swish (123 003 73 17)',
                'Delbetalning',
                'Du kan pausa när som helst – månaderna sparas'
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-[#6B6158] mt-0.5" />
                <span>Alla priser är klientpriser och gäller endast befintliga medlemmar.</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#E6E1D8] bg-white/70 p-5 text-sm text-[#6B6158] space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#8A8177]">Mer info om friskvårdsportal</p>
              <p>
                Betala hela beloppet direkt via din friskvårdsportal. Efter att du skickat in förlängningen
                går du in i portalen, söker efter <strong>Private Training Online</strong> och genomför betalningen där.
              </p>
              <p>
                Vill du delbetala? Använd friskvårdsbidraget i portalen så skickar vi faktura utan extra kostnad
                på mellanskillnaden.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 border border-[#E6E1D8] shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Förlängning</p>
                <h2 className="text-2xl font-black text-[#3D3D3D]">Skicka in din förlängning</h2>
              </div>
              <span className="text-[10px] font-bold text-[#8A8177]">"*" anger obligatoriska fält</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Förnamn *</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                  placeholder="Förnamn"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Efternamn *</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                  placeholder="Efternamn"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">E-postadress *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                placeholder="E-postadress"
                required
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Jag vill förlänga med *</p>
              <div className="grid grid-cols-1 gap-3">
                {PLAN_OPTIONS.map((plan) => (
                  <label key={plan.id} className={`flex items-center justify-between gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    form.plan === plan.id ? 'border-[#a0c81d]/60 bg-[#F6F1E7]' : 'border-[#E6E1D8] bg-[#F6F1E7]/60 hover:border-[#E6E1D8]'
                  }`}>
                    <div>
                      <p className="font-bold text-[#3D3D3D]">{plan.label}</p>
                      <p className="text-xs text-[#6B6158]">{plan.price} ({plan.discounted})</p>
                    </div>
                    <input
                      type="radio"
                      name="plan"
                      value={plan.id}
                      checked={form.plan === plan.id}
                      onChange={() => setForm((prev) => ({ ...prev, plan: plan.id }))}
                      className="accent-[#a0c81d]"
                      required
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Hur vill du betala för din förlängning? *</p>
              <div className="grid grid-cols-1 gap-3">
                {PAYMENT_OPTIONS.map((option) => (
                  <label key={option} className={`flex items-center justify-between gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    form.payment === option ? 'border-[#a0c81d]/60 bg-[#F6F1E7]' : 'border-[#E6E1D8] bg-[#F6F1E7]/60 hover:border-[#E6E1D8]'
                  }`}>
                    <span className="text-sm text-[#3D3D3D]">{option}</span>
                    <input
                      type="radio"
                      name="payment"
                      value={option}
                      checked={form.payment === option}
                      onChange={() => setForm((prev) => ({ ...prev, payment: option }))}
                      className="accent-[#a0c81d]"
                      required
                    />
                  </label>
                ))}
              </div>
            </div>

            {isPortalRequired && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Ange friskvårdsportal *</label>
                <select
                  value={form.portal}
                  onChange={(e) => setForm((prev) => ({ ...prev, portal: e.target.value }))}
                  className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                  required={isPortalRequired}
                >
                  <option value="">Välj portal</option>
                  {PORTAL_OPTIONS.map((portal) => (
                    <option key={portal} value={portal}>{portal}</option>
                  ))}
                </select>
              </div>
            )}

            {status === 'success' && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Tack! Din förlängning är skickad. Vi återkommer med nästa steg.
              </div>
            )}

            {status === 'error' && error && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {!isPortalRequired && (
              <p className="text-[11px] text-[#8A8177] leading-relaxed">
                Vid kort, Swish, faktura eller delbetalning skickas du vidare till säker betalning hos Stripe.
                Där kan du betala med Klarna, Apple Pay, kort eller Swish.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#a0c81d] text-[#F6F1E7] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#5C7A12] disabled:opacity-70"
            >
              {status === 'sending' ? 'Skickar...' : 'Skicka förlängning'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
