import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Minus, Plus, ShoppingBasket, Sparkles, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  memberPrice: number;
  tag?: string;
};

const PRODUCTS: Product[] = [
  {
    id: 'klientpaket',
    title: 'Klientpaket',
    description: 'Samtliga kosttillskott som ingår i vårt klientpaket.',
    price: 1375,
    memberPrice: 995,
    tag: 'Mest valt'
  },
  {
    id: 'hydro-pulse',
    title: 'Hydro Pulse',
    description: 'Protein av högsta kvalitet för återhämtning och resultat.',
    price: 399,
    memberPrice: 349
  },
  {
    id: 'bcaa',
    title: 'BCAA',
    description: 'Aminosyror som stödjer återhämtning och muskler.',
    price: 379,
    memberPrice: 349
  },
  {
    id: 'omega-3',
    title: 'Omega 3',
    description: 'Högkvalitativt omega-3 för hjärta och fokus.',
    price: 199,
    memberPrice: 179
  },
  {
    id: 'magnesium',
    title: 'Magnesium',
    description: 'Stödjer återhämtning, sömn och nervsystem.',
    price: 199,
    memberPrice: 179
  },
  {
    id: 'multivitamin',
    title: 'Multivitamin',
    description: 'Dagligt basstöd för viktiga mikronutrienter.',
    price: 199,
    memberPrice: 179
  },
];

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/uc4akmc/';

const Refill: React.FC = () => {
  const { session, profile, refreshProfile } = useAuthStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingAttention, setShippingAttention] = useState(false);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Sverige');
  const [phone, setPhone] = useState('');
  const [addressStatus, setAddressStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const selectedItems = useMemo(() => (
    PRODUCTS.filter((product) => (quantities[product.id] || 0) > 0).map((product) => ({
      id: product.id,
      title: product.title,
      qty: quantities[product.id] || 0,
      price: product.memberPrice
    }))
  ), [quantities]);

  const total = useMemo(() => (
    selectedItems.reduce((sum, item) => sum + item.qty * item.price, 0)
  ), [selectedItems]);

  useEffect(() => {
    setAddressLine1(profile?.address_line1 || '');
    setAddressLine2(profile?.address_line2 || '');
    setPostalCode(profile?.postal_code || '');
    setCity(profile?.city || '');
    setCountry(profile?.country || 'Sverige');
    setPhone(profile?.phone || '');
  }, [profile?.address_line1, profile?.address_line2, profile?.postal_code, profile?.city, profile?.country, profile?.phone]);

  useEffect(() => {
    if (addressStatus === 'success' || addressStatus === 'error') {
      setAddressStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressLine1, addressLine2, postalCode, city, country, phone]);

  const shipping = {
    line1: addressLine1.trim(),
    line2: addressLine2.trim(),
    postalCode: postalCode.trim(),
    city: city.trim(),
    country: country.trim() || 'Sverige',
    phone: phone.trim()
  };

  const profileShipping = {
    line1: profile?.address_line1?.trim() || '',
    line2: profile?.address_line2?.trim() || '',
    postalCode: profile?.postal_code?.trim() || '',
    city: profile?.city?.trim() || '',
    country: profile?.country?.trim() || '',
    phone: profile?.phone?.trim() || ''
  };

  const formPhoneDigits = shipping.phone.replace(/\D/g, '');
  const isFormPhoneValid = formPhoneDigits.length >= 7;

  const profilePhoneDigits = profileShipping.phone.replace(/\D/g, '');
  const isProfilePhoneValid = profilePhoneDigits.length >= 7;

  const hasProfileShipping = Boolean(
    profileShipping.line1 &&
    profileShipping.postalCode &&
    profileShipping.city &&
    profileShipping.country &&
    isProfilePhoneValid
  );

  const hasFormShipping = Boolean(
    shipping.line1 &&
    shipping.postalCode &&
    shipping.city &&
    shipping.country &&
    isFormPhoneValid
  );

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleSaveShipping = async () => {
    if (!session?.user?.id) return;
    setShippingError(null);
    if (!hasFormShipping) {
      setShippingError('Fyll i adress, postnummer, stad, land och ett giltigt telefonnummer.');
      setShippingAttention(true);
      setTimeout(() => setShippingAttention(false), 1400);
      return;
    }
    setAddressStatus('loading');
    try {
      const payload = {
        address_line1: shipping.line1,
        address_line2: shipping.line2,
        postal_code: shipping.postalCode,
        city: shipping.city,
        country: shipping.country,
        phone: shipping.phone
      };
      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', session.user.id);
      if (updateError) throw updateError;
      setAddressStatus('success');
      setShippingError(null);
      refreshProfile();
      setTimeout(() => setAddressStatus('idle'), 2500);
    } catch (err) {
      console.error('Refill address update error:', err);
      setAddressStatus('error');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setShippingError(null);
    setStatus('idle');

    if (!session?.user?.id || !session.user.email) {
      setError('Du behöver vara inloggad för att beställa.');
      setStatus('error');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Välj minst en produkt för att beställa.');
      setStatus('error');
      return;
    }

    if (!hasProfileShipping) {
      setShippingError('Lägg till leveransuppgifter och spara dem innan du beställer.');
      setShippingAttention(true);
      setTimeout(() => setShippingAttention(false), 1400);
      setStatus('error');
      return;
    }

    setStatus('sending');

    const payload = {
      user_id: session.user.id,
      email: session.user.email,
      name: profile?.full_name || '',
      first_name: profile?.full_name?.split(' ')[0] || '',
      last_name: profile?.full_name?.split(' ').slice(1).join(' ') || '',
      membership_level: profile?.membership_level || '',
      item_count: String(selectedItems.reduce((sum, item) => sum + item.qty, 0)),
      subtotal: String(total),
      currency: 'SEK',
      created_at: new Date().toISOString(),
      address_line1: profileShipping.line1,
      address_line2: profileShipping.line2,
      postal_code: profileShipping.postalCode,
      city: profileShipping.city,
      country: profileShipping.country,
      phone: profileShipping.phone,
      items: JSON.stringify(selectedItems),
      total: String(total),
      source: 'refill'
    };

    const body = new URLSearchParams(payload).toString();

    try {
      let res: Response | null = null;
      try {
        res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
      } catch (err) {
        console.warn('Refill webhook primary failed, retrying no-cors:', err);
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body
        });
        res = null;
      }

      if (res && !res.ok) throw new Error('Webhook failed');
      setStatus('success');
      setShippingError(null);
      setQuantities({});
    } catch (err) {
      console.error('Refill webhook error:', err);
      setStatus('error');
      setError('Kunde inte skicka beställningen. Försök igen.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#121a2b]/80 backdrop-blur-xl rounded-[2.8rem] p-8 md:p-12 border border-white/5 shadow-2xl mb-12 overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-[320px] h-[320px] bg-[#a0c81d]/10 rounded-full blur-[120px]"></div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <Sparkles className="w-3 h-3 text-[#a0c81d]" /> Medlemspris
            </div>
            <h1 className="mt-6 text-3xl md:text-5xl font-black text-white font-heading tracking-tight">
              Påfyllning till medlemspris
            </h1>
            <p className="mt-4 text-slate-300 text-sm md:text-base font-medium max-w-2xl">
              Beställ dina favoriter till medlemspris med ett klick. Vi tar hand om resten.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
              {[
                'Snabb beställning utan krångel.',
                'Klientpris och fri frakt.',
                'Leverans hanteras av oss efter beställning.',
                'Du kan lägga flera produkter i samma beställning.'
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#a0c81d] mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRODUCTS.map((product) => (
              <div
                key={product.id}
                className="relative rounded-[2rem] border border-white/5 bg-[#111827]/80 p-6 md:p-8 shadow-xl"
              >
                {product.tag && (
                  <div className="absolute top-5 right-5 rounded-full bg-[#a0c81d] text-[#0f172a] text-[10px] font-black uppercase tracking-widest px-3 py-1">
                    {product.tag}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <ShoppingBasket className="w-4 h-4 text-[#a0c81d]" /> Påfyllning
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">{product.title}</h3>
                <p className="mt-3 text-slate-400 text-sm">{product.description}</p>
                <div className="mt-4 text-slate-500 text-sm">Ordinarie: <span className="line-through">{product.price} kr</span></div>
                <div className="mt-2 text-3xl font-black text-white">{product.memberPrice} kr</div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(product.id, -1)}
                      className="w-9 h-9 rounded-xl bg-[#0f172a] border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition"
                    >
                      <Minus className="w-4 h-4 mx-auto" />
                    </button>
                    <span className="text-lg font-black text-white w-6 text-center">{quantities[product.id] || 0}</span>
                    <button
                      onClick={() => updateQty(product.id, 1)}
                      className="w-9 h-9 rounded-xl bg-[#0f172a] border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition"
                    >
                      <Plus className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                  <button
                    onClick={() => updateQty(product.id, 1)}
                    className="text-[10px] font-black uppercase tracking-widest text-[#a0c81d] hover:text-[#b5e02e] transition"
                  >
                    Lägg till
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#1e293b] rounded-[2.5rem] p-6 md:p-8 border border-white/5 shadow-2xl h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                <ShoppingBasket className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Din beställning</p>
                <h2 className="text-2xl font-black text-white">Sammanfattning</h2>
              </div>
            </div>

            <div className="space-y-3">
              {selectedItems.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0f172a]/60 px-4 py-4 text-sm text-slate-500">
                  Välj produkter till vänster för att bygga din beställning.
                </div>
              ) : (
                selectedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0f172a]/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">{item.title}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Antal: {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-black text-white">{item.qty * item.price} kr</div>
                      <button
                        onClick={() => setQuantities((prev) => ({ ...prev, [item.id]: 0 }))}
                        className="w-7 h-7 rounded-full border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition"
                        aria-label={`Ta bort ${item.title}`}
                      >
                        <X className="w-3 h-3 mx-auto" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 flex items-center justify-between text-sm font-bold text-slate-300">
              <span>Total</span>
              <span className="text-white text-lg">{total} kr</span>
            </div>

            <div className={`mt-6 rounded-2xl border bg-[#0f172a]/60 px-4 py-4 text-sm text-slate-300 ${
              shippingAttention ? 'border-red-400/60 ring-1 ring-red-400/30' : 'border-white/10'
            }`}>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Leveransuppgifter</div>
              {hasProfileShipping ? (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">{profile?.full_name || 'Kund'}</div>
                  <div>{profileShipping.line1}</div>
                  {profileShipping.line2 && <div>{profileShipping.line2}</div>}
                  <div>{profileShipping.postalCode} {profileShipping.city}</div>
                  <div>{profileShipping.country}</div>
                  <div>{profileShipping.phone}</div>
                  <Link
                    to="/profile?tab=settings"
                    className="inline-flex mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition"
                  >
                    Redigera adressuppgifter
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-400 text-sm">
                    Lägg till adress och telefon för att kunna beställa.
                  </p>
                  <div className="space-y-2">
                    <input
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Adressrad 1"
                      className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600"
                    />
                    <input
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="Adressrad 2 (valfritt)"
                      className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="Postnummer"
                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600"
                      />
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Stad"
                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Land"
                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600"
                      />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Telefon (SMS‑avi)"
                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600"
                      />
                      {!isFormPhoneValid && phone && (
                        <p className="text-xs text-red-400 font-bold">Ange ett giltigt telefonnummer.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveShipping}
                      disabled={addressStatus === 'loading'}
                      className="mt-2 w-full rounded-xl bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white py-3 hover:bg-white/20 transition disabled:opacity-60"
                    >
                      {addressStatus === 'loading' ? 'Sparar...' : addressStatus === 'success' ? 'Sparat' : 'Spara uppgifter'}
                    </button>
                    {addressStatus === 'error' && (
                      <p className="text-xs text-red-400 font-bold">Kunde inte spara uppgifterna.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {status === 'success' && (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Tack! Din beställning är skickad.
              </div>
            )}

            {shippingError && (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {shippingError}
              </div>
            )}

            {status === 'error' && error && (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === 'sending' || !hasProfileShipping}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#a0c81d] text-[#0f172a] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#b5e02e] disabled:opacity-70"
            >
              {status === 'sending' ? 'Skickar...' : 'Skicka beställning'}
            </button>

            <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Vi kontaktar dig om leveransdetaljer
            </p>

            <Link
              to="/uppfoljning"
              className="mt-6 inline-flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition"
            >
              Tillbaka till uppföljning
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Refill;
