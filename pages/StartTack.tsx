import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Mail } from 'lucide-react';

export const StartTack: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-12 md:pb-24 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-12%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[520px] h-[520px] bg-cyan-500/5 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 animate-fade-in">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.6rem] p-8 md:p-12 border border-[#E6E1D8] shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/15 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Bekräftelse</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">
            Tack! Din startinlämning är mottagen.
          </h1>

          {/* Brödtext */}
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#4A4A4A]">
            <p>
              Vi har tagit emot dina uppgifter och kommer inom kort att påbörja planeringen
              av dina nya upplägg.
            </p>
            <p>
              Inom 1–2 arbetsdagar (om du inte önskat ett senare startdatum) kommer dina
              första upplägg att levereras. I samband med detta skickas även en personlig
              inbjudan till appen ut till dig via mejl.
            </p>
          </div>

          {/* Medlemskonto-sektion */}
          <div className="mt-10 pt-8 border-t border-[#E6E1D8]">
            <h2 className="text-xl md:text-2xl font-black text-[#3D3D3D] tracking-tight">
              Känner du dig produktiv? Ska vi ta ett steg till?
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#4A4A4A]">
              Förbered dig inför starten genom att skapa ett medlemskonto hos oss.
              Genom medlemskontot kan du bland annat pausa eller deaktivera ditt
              medlemskap vid behov. Du kan skapa veckomenyer med recept och göra
              uppföljningar.
            </p>

            <Link
              to="/auth"
              className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition shadow-lg shadow-[#a0c81d]/15"
            >
              Skapa medlemskonto <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Kontakt-sektion */}
          <div className="mt-10 pt-8 border-t border-[#E6E1D8]">
            <p className="text-[15px] leading-relaxed text-[#4A4A4A]">
              Om du har några frågor eller funderingar är du varmt välkommen att
              kontakta oss. Och om inte, så kommer du att höra från din nya coach
              inom kort.
            </p>

            <a
              href="mailto:info@privatetrainingonline.se"
              className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#F6F1E7] border border-[#E6E1D8] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/50 hover:text-[#a0c81d] transition"
            >
              <Mail className="w-4 h-4" /> Kontakta oss
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
