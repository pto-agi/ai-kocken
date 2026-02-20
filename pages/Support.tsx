import React from 'react';
import { LifeBuoy } from 'lucide-react';
import SupportChat from '../components/SupportChat';

export const Support: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F6F1E7] pb-20 animate-fade-in relative font-sans overflow-x-hidden text-[#3D3D3D]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 md:pt-12">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
            <LifeBuoy className="w-3 h-3 text-[#a0c81d]" /> Support
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-black text-[#3D3D3D] font-heading tracking-tight">
            Snabb hjälp, precis när du behöver den
          </h1>
          <p className="mt-3 text-[#6B6158] text-sm md:text-base font-medium">
            Skriv till oss i chatten så guidar vi dig vidare. Vi svarar vanligtvis inom några minuter.
          </p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <SupportChat />
      </div>
    </div>
  );
};
