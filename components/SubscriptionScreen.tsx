import React, { useState, useEffect } from 'react';
import { Check, ShieldCheck, LogOut, Zap, CreditCard, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionScreenProps {
  onCheckStatus: () => void;
}

// Byt ut denna mot din faktiska betallänk från Stripe Dashboard
const STRIPE_PAYMENT_LINK = 'https://betalning.privatetrainingonline.se/b/cNi00i4bN9lBaqO4sDcfK0v?locale=sv'; 

const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ onCheckStatus }) => {
  const [userEmail, setUserEmail] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const getUserEmail = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setUserEmail(user.email);
    };
    getUserEmail();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleExternalCheckout = () => {
    // Vi skickar med e-posten till Stripe för att underlätta matchning i Zapier
    const separator = STRIPE_PAYMENT_LINK.includes('?') ? '&' : '?';
    const checkoutUrl = `${STRIPE_PAYMENT_LINK}${separator}prefilled_email=${encodeURIComponent(userEmail)}`;
    
    window.location.href = checkoutUrl;
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    await onCheckStatus();
    setIsChecking(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
        
        {/* Left Side: Value Prop */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-slate-900 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 opacity-10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>
           
           <div className="relative z-10">
             <div className="flex items-center gap-2 mb-6">
               <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
                 <Zap className="w-6 h-6 text-emerald-400" />
               </div>
               <span className="font-black text-xl tracking-tight uppercase">PTO Ai Premium</span>
             </div>
             
             <h1 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
               Lås upp din <span className="text-emerald-400">metaboliska</span> potential.
             </h1>
             
             <div className="space-y-4 mb-8">
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check className="w-4 h-4 text-emerald-400" /></div>
                 <span className="font-medium text-slate-200">Obegränsad AI-Kock</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check className="w-4 h-4 text-emerald-400" /></div>
                 <span className="font-medium text-slate-200">Livsmedelsdatabas & Scanner</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check className="w-4 h-4 text-emerald-400" /></div>
                 <span className="font-medium text-slate-200">Smart Skafferi & Inköp</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check className="w-4 h-4 text-emerald-400" /></div>
                 <span className="font-medium text-slate-200">Hälsomål & Biometri</span>
               </div>
             </div>
             
             <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold bg-slate-800/50 p-3 rounded-lg w-fit">
               <ShieldCheck className="w-4 h-4" /> Säker betalning via Stripe
             </div>
           </div>
        </div>

        {/* Right Side: Pricing */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
           <div className="text-center mb-8">
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Bli Medlem</h2>
             <p className="text-slate-500">Hantera din prenumeration enkelt via Stripe.</p>
           </div>

           <div className="bg-emerald-50/50 rounded-2xl p-6 border-2 border-emerald-500 mb-8 relative shadow-lg shadow-emerald-100/50">
             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
               Allt ingår
             </div>
             <div className="flex justify-between items-end mb-2">
               <span className="text-lg font-bold text-slate-800">Månadsprenumeration</span>
               <div className="text-right">
                 <span className="text-3xl font-black text-slate-900">99 kr</span>
                 <span className="text-sm text-slate-500 font-medium">/mån</span>
               </div>
             </div>
             <div className="w-full h-px bg-emerald-200 my-3"></div>
             <p className="text-xs text-emerald-700 font-bold uppercase tracking-wide flex items-center gap-1">
               <Check className="w-3 h-3" /> Ingen bindningstid
             </p>
           </div>

           <button 
             onClick={handleExternalCheckout}
             className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:translate-y-0 mb-4 uppercase tracking-wide text-sm flex items-center justify-center gap-2 group"
           >
             <CreditCard className="w-5 h-5" />
             Gå till kassan <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
           </button>

           <div className="bg-slate-50 p-4 rounded-xl text-center mb-6">
              <p className="text-xs text-slate-500 font-medium mb-3">
                 Har du precis betalat? Klicka här för att uppdatera din status.
              </p>
              <button 
                 onClick={handleManualCheck}
                 disabled={isChecking}
                 className="w-full bg-white hover:bg-slate-100 text-slate-700 font-bold py-2 rounded-lg border border-slate-200 text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
              >
                 {isChecking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                 {isChecking ? 'Kontrollerar...' : 'Verifiera Status'}
              </button>
           </div>
           
           <div className="text-center border-t border-slate-100 pt-6">
                <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-wide transition-colors mx-auto"
                >
                    <LogOut className="w-4 h-4" /> Logga ut / Byt konto
                </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default SubscriptionScreen;