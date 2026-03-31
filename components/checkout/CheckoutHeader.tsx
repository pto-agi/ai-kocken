import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CheckoutHeader: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#3D3D3D] border-b border-[#6B6158]">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Tillbaka</span>
        </button>

        {/* Logo — right aligned */}
        <a href="https://www.privatetrainingonline.se" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-[#6B6158] bg-[#3D3D3D] overflow-hidden">
            <img
              src="/pto-logotyp-2026.png"
              alt="PTO"
              className="w-7 h-7 object-contain"
            />
          </div>
          <span className="text-sm font-bold text-white tracking-tight hidden sm:block">PTO</span>
        </a>
      </div>
    </header>
  );
};

export default CheckoutHeader;
