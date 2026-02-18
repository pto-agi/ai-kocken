import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  User, LogOut, Mail, Settings, Trash2, Loader2,
  FileText, FileDown, Plus, Clock, RefreshCw,
  LayoutDashboard, ArrowRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { databaseService } from '../services/databaseService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateWeeklySchedulePDF } from '../utils/pdfGenerator';
import { generateFullWeeklyDetails } from '../services/geminiService';

type MainTab = 'OVERVIEW' | 'PLANS' | 'SETTINGS';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile: user, signOut, refreshProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<MainTab>('OVERVIEW');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const queryClient = useQueryClient();

  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [addressStatus, setAddressStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Sverige');
  const [phone, setPhone] = useState('');

  const { data: weeklyPlans = [] } = useQuery({
    queryKey: ['weeklyPlans', user?.id],
    queryFn: () => user ? databaseService.getSavedPlans(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: latestUppfoljning } = useQuery({
    queryKey: ['latestUppfoljning', user?.id],
    queryFn: () => user ? databaseService.getLatestUppfoljning(user.id) : Promise.resolve(null),
    enabled: !!user,
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => databaseService.deleteWeeklyPlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyPlans'] })
  });

  if (!user || !session) return null;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'settings') {
      setActiveTab('SETTINGS');
    }
  }, [location.search]);

  useEffect(() => {
    setAddressLine1(user.address_line1 || '');
    setAddressLine2(user.address_line2 || '');
    setPostalCode(user.postal_code || '');
    setCity(user.city || '');
    setCountry(user.country || 'Sverige');
    setPhone(user.phone || '');
  }, [user.address_line1, user.address_line2, user.postal_code, user.city, user.country, user.phone]);

  const handleCancelSubscription = async () => {
    if (isCancelling) return;
    setCancelStatus('idle');
    setIsCancelling(true);
    try {
      const payload = {
        user_id: user.id,
        email: user.email,
        stripe_email: user.email,
        name: user.full_name || '',
        membership_level: user.membership_level || '',
        requested_at: new Date().toISOString(),
        source: 'cancel_premium'
      };

      const body = new URLSearchParams(
        Object.entries(payload).map(([key, value]) => [key, String(value ?? '')])
      ).toString();

      let res: Response | null = null;
      try {
        res = await fetch('https://hooks.zapier.com/hooks/catch/1514319/uc2m2ex/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
      } catch (err) {
        console.warn('Cancel webhook primary failed, retrying no-cors:', err);
        await fetch('https://hooks.zapier.com/hooks/catch/1514319/uc2m2ex/', {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body
        });
        res = null;
      }

      if (res && !res.ok) throw new Error('Webhook failed');
      setCancelStatus('success');
    } catch (err) {
      console.error('Cancel subscription webhook error:', err);
      setCancelStatus('error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return;
    setPasswordStatus('loading');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordStatus('success');
      setNewPassword('');
      setTimeout(() => setPasswordStatus('idle'), 3000);
    } catch (err) {
      console.error('Password Update Error:', err);
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
    }
  };

  const handleSaveAddress = async () => {
    setAddressStatus('loading');
    try {
      const payload = {
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim(),
        postal_code: postalCode.trim(),
        city: city.trim(),
        country: country.trim() || 'Sverige',
        phone: phone.trim()
      };
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);
      if (error) throw error;
      setAddressStatus('success');
      refreshProfile();
      setTimeout(() => setAddressStatus('idle'), 3000);
    } catch (err) {
      console.error('Address update error:', err);
      setAddressStatus('error');
      setTimeout(() => setAddressStatus('idle'), 3000);
    }
  };

  const handleDownloadSavedPlanPdf = async (plan: any) => {
    setIsDownloadingPdf(plan.id);
    try {
      const targets = { 
        kcal: user.biometrics?.results?.targetCalories || 2200,
        p: user.biometrics?.data?.macroSplit?.protein || 35,
        c: user.biometrics?.data?.macroSplit?.carbs || 35,
        f: user.biometrics?.data?.macroSplit?.fats || 30
      };
      const detailedPlan = await generateFullWeeklyDetails(plan.plan_data, targets);
      generateWeeklySchedulePDF(detailedPlan, targets);
    } catch (e) {
      alert('Kunde inte generera PDF.');
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  const NavButton = ({ id, label, icon: Icon }: { id: MainTab, label: string, icon: any }) => (
    <button
      onClick={() => { setActiveTab(id); window.scrollTo({top: 0, behavior: 'smooth'}); }}
      className={
        `relative flex items-center justify-start gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 outline-none w-full group
        ${activeTab === id 
          ? 'bg-[#E8F1D5] text-[#3D3D3D] shadow-[0_0_20px_rgba(160,200,29,0.12)] border border-[#a0c81d]/40 translate-x-1' 
          : 'text-[#6B6158] hover:bg-[#E8F1D5]/50 hover:text-[#3D3D3D] border border-transparent'}`
      }
    >
      <div className={`p-2 rounded-xl transition-all ${activeTab === id ? 'bg-[#a0c81d] text-[#F6F1E7] shadow-[0_0_10px_#a0c81d]' : 'bg-[#F6F1E7] text-[#8A8177] group-hover:text-[#6B6158]'}`}>
         <Icon className="w-4 h-4" />
      </div>
      <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
      {activeTab === id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#a0c81d] shadow-[0_0_10px_#a0c81d]"></div>}
    </button>
  );

  const formatDate = (value?: string | null) => {
    if (!value) return 'Ej inskickad';
    return new Date(value).toLocaleDateString('sv-SE');
  };

  const uppStatus = latestUppfoljning
    ? (latestUppfoljning.is_done ? 'Genomförd' : 'Pågående')
    : 'Ej inskickad';

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-[#E6E1D8] shadow-2xl mb-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-[#F6F1E7] flex items-center justify-center border-2 border-[#E6E1D8] group-hover:border-[#a0c81d]/50 transition-all duration-500 shadow-2xl overflow-hidden">
                <span className="text-4xl font-black text-[#a0c81d]">{user.email?.charAt(0).toUpperCase()}</span>
                <div className="absolute inset-0 bg-gradient-to-tr from-[#a0c81d]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] font-heading tracking-tight mb-1">{user.full_name || 'Användare'}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {user.email}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={async () => { await signOut(); navigate('/'); }}
            className="flex items-center gap-3 text-red-400 hover:bg-red-500/10 px-4 py-3 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            Logga ut
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-[#E8F1D5]/60 backdrop-blur-md rounded-[2rem] p-4 border border-[#E6E1D8] shadow-xl sticky top-28">
              <NavButton id="OVERVIEW" label="Översikt" icon={LayoutDashboard} />
              <NavButton id="PLANS" label="Veckomenyer" icon={FileText} />
              <NavButton id="SETTINGS" label="Mina uppgifter" icon={Settings} />
            </div>
          </div>

          <div className="lg:col-span-9 min-h-[600px]">
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-[#E8F1D5] rounded-[2.5rem] p-8 md:p-10 border border-[#E6E1D8] shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-[220px] h-[220px] bg-[#a0c81d]/10 rounded-full blur-[90px]"></div>
                  <div className="relative z-10 flex flex-col gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Medlemskap</p>
                      <h3 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">Dina prenumerationer</h3>
                      <p className="text-[#6B6158] text-sm font-medium mt-2 max-w-2xl">
                        Här hittar du alla aktiva prenumerationer kopplade till ditt konto. Fler produkter kan läggas till framöver.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-6 flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">App‑prenumeration</p>
                            <h4 className="text-lg md:text-xl font-black text-[#3D3D3D]">PTO Ai Premium</h4>
                            <p className="text-[#6B6158] text-sm mt-2">
                              Full tillgång till kost, recept, veckomenyer och uppföljning.
                            </p>
                          </div>
                          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            user.membership_level === 'premium'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-[#ffffff]/70 text-[#6B6158] border-[#E6E1D8]'
                          }`}>
                            {user.membership_level === 'premium' ? 'Aktiv' : 'Inte aktiv'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#6B6158]">
                          {[
                            'AI‑recept och veckomenyer utan begränsningar',
                            'Automatisk inköpslista och kostschema',
                            'Spara planer och följ utveckling i Mina sidor',
                            'Prioriterad tillgång till nya funktioner'
                          ].map((text) => (
                            <div key={text} className="flex items-start gap-3">
                              <span className="mt-1 w-2 h-2 rounded-full bg-[#a0c81d]"></span>
                              <span>{text}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-[#E6E1D8]">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                            {user.membership_level === 'premium'
                              ? 'Premium är aktivt på ditt konto'
                              : 'Ingen aktiv prenumeration hittades'}
                          </div>
                          <div className="flex items-center gap-3">
                            {cancelStatus === 'success' && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                                Begäran skickad
                              </span>
                            )}
                            {cancelStatus === 'error' && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">
                                Kunde inte skicka
                              </span>
                            )}
                            {user.membership_level === 'premium' ? (
                              <button
                                onClick={handleCancelSubscription}
                                disabled={isCancelling}
                                className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#E6E1D8] transition-all disabled:opacity-60"
                              >
                                {isCancelling ? 'Skickar...' : 'Avsluta prenumeration'}
                              </button>
                            ) : (
                              <a
                                href="https://betalning.privatetrainingonline.se/b/cNi00i4bN9lBaqO4sDcfK0v?locale=sv"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#E6E1D8] transition-all"
                              >
                                Aktivera Premium
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-[#E8F1D5] rounded-[2.5rem] p-6 md:p-8 border border-[#E6E1D8] shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-16 -right-10 w-[240px] h-[240px] bg-emerald-500/10 rounded-full blur-[90px]"></div>
                    <div className="relative z-10 flex flex-col items-start justify-between gap-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Uppföljning</p>
                        <h3 className="text-xl md:text-2xl font-black text-[#3D3D3D] flex items-center gap-3">
                          Senast inskickad
                        </h3>
                        <p className="text-[#6B6158] text-sm font-medium mt-2">
                          {formatDate(latestUppfoljning?.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-3">
                        <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          uppStatus === 'Genomförd'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : uppStatus === 'Pågående'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-[#ffffff]/70 text-[#6B6158] border-[#E6E1D8]'
                        }`}>
                          {uppStatus}
                        </span>
                        {uppStatus === 'Genomförd' && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                            Klarmarkerad {formatDate(latestUppfoljning?.done_at)}
                          </span>
                        )}
                        <Link
                          to="/uppfoljning"
                          className="px-5 py-2.5 rounded-xl bg-[#ffffff]/70 border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:bg-[#a0c81d]/20 hover:border-[#a0c81d]/40 transition"
                        >
                          Skicka uppföljning
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#E8F1D5] rounded-[2.5rem] p-6 md:p-8 border border-[#E6E1D8] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-[-20%] right-[-10%] w-[280px] h-[280px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                    <div className="relative z-10 flex flex-col gap-6 h-full">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Veckomenyer</p>
                        <h3 className="text-xl md:text-2xl font-black text-[#3D3D3D]">Senaste planer</h3>
                        <p className="text-[#6B6158] text-sm font-medium mt-2">
                          {weeklyPlans.length === 0 ? 'Inga sparade planer ännu.' : `Du har ${weeklyPlans.length} sparade planer.`}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {weeklyPlans.slice(0, 3).map((plan: any) => (
                          <div key={plan.id} className="flex items-center justify-between rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 px-4 py-3">
                            <div>
                              <p className="text-sm font-bold text-[#3D3D3D]">{plan.title || 'Namnlös Vecka'}</p>
                              <p className="text-[10px] text-[#8A8177] font-bold uppercase tracking-widest mt-1">
                                {new Date(plan.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDownloadSavedPlanPdf(plan)}
                              disabled={isDownloadingPdf === plan.id}
                              className="text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition-all"
                            >
                              {isDownloadingPdf === plan.id ? 'Förbereder...' : 'PDF'}
                            </button>
                          </div>
                        ))}
                        {weeklyPlans.length === 0 && (
                          <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 px-4 py-4 text-sm text-[#8A8177]">
                            Skapa en ny plan för att se den här.
                          </div>
                        )}
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <Link to="/recept" className="text-[10px] font-black uppercase tracking-widest text-[#a0c81d]">
                          Skapa ny plan
                        </Link>
                        <button
                          onClick={() => setActiveTab('PLANS')}
                          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition-all"
                        >
                          Visa alla
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'PLANS' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-[#E8F1D5] rounded-[2.5rem] p-8 md:p-10 border border-[#E6E1D8] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div>
                      <h2 className="text-3xl font-black text-[#3D3D3D] uppercase tracking-tight mb-2 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-purple-400" /> Veckomeny-arkiv
                      </h2>
                      <p className="text-[#6B6158] text-sm font-medium">Här sparas alla dina genererade planer.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['weeklyPlans'] })}
                        className="p-3 text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/70 rounded-xl transition-all"
                        title="Uppdatera"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <Link to="/recept" className="bg-[#a0c81d] text-[#F6F1E7] px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition-all flex items-center gap-2 shadow-lg shadow-[#a0c81d]/20">
                        <Plus className="w-4 h-4" /> Ny Plan
                      </Link>
                    </div>
                  </div>

                  <div className="mt-12 space-y-4">
                    {weeklyPlans.length === 0 ? (
                      <div className="text-center py-24 bg-[#F6F1E7]/30 rounded-[2.5rem] border-2 border-dashed border-[#E6E1D8]">
                        <Clock className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-[#3D3D3D] mb-2">Inga sparade planer ännu</h3>
                        <p className="text-[#8A8177] text-sm">Om du precis skapat en plan, klicka Uppdatera.</p>
                      </div>
                    ) : (
                      weeklyPlans.map((plan: any) => (
                        <div key={plan.id} className="bg-[#F6F1E7]/80 backdrop-blur-md rounded-[2rem] border border-[#E6E1D8] p-6 hover:border-purple-500/40 transition-all group flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                            <div className="bg-purple-500/10 p-4 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-[#3D3D3D] group-hover:text-purple-300 transition-colors">{plan.title || 'Namnlös Vecka'}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> {new Date(plan.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto">
                            <button 
                              onClick={() => handleDownloadSavedPlanPdf(plan)}
                              disabled={isDownloadingPdf === plan.id}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-[#F6F1E7] px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-[#a0c81d] active:scale-95 shadow-xl"
                            >
                              {isDownloadingPdf === plan.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Förbereder...</>
                              ) : (
                                <><FileDown className="w-4 h-4" /> Ladda ner PDF</>
                              )}
                            </button>
                            <button 
                              onClick={() => { if(window.confirm('Ta bort denna plan?')) deletePlanMutation.mutate(plan.id); }}
                              className="p-3 text-[#8A8177] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'SETTINGS' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-[#E8F1D5] rounded-[2.5rem] p-8 md:p-10 border border-[#E6E1D8] shadow-2xl min-h-[400px]">
                  <div className="border-b border-[#E6E1D8] pb-8 mb-10">
                    <h2 className="text-3xl font-black text-[#3D3D3D] uppercase tracking-tight mb-2 flex items-center gap-3">
                      <Settings className="w-8 h-8 text-[#6B6158]" /> Mina uppgifter
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-4">Inloggad som</label>
                        <div className="p-5 bg-[#F6F1E7]/60 backdrop-blur-md border border-[#E6E1D8] rounded-2xl text-[#3D3D3D] font-bold text-sm flex items-center gap-4 shadow-xl">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><User className="w-5 h-5" /></div>
                          {user.email}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-4">Medlemskap</label>
                        <div className="p-5 bg-[#F6F1E7]/60 backdrop-blur-md border border-[#E6E1D8] rounded-2xl text-[#3D3D3D] shadow-xl space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-[#3D3D3D]">
                                {user.membership_level === 'premium' ? 'Premium aktiv' : 'Gratis'}
                              </p>
                              <p className="text-[11px] text-[#6B6158] font-medium">
                                Behöver du hjälp med medlemskap? Kontakta support.
                              </p>
                            </div>
                            <Link
                              to="/support"
                              className="px-4 py-2 rounded-xl bg-[#ffffff]/80 hover:bg-white/20 border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] transition-all"
                            >
                              Support
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-3">Byt Lösenord</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minst 6 tecken"
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <button
                        onClick={handleUpdatePassword}
                        disabled={passwordStatus === 'loading' || newPassword.length < 6}
                        className="w-full py-4 rounded-xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition-all disabled:opacity-50"
                      >
                        {passwordStatus === 'loading' ? 'Uppdaterar...' : passwordStatus === 'success' ? 'Uppdaterat' : 'Uppdatera lösenord'}
                      </button>
                      {passwordStatus === 'error' && (
                        <p className="text-xs text-red-400 font-bold">Kunde inte uppdatera lösenordet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-12 pt-10 border-t border-[#E6E1D8]">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-[#a0c81d]/10 border border-[#a0c81d]/30 flex items-center justify-center text-[#a0c81d]">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Leverans</p>
                        <h3 className="text-xl font-black text-[#3D3D3D]">Adress & telefon</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block">Adressrad 1</label>
                        <input
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                          placeholder="Gatuadress"
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block">Adressrad 2 (valfritt)</label>
                        <input
                          value={addressLine2}
                          onChange={(e) => setAddressLine2(e.target.value)}
                          placeholder="Lägenhet, portkod m.m."
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block">Postnummer</label>
                        <input
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="123 45"
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block">Stad</label>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Ort"
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block">Land</label>
                        <input
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="Sverige"
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block">Telefon (SMS‑avi)</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+46 7x xxx xx xx"
                          className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-4 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                      <button
                        onClick={handleSaveAddress}
                        disabled={addressStatus === 'loading'}
                        className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition-all disabled:opacity-50"
                      >
                        {addressStatus === 'loading' ? 'Sparar...' : addressStatus === 'success' ? 'Sparat' : 'Spara uppgifter'}
                      </button>
                      {addressStatus === 'error' && (
                        <span className="text-xs text-red-400 font-bold">Kunde inte spara uppgifterna.</span>
                      )}
                      <span className="text-xs text-[#8A8177] font-medium">
                        Leveransuppgifter används vid Shop-beställningar.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
