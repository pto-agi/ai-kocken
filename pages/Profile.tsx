import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation, NavLink } from 'react-router-dom';
import { 
  User, LogOut, Mail, Settings, Trash2, Loader2,
  FileText, FileDown, Plus, Clock, RefreshCw,
  ArrowRight, LayoutDashboard, ClipboardList, CreditCard, Sparkles,
  AlertTriangle, PauseCircle, Ban
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { databaseService } from '../services/databaseService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateWeeklySchedulePDF } from '../utils/pdfGenerator';
import { generateFullWeeklyDetails } from '../services/geminiService';

type MainTab = 'OVERVIEW' | 'PLANS' | 'SUBMISSIONS' | 'MEMBERSHIP' | 'SETTINGS';

type StartSubmission = {
  id: string;
  created_at: string;
  is_done: boolean;
  done_at?: string | null;
  desired_start_date?: string | null;
  goal_description?: string | null;
  focus_areas?: string[] | null;
};

type UppfoljningSubmission = {
  id: string;
  created_at: string;
  is_done: boolean;
  done_at?: string | null;
  summary_feedback?: string | null;
  goal?: string | null;
};

type CombinedSubmission =
  | { kind: 'start'; data: StartSubmission }
  | { kind: 'uppfoljning'; data: UppfoljningSubmission };

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile: user, signOut, refreshProfile, profileError } = useAuthStore();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseStatus, setPauseStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pauseCooldownUntil, setPauseCooldownUntil] = useState<number | null>(null);
  const [isSyncingMembership, setIsSyncingMembership] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const queryClient = useQueryClient();
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});

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

  const { data: startSubmissions = [] } = useQuery({
    queryKey: ['startSubmissions', user?.id],
    queryFn: () => user ? databaseService.getUserStartformular(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: uppSubmissions = [] } = useQuery({
    queryKey: ['uppSubmissions', user?.id],
    queryFn: () => user ? databaseService.getUserUppfoljningar(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => databaseService.deleteWeeklyPlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyPlans'] })
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (!tab) return;
    if (tab === 'settings') {
      navigate('/profile/konto', { replace: true });
      return;
    }
    if (tab === 'membership') {
      navigate('/profile/medlemskap', { replace: true });
      return;
    }
    if (tab === 'submissions') {
      navigate('/profile/inlamningar', { replace: true });
      return;
    }
    if (tab === 'plans') {
      navigate('/profile/veckomenyer', { replace: true });
      return;
    }
    if (tab === 'overview') {
      navigate('/profile', { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!user) return;
    setAddressLine1(user.address_line1 || '');
    setAddressLine2(user.address_line2 || '');
    setPostalCode(user.postal_code || '');
    setCity(user.city || '');
    setCountry(user.country || 'Sverige');
    setPhone(user.phone || '');
    const cooldownKey = `pto_pause_request:${user.id}`;
    const rawCooldown = localStorage.getItem(cooldownKey);
    if (rawCooldown) {
      const parsed = Number(rawCooldown);
      setPauseCooldownUntil(Number.isFinite(parsed) ? parsed : null);
    } else {
      setPauseCooldownUntil(null);
    }
  }, [user?.id, user?.address_line1, user?.address_line2, user?.postal_code, user?.city, user?.country, user?.phone]);

  const handleCancelSubscription = async () => {
    if (!canDeactivateMembership) {
      setCancelStatus('error');
      setCancelMessage('Funktionen lanseras snart.');
      return;
    }
    if (isCancelling) return;
    setCancelStatus('idle');
    setCancelMessage(null);
    setIsCancelling(true);
    try {
      await callMemberAction('deactivate_membership', {
        stripe_email: user.email,
        source: 'deactivate_membership'
      });
      setCancelStatus('success');
    } catch (err) {
      console.error('Cancel subscription webhook error:', err);
      setCancelStatus('error');
      setCancelMessage(err instanceof Error ? err.message : 'Kunde inte skicka.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePauseMembership = async () => {
    const cooldownKey = `pto_pause_request:${user.id}`;
    const now = Date.now();
    if (pauseCooldownUntil && now < pauseCooldownUntil) {
      setPauseStatus('success');
      return;
    }
    if (isPausing) return;
    setPauseStatus('idle');
    setIsPausing(true);
    try {
      await callMemberAction('pause_membership', {
        coaching_expires_at: user.coaching_expires_at || '',
        source: 'pause_membership'
      });
      setPauseStatus('success');
      const until = now + 24 * 60 * 60 * 1000;
      localStorage.setItem(cooldownKey, String(until));
      setPauseCooldownUntil(until);
    } catch (err) {
      console.error('Pause membership webhook error:', err);
      setPauseStatus('error');
    } finally {
      setIsPausing(false);
    }
  };

  const handleManualSyncMembership = async () => {
    if (!session?.access_token || !user?.id) return;
    if (isSyncingMembership) return;
    setSyncStatus('idle');
    setIsSyncingMembership(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`pto_membership_expiry_sync:${user.id}`);
      }

      const response = await fetch('/api/membership-expiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Kunde inte uppdatera status.');
      }

      if (data?.updated) {
        await refreshProfile();
      } else {
        await refreshProfile();
      }

      setSyncStatus('success');
    } catch (err) {
      console.error('Manual membership sync error:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncingMembership(false);
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
    } catch {
      alert('Kunde inte generera PDF.');
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  const ui = {
    page: 'min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-24 pt-16 md:pt-24 px-4 md:px-6 overflow-x-hidden',
    panel: 'bg-[#E8F1D5] rounded-[2.5rem] p-5 md:p-10 border border-[#E6E1D8] shadow-2xl relative overflow-hidden',
    card: 'rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4 md:p-6',
    cardSoft: 'rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 px-3 py-3 md:px-4',
    label: 'text-[11px] font-black uppercase tracking-widest text-[#8A8177]',
    labelTight: 'text-[11px] font-black uppercase tracking-widest text-[#8A8177] mb-2',
    titleLg: 'text-2xl md:text-3xl font-black text-[#3D3D3D]',
    titleMd: 'text-xl md:text-2xl font-black text-[#3D3D3D]',
    body: 'text-[#6B6158] text-[13px] md:text-sm font-medium leading-relaxed',
    primaryBtn: 'px-5 py-2.5 rounded-xl bg-[#a0c81d] border border-[#a0c81d] text-xs font-black uppercase tracking-widest text-[#F6F1E7] hover:bg-[#5C7A12] hover:border-[#5C7A12] transition shadow-lg shadow-[#a0c81d]/20',
    primaryBtnSm: 'px-4 py-2 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C7A12] transition',
    outlineBtn: 'px-4 py-2 rounded-xl bg-white/80 border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:bg-white/40 transition-all',
  };

  const callMemberAction = async (
    actionType: 'pause_membership' | 'deactivate_membership' | 'reactivate_membership',
    extra: Record<string, any> = {}
  ) => {
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const payload = {
      action_type: actionType,
      request_id: requestId,
      user_id: user.id,
      email: user.email,
      name: user.full_name || '',
      membership_level: user.membership_level || '',
      requested_at: new Date().toISOString(),
      ...extra
    };

    const response = await fetch('/api/member-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let message = 'Kunde inte skicka.';
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return response.json().catch(() => ({}));
  };

  const CardHeader = ({
    label,
    title,
    icon: Icon,
    action
  }: {
    label: string;
    title: string;
    icon: any;
    action?: React.ReactNode;
  }) => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white/70 border border-[#E6E1D8] flex items-center justify-center text-[#6B6158] shadow-sm">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={ui.labelTight + ' mb-1'}>{label}</p>
          <h3 className={ui.titleMd}>{title}</h3>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );

  const formatDate = (value?: string | null) => {
    if (!value) return 'Ej inskickad';
    return new Date(value).toLocaleDateString('sv-SE');
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Ej inskickad';
    return new Date(value).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const clampText = (value?: string | null, max: number = 140) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max).trim()}…`;
  };

  const uppStatus = latestUppfoljning
    ? (latestUppfoljning.is_done ? 'Genomförd' : 'Pågående')
    : 'Ej inskickad';

  const toggleSubmission = (key: string) => {
    setExpandedSubmissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const combinedSubmissions: CombinedSubmission[] = [
    ...startSubmissions.map((item: StartSubmission) => ({ kind: 'start' as const, data: item })),
    ...uppSubmissions.map((item: UppfoljningSubmission) => ({ kind: 'uppfoljning' as const, data: item })),
  ].sort((a, b) => {
    const aTime = new Date(a.data.created_at).getTime();
    const bTime = new Date(b.data.created_at).getTime();
    return bTime - aTime;
  });

  const tabItems: { id: MainTab; label: string; path: string; description: string; icon: any }[] = [
    { id: 'OVERVIEW', label: 'Översikt', path: '/profile', description: 'Status och genvägar', icon: LayoutDashboard },
    { id: 'SUBMISSIONS', label: 'Inlämningar', path: '/profile/inlamningar', description: 'Startformulär & uppföljning', icon: ClipboardList },
    { id: 'PLANS', label: 'Veckomenyer', path: '/profile/veckomenyer', description: 'Sparade planer', icon: FileText },
    { id: 'MEMBERSHIP', label: 'Medlemskap', path: '/profile/medlemskap', description: 'Pausa, deaktivera, återaktivera', icon: CreditCard },
    { id: 'SETTINGS', label: 'Konto', path: '/profile/konto', description: 'Uppgifter & säkerhet', icon: Settings }
  ];

  const tabPathById = tabItems.reduce((acc, item) => {
    acc[item.id] = item.path;
    return acc;
  }, {} as Record<MainTab, string>);

  const normalizedPath = location.pathname.endsWith('/') && location.pathname !== '/'
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const activeTab: MainTab = normalizedPath.startsWith('/profile/inlamningar')
    ? 'SUBMISSIONS'
    : normalizedPath.startsWith('/profile/veckomenyer')
      ? 'PLANS'
      : normalizedPath.startsWith('/profile/medlemskap')
        ? 'MEMBERSHIP'
        : normalizedPath.startsWith('/profile/konto')
          ? 'SETTINGS'
          : 'OVERVIEW';

  const activeTabMeta = tabItems.find((item) => item.id === activeTab);

  const navigateToTab = (tab: MainTab) => {
    const target = tabPathById[tab] || '/profile';
    if (normalizedPath !== target) {
      navigate(target);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!session) return null;

  if (!user) {
    return (
      <div className={ui.page}>
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
        </div>
        <div className="max-w-3xl mx-auto relative z-10 animate-fade-in">
          <div className="bg-[#E8F1D5]/70 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-[#E6E1D8] shadow-2xl">
            <p className={ui.labelTight}>Mina sidor</p>
            <h1 className={ui.titleLg}>
              {profileError ? 'Profilen kunde inte laddas' : 'Vi laddar din profil…'}
            </h1>
            <p className={`${ui.body} mt-2`}>
              {profileError
                ? 'Det verkar vara ett serverfel när vi hämtar profilen. Försök igen eller logga ut och in igen.'
                : 'Om sidan fortsätter vara tom, försök uppdatera profilen eller logga ut och in igen.'}
            </p>
            {profileError ? (
              <div className="mt-4 rounded-xl bg-white/70 border border-[#E6E1D8] px-4 py-3 text-xs text-[#6B6158]">
                Fel: <span className="font-bold">{profileError}</span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                onClick={() => refreshProfile()}
                className={ui.primaryBtn}
              >
                Försök igen
              </button>
              <button
                onClick={async () => { await signOut(); navigate('/'); }}
                className={ui.outlineBtn}
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const coachingStatus =
    (typeof user.subscription_status === 'string' && user.subscription_status) ||
    (user.coaching_expires_at ? 'active' : 'inactive');
  const coachingActive = coachingStatus === 'active';
  const pauseCooldownActive = pauseCooldownUntil ? Date.now() < pauseCooldownUntil : false;
  const coachingStatusMeta = {
    active: {
      label: 'Aktiv',
      style: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    },
    paused: {
      label: 'Pausad',
      style: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
    },
    expired: {
      label: 'Avslutas',
      style: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    },
    deactivated: {
      label: 'Deaktiverad',
      style: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
    },
    inactive: {
      label: 'Inte aktiv',
      style: 'bg-white/80 text-[#6B6158] border-[#E6E1D8]',
    },
  } as const;
  const coachingMeta =
    coachingStatusMeta[(coachingStatus as keyof typeof coachingStatusMeta) || 'inactive'] ||
    coachingStatusMeta.inactive;
  const canDeactivateMembership = false; // TODO: enable when webhook for deactivation is live
  const canReactivateMembership = false; // TODO: enable when webhook for reactivation is live
  const sectionTitle = activeTabMeta?.label || 'Översikt';
  const sectionDescription = activeTabMeta?.description || 'Samlad översikt över ditt konto.';

  return (
    <div className={ui.page}>
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-4">
            <div className="bg-[#E8F1D5]/70 backdrop-blur-xl rounded-[2rem] p-4 border border-[#E6E1D8] shadow-xl">
              <p className={ui.labelTight}>Navigering</p>
              <nav className="space-y-2">
                {tabItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      end={item.path === '/profile'}
                      className={({ isActive }) =>
                        `flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all ${
                          isActive
                            ? 'bg-white/90 border-[#a0c81d]/40 text-[#3D3D3D] shadow-md'
                            : 'bg-white/60 border-[#E6E1D8] text-[#6B6158] hover:bg-white/90 hover:border-[#a0c81d]/20'
                        }`
                      }
                    >
                      <span className="mt-0.5 w-9 h-9 rounded-xl bg-[#F6F1E7] border border-[#E6E1D8] flex items-center justify-center text-[#6B6158]">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-[#3D3D3D]">{item.label}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-[#8A8177] mt-1">
                          {item.description}
                        </span>
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="min-w-0">
            {activeTab === 'OVERVIEW' && (
              <div className="bg-[#E8F1D5]/70 backdrop-blur-xl rounded-[2.5rem] p-5 md:p-8 border border-[#E6E1D8] shadow-2xl mb-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={ui.labelTight}>Mina sidor</p>
                        <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">{sectionTitle}</h1>
                        <p className={`${ui.body} mt-2 max-w-xl`}>{sectionDescription}</p>
                      </div>
                      <button 
                        onClick={async () => { await signOut(); navigate('/'); }}
                        className="flex items-center gap-2 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                      >
                        <LogOut className="w-4 h-4" />
                        Logga ut
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F6F1E7] border border-[#E6E1D8] flex items-center justify-center text-[#a0c81d] font-black">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={ui.label}>Data</p>
                        <div className="text-sm font-bold text-[#3D3D3D]">{user.full_name || 'Användare'}</div>
                        <div className="text-xs text-[#6B6158] flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> {user.email}
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="flex-1">
                    <div className="bg-[#F6F1E7]/80 border border-[#E6E1D8] rounded-2xl p-4 h-full flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <p className={ui.label}>Medlemskap</p>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${coachingMeta.style}`}>
                          {coachingMeta.label}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B6158] space-y-1">
                        <div>PTO Coaching</div>
                        <div>
                          Utgångsdatum:{' '}
                          {coachingStatus === 'paused'
                            ? 'Pausat'
                            : coachingStatus === 'deactivated'
                              ? 'Deaktiverad'
                              : coachingStatus === 'expired'
                                ? 'På väg att avslutas'
                                : user.coaching_expires_at
                                  ? formatDate(user.coaching_expires_at)
                                  : 'Ej angivet'}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => navigateToTab('MEMBERSHIP')}
                          className={`${ui.primaryBtnSm} w-full flex items-center justify-center`}
                        >
                          Hantera medlemskap
                        </button>
                        <Link to="/uppfoljning" className={`${ui.outlineBtn} w-full text-center`}>
                          Skicka uppföljning
                        </Link>
                        <Link to="/recept" className={`${ui.outlineBtn} w-full text-center`}>
                          Ny veckomeny
                        </Link>
                        <Link to="/support" className="text-[10px] font-black uppercase tracking-widest text-[#6B6158] text-center hover:text-[#3D3D3D]">
                          Support
                        </Link>
                      </div>
                      {coachingStatus === 'paused' && (
                        <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-700">
                          <PauseCircle className="w-4 h-4 mt-0.5" />
                          <span>Medlemskapet är pausat.</span>
                        </div>
                      )}
                      {coachingStatus === 'expired' && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700">
                          <AlertTriangle className="w-4 h-4 mt-0.5" />
                          <span>Din period är på väg att avslutas.</span>
                        </div>
                      )}
                      {coachingStatus === 'deactivated' && (
                        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700">
                          <Ban className="w-4 h-4 mt-0.5" />
                          <span>Medlemskapet är deaktiverat.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

        <div className="min-h-[600px]">
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-6 animate-fade-in">
                <div className={ui.panel}>
                  <div className="absolute top-[-20%] left-[-10%] w-[360px] h-[360px] bg-[#a0c81d]/10 rounded-full blur-[110px]"></div>
                  <div className="relative z-10 space-y-5">
                    <CardHeader
                      label="Åtgärder"
                      title="Snabbkommandon"
                      icon={Sparkles}
                    />
                    <p className={ui.body}>
                      Starta viktiga flöden direkt utan att leta i menyerna.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => navigateToTab('MEMBERSHIP')}
                        className={`${ui.primaryBtnSm} w-full flex items-center justify-center`}
                      >
                        Hantera medlemskap
                      </button>
                      <Link to="/uppfoljning" className={`${ui.outlineBtn} w-full text-center`}>
                        Skicka uppföljning
                      </Link>
                      <Link to="/recept" className={`${ui.outlineBtn} w-full text-center`}>
                        Skapa veckomeny
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-[#E8F1D5] rounded-[2.5rem] p-6 md:p-8 border border-[#E6E1D8] shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-16 -right-10 w-[240px] h-[240px] bg-cyan-500/10 rounded-full blur-[90px]"></div>
                    <div className="relative z-10 flex flex-col gap-6">
                      <div className="w-full">
                        <CardHeader
                          label="Inlämningar"
                          title="Senaste inskickat"
                          icon={FileDown}
                          action={
                            <span className={`${ui.label} text-[#6B6158]`}>
                              {combinedSubmissions.length === 0 ? 'Inga inlämningar' : `${combinedSubmissions.length} totalt`}
                            </span>
                          }
                        />
                        <p className={`${ui.body} mt-2`}>
                          Startformulär och uppföljningar samlat på ett ställe.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {combinedSubmissions.length === 0 ? (
                          <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 px-4 py-4 text-sm text-[#8A8177]">
                            Inga inlämningar ännu.
                          </div>
                        ) : (
                          combinedSubmissions.slice(0, 3).map((submission) => {
                            const isStart = submission.kind === 'start';
                            const label = isStart ? 'Startformulär' : 'Uppföljning';
                            return (
                              <div key={`${submission.kind}-${submission.data.id}`} className={`flex items-center justify-between ${ui.cardSoft}`}>
                                <div>
                                  <p className="text-sm font-bold text-[#3D3D3D]">{label}</p>
                                  <p className="text-[10px] text-[#8A8177] font-bold uppercase tracking-widest mt-1">
                                    {formatDateTime(submission.data.created_at)}
                                  </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#6B6158]">
                                  {submission.data.is_done ? 'Klarmarkerad' : 'Mottagen'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigateToTab('SUBMISSIONS')}
                          className={ui.outlineBtn}
                        >
                          Visa allt
                        </button>
                        <Link to="/uppfoljning" className={ui.primaryBtnSm}>
                          Skicka uppföljning
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#E8F1D5] rounded-[2.5rem] p-6 md:p-8 border border-[#E6E1D8] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-[-20%] right-[-10%] w-[280px] h-[280px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                    <div className="relative z-10 flex flex-col gap-6 h-full">
                      <div className="w-full">
                        <CardHeader
                          label="Veckomenyer"
                          title="Senaste planer"
                          icon={FileText}
                          action={
                            <span className={`${ui.label} text-[#6B6158]`}>
                              {weeklyPlans.length === 0 ? 'Inga sparade planer' : `${weeklyPlans.length} sparade`}
                            </span>
                          }
                        />
                        <p className={`${ui.body} mt-3`}>
                          {weeklyPlans.length === 0 ? 'Inga sparade planer ännu.' : 'Här ser du dina senaste planer.'}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {weeklyPlans.slice(0, 3).map((plan: any) => (
                          <div key={plan.id} className={`flex items-center justify-between ${ui.cardSoft}`}>
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
                        <Link
                          to="/recept"
                          className={ui.primaryBtnSm}
                        >
                          Skapa ny plan
                        </Link>
                        <button
                          onClick={() => navigateToTab('PLANS')}
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
                <div className={ui.panel}>
                  <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div>
                      <h2 className="text-3xl font-black text-[#3D3D3D] uppercase tracking-tight mb-2 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-purple-400" /> Veckomeny-arkiv
                      </h2>
                      <p className={ui.body}>Här sparas alla dina genererade planer.</p>
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
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#a0c81d] text-[#F6F1E7] px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-[#5C7A12] active:scale-95 shadow-xl shadow-[#a0c81d]/20"
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

            {activeTab === 'SUBMISSIONS' && (
              <div className="space-y-8 animate-fade-in">
                <div className={ui.panel}>
                  <div className="absolute top-[-20%] left-[-10%] w-[360px] h-[360px] bg-cyan-500/10 rounded-full blur-[120px]"></div>
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div>
                        <p className={ui.labelTight}>Historik</p>
                        <h2 className="text-3xl font-black text-[#3D3D3D] uppercase tracking-tight mb-2 flex items-center gap-3">
                          <FileText className="w-8 h-8 text-[#6B6158]" /> Mina inlämningar
                        </h2>
                        <p className={ui.body}>
                          Här samlas dina inskickade startformulär och uppföljningar.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link to="/uppfoljning" className={ui.primaryBtnSm}>
                          Skicka uppföljning
                        </Link>
                      </div>
                    </div>

                    <div className="mt-10 space-y-4">
                      {combinedSubmissions.length === 0 ? (
                        <div className="text-center py-20 bg-[#F6F1E7]/30 rounded-[2.5rem] border-2 border-dashed border-[#E6E1D8]">
                          <Clock className="w-14 h-14 text-slate-700 mx-auto mb-4" />
                          <h3 className="text-lg font-bold text-[#3D3D3D] mb-2">Inga inlämningar ännu</h3>
                          <p className="text-[#8A8177] text-sm">När du skickat in startformulär eller uppföljning visas det här.</p>
                        </div>
                      ) : (
                        combinedSubmissions.map((submission) => {
                          const isStart = submission.kind === 'start';
                          const data = submission.data;
                          const badge = isStart ? 'Startformulär' : 'Uppföljning';
                          const badgeStyle = isStart
                            ? 'bg-purple-500/15 text-purple-700 border-purple-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
                          const statusStyle = data.is_done
                            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 border-amber-500/30';
                          const statusLabel = data.is_done ? 'Klarmarkerad' : 'Mottagen';
                          const entryKey = `${submission.kind}-${data.id}`;
                          const isExpanded = !!expandedSubmissions[entryKey];

                          return (
                            <button
                              key={entryKey}
                              type="button"
                              onClick={() => toggleSubmission(entryKey)}
                              className="text-left w-full bg-[#F6F1E7]/80 backdrop-blur-md rounded-[2rem] border border-[#E6E1D8] p-6 hover:border-[#a0c81d]/40 transition-all"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-white/70 border border-[#E6E1D8] flex items-center justify-center text-[#6B6158]">
                                    {isStart ? <FileText className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${badgeStyle}`}>
                                        {badge}
                                      </span>
                                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle}`}>
                                        {statusLabel}
                                      </span>
                                    </div>
                                    <div className="text-sm font-bold text-[#3D3D3D]">
                                      Inskickad {formatDateTime(data.created_at)}
                                    </div>
                                    {isStart ? (
                                      <div className="text-xs text-[#8A8177] font-medium">
                                        {submission.data.desired_start_date ? `Önskat startdatum: ${formatDate(submission.data.desired_start_date)}` : 'Önskat startdatum ej angivet'}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-[#8A8177] font-medium">
                                        {submission.data.goal ? `Mål: ${submission.data.goal}` : 'Mål ej angivet'}
                                      </div>
                                    )}
                                    <div className="text-[13px] text-[#6B6158] font-medium max-w-2xl">
                                      {isStart
                                        ? clampText(submission.data.goal_description || (submission.data.focus_areas || []).join(', '))
                                        : clampText(submission.data.summary_feedback)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                                  {data.is_done && data.done_at ? `Klarmarkerad ${formatDate(data.done_at)}` : 'Ej klarmarkerad'}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-6 rounded-2xl border border-[#E6E1D8] bg-white/70 p-5 text-sm text-[#3D3D3D] space-y-3">
                                  {isStart ? (
                                    <>
                                      <div>
                                        <span className={ui.label}>Fokusområden</span>
                                        <div className="mt-1 text-[#6B6158]">
                                          {(submission.data.focus_areas && submission.data.focus_areas.length > 0) ? submission.data.focus_areas.join(', ') : 'Ej angivet'}
                                        </div>
                                      </div>
                                      <div>
                                        <span className={ui.label}>Målbeskrivning</span>
                                        <div className="mt-1 text-[#6B6158]">
                                          {submission.data.goal_description || 'Ej angivet'}
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <span className={ui.label}>Sammanfattning</span>
                                        <div className="mt-1 text-[#6B6158]">
                                          {submission.data.summary_feedback || 'Ej angivet'}
                                        </div>
                                      </div>
                                      <div>
                                        <span className={ui.label}>Mål</span>
                                        <div className="mt-1 text-[#6B6158]">
                                          {submission.data.goal || 'Ej angivet'}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'MEMBERSHIP' && (
              <div className="space-y-8 animate-fade-in">
                <div className={ui.panel}>
                  <div className="absolute top-[-15%] right-[-10%] w-[320px] h-[320px] bg-[#a0c81d]/10 rounded-full blur-[100px]"></div>
                  <div className="relative z-10 space-y-8">
                    <div>
                      <p className={ui.labelTight}>Medlemskap</p>
                      <h2 className={ui.titleLg}>Hantera din PTO‑tjänst</h2>
                      <p className={`${ui.body} mt-2 max-w-2xl`}>
                        Här ser du din coachingstatus, kommande händelser och tilläggstjänster.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className={`${ui.card} flex flex-col gap-4`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <p className={ui.label}>PTO Coaching</p>
                            <h4 className="text-lg md:text-xl font-black text-[#3D3D3D]">Kundmedlemskap</h4>
                            <p className={`${ui.body} mt-2 max-w-xl`}>
                              Din personliga coachingperiod, uppföljningar och klientstatus.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${coachingMeta.style}`}>
                              {coachingMeta.label}
                            </div>
                            <button
                              onClick={handleManualSyncMembership}
                              disabled={isSyncingMembership}
                              className="px-3 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#E6E1D8] transition-all disabled:opacity-60"
                            >
                              {isSyncingMembership ? 'Uppdaterar…' : 'Uppdatera status'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#6B6158]">
                          <div className="flex items-start gap-3">
                            <span className="mt-1 w-2 h-2 rounded-full bg-[#a0c81d]"></span>
                            <span>
                              Utgångsdatum:{' '}
                              {coachingStatus === 'paused'
                                ? 'Pausat'
                                : coachingStatus === 'deactivated'
                                  ? 'Deaktiverad'
                                  : coachingStatus === 'expired'
                                    ? 'På väg att avslutas'
                                    : user.coaching_expires_at
                                      ? formatDate(user.coaching_expires_at)
                                      : 'Ej angivet'}
                            </span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="mt-1 w-2 h-2 rounded-full bg-[#a0c81d]"></span>
                            <span>Status: {coachingMeta.label}</span>
                          </div>
                        </div>
                        {syncStatus === 'success' && (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                            Status uppdaterad.
                          </div>
                        )}
                        {syncStatus === 'error' && (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
                            Kunde inte uppdatera status.
                          </div>
                        )}

                        {coachingStatus === 'paused' && (
                          <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-700">
                            <PauseCircle className="w-4 h-4 mt-0.5" />
                            <span>Ditt medlemskap är pausat. Utgångsdatumet är fryst tills återaktivering.</span>
                          </div>
                        )}
                        {coachingStatus === 'expired' && (
                          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                            <span>Din period är på väg att avslutas. Kontakta oss om du vill fortsätta.</span>
                          </div>
                        )}
                        {coachingStatus === 'deactivated' && (
                          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700">
                            <Ban className="w-4 h-4 mt-0.5" />
                            <span>Medlemskapet är deaktiverat och tillgången till träningsappen är borttagen.</span>
                          </div>
                        )}

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-[#E6E1D8]">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                            Vill du pausa? Då fryser vi din period och aktiverar när du vill igen.
                          </div>
                          <div className="flex items-center gap-3">
                            {pauseStatus === 'success' && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                                Pausbegäran skickad
                              </span>
                            )}
                            {pauseCooldownActive && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-700">
                                Pausbegäran redan registrerad. Status uppdateras inom 24 timmar.
                              </span>
                            )}
                            {pauseStatus === 'error' && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                                Kunde inte skicka
                              </span>
                            )}
                            {coachingActive ? (
                              <button
                                onClick={handlePauseMembership}
                                disabled={isPausing || pauseCooldownActive}
                                className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#E6E1D8] transition-all disabled:opacity-60"
                              >
                                {isPausing
                                  ? 'Skickar...'
                                  : pauseCooldownActive
                                    ? 'Paus begärd'
                                    : 'Pausa medlemskap'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                                Ingen aktiv period att pausa
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-[#E6E1D8]">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                            Vill du deaktivera? Du kan alltid återaktivera senare.
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {cancelStatus === 'success' && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                                Begäran skickad
                              </span>
                            )}
                            {cancelStatus === 'error' && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                                {cancelMessage || 'Kunde inte skicka'}
                              </span>
                            )}
                            <button
                              onClick={handleCancelSubscription}
                              disabled={isCancelling || !canDeactivateMembership}
                              className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#E6E1D8] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {isCancelling
                                ? 'Skickar...'
                                : canDeactivateMembership
                                  ? 'Deaktivera medlemskap'
                                  : 'Deaktivera (kommer snart)'}
                            </button>
                            <Link
                              to="/support"
                              className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#E6E1D8] transition-all"
                            >
                              Kontakta support
                            </Link>
                          </div>
                        </div>
                      </div>

                      <div className={`${ui.card} flex flex-col gap-4`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <p className={ui.label}>PTO AI</p>
                            <h4 className="text-lg md:text-xl font-black text-[#3D3D3D]">Tilläggstjänst</h4>
                            <p className={`${ui.body} mt-2 max-w-xl`}>
                              AI‑coachning, smarta rapporter och snabbare support. Läggs till när du vill.
                            </p>
                          </div>
                          <div className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border bg-white/80 text-[#6B6158] border-[#E6E1D8]">
                            Ej aktiverad
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4 text-xs text-[#6B6158]">
                          Vi lanserar fler PTO‑AI funktioner löpande. Kontakta oss om du vill bli testkund.
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Link to="/support" className={ui.primaryBtnSm}>
                            Intresseanmälan
                          </Link>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                            Tilläggstjänst
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'SETTINGS' && (
              <div className="space-y-8 animate-fade-in">
                <div className={ui.panel + ' min-h-[400px]'}>
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
                              className={ui.outlineBtn}
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
</div>
  );
};

export default Profile;
