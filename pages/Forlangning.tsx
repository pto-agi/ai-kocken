import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { RenewalFlow } from '../components/RenewalFlow';

export const Forlangning: React.FC = () => {
  const { profile, session } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-16 pt-20 md:pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 animate-fade-in space-y-5">
        <RenewalFlow profile={profile} session={session} />

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
