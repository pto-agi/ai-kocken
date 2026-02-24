import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import PremiumAccess from '../components/PremiumAccess';

export const Premium: React.FC = () => {
  const { profile } = useAuthStore();
  const isPremium = profile?.membership_level === 'premium';

  if (!isPremium) {
    return (
      <PremiumAccess
        mode="locked"
        title="Premiuminnehåll"
        description="Denna funktion är exklusiv för våra Premium-medlemmar. Uppgradera för att få tillgång."
      />
    );
  }

  return (
    <div className="bg-[#E8F1D5]/70 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-[#E6E1D8] shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#8A8177]">Premium</p>
          <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">Premium är aktivt</h1>
        </div>
      </div>
      <p className="text-sm text-[#6B6158] font-medium mt-4">
        Du har redan Premium. Fortsätt till dina veckomenyer och uppföljningar.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          to="/recept"
          className="px-5 py-2.5 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition"
        >
          Gå till veckomeny
        </Link>
        <Link
          to="/profile"
          className="px-5 py-2.5 rounded-xl border border-[#E6E1D8] bg-white/80 text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:bg-white transition"
        >
          Mina sidor
        </Link>
      </div>
    </div>
  );
};
