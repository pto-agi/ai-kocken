import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CheckoutHeader: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#F6F1E7]/90 backdrop-blur-xl border-b border-[#E6E1D8]/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-[#6B6158] hover:text-[#3D3D3D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Tillbaka</span>
        </button>

        {/* Logo */}
        <a href="https://www.privatetrainingonline.se" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <img
            src="/pto-logotyp-2026.png"
            alt="Private Training Online"
            className="h-8 w-auto"
          />
          <span className="text-sm font-black text-[#3D3D3D] hidden sm:block">
            Private Training Online
          </span>
        </a>

        {/* Spacer to balance layout */}
        <div className="w-16" />
      </div>
    </header>
  );
};

export default CheckoutHeader;
