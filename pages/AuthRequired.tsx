import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';

export const AuthRequired: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as any)?.from || { pathname: '/' };

  const handleLogin = () => {
    navigate('/auth', { state: { from } });
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] w-full bg-[#F6F1E7] pt-24 pb-24 px-4 text-[#3D3D3D]">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-[#E6E1D8] bg-[#E8F1D5]/70 backdrop-blur-xl p-6 md:p-10 shadow-2xl">
          <div className="absolute -top-20 -right-16 w-[260px] h-[260px] bg-[#a0c81d]/10 rounded-full blur-[90px]"></div>
          <div className="absolute -bottom-24 -left-16 w-[260px] h-[260px] bg-cyan-500/10 rounded-full blur-[90px]"></div>

          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-14 h-14 rounded-2xl bg-white/70 border border-[#E6E1D8] flex items-center justify-center text-[#a0c81d] shadow-sm">
              <Lock className="w-6 h-6" />
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#8A8177]">Inloggning krävs</p>
                <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">Den här sidan är låst för gäster</h1>
                <p className="text-sm md:text-base text-[#6B6158] font-medium mt-2 max-w-2xl">
                  Logga in eller skapa konto för att få tillgång till dina verktyg, uppföljningar och sparade planer.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  onClick={handleLogin}
                  className="px-6 py-3 rounded-2xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-xs shadow-lg shadow-[#a0c81d]/20 hover:bg-[#5C7A12] transition flex items-center gap-2"
                >
                  Logga in
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogin}
                  className="px-5 py-3 rounded-2xl border border-[#E6E1D8] bg-white/80 text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:bg-white transition"
                >
                  Skapa konto
                </button>
              </div>

              <button
                onClick={() => navigate('/')}
                className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] hover:text-[#3D3D3D] transition"
              >
                Tillbaka till startsidan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
