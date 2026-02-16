import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, LogOut, Mail, Settings, Trash2, Loader2,
  FileText, FileDown, Plus, Clock, RefreshCw, CreditCard
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { databaseService } from '../services/databaseService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateWeeklySchedulePDF } from '../utils/pdfGenerator';
import { generateFullWeeklyDetails } from '../services/geminiService';
import { createPortalSession } from '../services/stripeService';

type MainTab = 'WEEKLY_PLANS' | 'SETTINGS';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile: user, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState<MainTab>('WEEKLY_PLANS');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const { data: weeklyPlans = [] } = useQuery({
    queryKey: ['weeklyPlans', user?.id],
    queryFn: () => user ? databaseService.getSavedPlans(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => databaseService.deleteWeeklyPlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyPlans'] })
  });

  if (!user || !session) return null;

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

  const handleOpenBillingPortal = async () => {
    setIsPortalLoading(true);
    try {
      const url = await createPortalSession({ returnPath: '/profile' });
      window.location.href = url;
    } catch (err) {
      alert('Kunde inte öppna Stripe. Försök igen.');
    } finally {
      setIsPortalLoading(false);
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
          ? 'bg-[#1e293b] text-white shadow-[0_0_20px_rgba(160,200,29,0.1)] border border-[#a0c81d]/40 translate-x-1' 
          : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-white border border-transparent'}`
      }
    >
      <div className={`p-2 rounded-xl transition-all ${activeTab === id ? 'bg-[#a0c81d] text-[#0f172a] shadow-[0_0_10px_#a0c81d]' : 'bg-[#0f172a] text-slate-500 group-hover:text-slate-300'}`}>
         <Icon className="w-4 h-4" />
      </div>
      <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
      {activeTab === id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#a0c81d] shadow-[0_0_10px_#a0c81d]"></div>}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-[#1e293b]/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-white/5 shadow-2xl mb-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-[#0f172a] flex items-center justify-center border-2 border-white/5 group-hover:border-[#a0c81d]/50 transition-all duration-500 shadow-2xl overflow-hidden">
                <span className="text-4xl font-black text-[#a0c81d]">{user.email?.charAt(0).toUpperCase()}</span>
                <div className="absolute inset-0 bg-gradient-to-tr from-[#a0c81d]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-black text-white font-heading tracking-tight mb-1">{user.full_name || 'Användare'}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
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
            <div className="bg-[#1e293b]/60 backdrop-blur-md rounded-[2rem] p-4 border border-white/5 shadow-xl sticky top-28">
              <NavButton id="WEEKLY_PLANS" label="Veckomenyer" icon={FileText} />
              <NavButton id="SETTINGS" label="Säkerhet" icon={Settings} />
            </div>
          </div>

          <div className="lg:col-span-9 min-h-[600px]">
            {activeTab === 'WEEKLY_PLANS' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-[#1e293b] rounded-[2.5rem] p-8 md:p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-purple-400" /> Veckomeny-arkiv
                      </h2>
                      <p className="text-slate-400 text-sm font-medium">Här sparas alla dina genererade planer.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['weeklyPlans'] })}
                        className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                        title="Uppdatera"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <Link to="/recept" className="bg-[#a0c81d] text-[#0f172a] px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#b5e02e] transition-all flex items-center gap-2 shadow-lg shadow-[#a0c81d]/20">
                        <Plus className="w-4 h-4" /> Ny Plan
                      </Link>
                    </div>
                  </div>

                  <div className="mt-12 space-y-4">
                    {weeklyPlans.length === 0 ? (
                      <div className="text-center py-24 bg-[#0f172a]/30 rounded-[2.5rem] border-2 border-dashed border-white/5">
                        <Clock className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Inga sparade planer ännu</h3>
                        <p className="text-slate-500 text-sm">Om du precis skapat en plan, klicka Uppdatera.</p>
                      </div>
                    ) : (
                      weeklyPlans.map((plan: any) => (
                        <div key={plan.id} className="bg-[#0f172a]/80 backdrop-blur-md rounded-[2rem] border border-white/5 p-6 hover:border-purple-500/40 transition-all group flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                            <div className="bg-purple-500/10 p-4 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-white group-hover:text-purple-300 transition-colors">{plan.title || 'Namnlös Vecka'}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> {new Date(plan.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto">
                            <button 
                              onClick={() => handleDownloadSavedPlanPdf(plan)}
                              disabled={isDownloadingPdf === plan.id}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-[#0f172a] px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-[#a0c81d] active:scale-95 shadow-xl"
                            >
                              {isDownloadingPdf === plan.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Förbereder...</>
                              ) : (
                                <><FileDown className="w-4 h-4" /> Ladda ner PDF</>
                              )}
                            </button>
                            <button 
                              onClick={() => { if(window.confirm('Ta bort denna plan?')) deletePlanMutation.mutate(plan.id); }}
                              className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
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
                <div className="bg-[#1e293b] rounded-[2.5rem] p-8 md:p-10 border border-white/5 shadow-2xl min-h-[400px]">
                  <div className="border-b border-white/5 pb-8 mb-10">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3">
                      <Settings className="w-8 h-8 text-slate-400" /> Konto & Säkerhet
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Inloggad som</label>
                        <div className="p-5 bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-2xl text-slate-200 font-bold text-sm flex items-center gap-4 shadow-xl">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><User className="w-5 h-5" /></div>
                          {user.email}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Medlemskap & Betalning</label>
                        <div className="p-5 bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-2xl text-slate-200 shadow-xl space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                <CreditCard className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">
                                  {user.membership_level === 'premium' ? 'Premium aktiv' : 'Gratis'}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  Hantera betalmetod, fakturor och uppsägning.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleOpenBillingPortal}
                              disabled={isPortalLoading}
                              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
                            >
                              {isPortalLoading ? 'Öppnar...' : 'Hantera'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Byt Lösenord</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minst 6 tecken"
                          className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                        />
                      </div>
                      <button
                        onClick={handleUpdatePassword}
                        disabled={passwordStatus === 'loading' || newPassword.length < 6}
                        className="w-full py-4 rounded-xl bg-[#a0c81d] text-[#0f172a] font-black uppercase tracking-widest text-xs hover:bg-[#b5e02e] transition-all disabled:opacity-50"
                      >
                        {passwordStatus === 'loading' ? 'Uppdaterar...' : passwordStatus === 'success' ? 'Uppdaterat' : 'Uppdatera lösenord'}
                      </button>
                      {passwordStatus === 'error' && (
                        <p className="text-xs text-red-400 font-bold">Kunde inte uppdatera lösenordet.</p>
                      )}
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
