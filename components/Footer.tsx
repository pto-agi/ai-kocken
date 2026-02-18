
import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#3D3D3D] border-t border-[#6B6158] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        
        {/* --- GRID CONTENT --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          {/* 1. BRAND & USP */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3 group w-fit">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-[#6B6158] shadow-lg bg-[#3D3D3D] group-hover:border-[#a0c81d]/30 transition-all duration-300 overflow-hidden">
                    <img src="/logotyp-glow.png" alt="PTO" className="w-7 h-7 object-contain" />
                </div>
                
                <div className="flex flex-col">
                    <div className="flex items-baseline leading-none">
                        <span className="text-xl font-bold text-white tracking-tight font-heading">PTO</span>
                        <span className="text-xl font-bold text-[#a0c81d] font-heading ml-0.5">Ai</span>
                    </div>
                </div>
            </Link>
            <p className="text-[#E6E1D8] text-sm leading-relaxed max-w-xs font-medium">
              Vi gör det enkelt att äta gott och leva hälsosamt. Din personliga AI-kock och kostplanerare – anpassad efter dig.
            </p>
          </div>

          {/* 2. AI-VERKTYG */}
          <div>
            <h4 className="font-heading font-bold text-white mb-6 tracking-wide">Tjänsten</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link to="/recept" className="text-white hover:text-[#a0c81d] transition-colors duration-200 block py-1">Recept</Link></li>
              <li><Link to="/forlangning" className="text-white hover:text-[#a0c81d] transition-colors duration-200 block py-1">Förlängning</Link></li>
              <li><Link to="/premium" className="text-white hover:text-[#a0c81d] transition-colors duration-200 block py-1">Bli Medlem</Link></li>
            </ul>
          </div>

          {/* 3. FÖRETAG */}
          <div>
            <h4 className="font-heading font-bold text-white mb-6 tracking-wide">Företag</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="https://privatetrainingonline.se/pt-online/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#a0c81d] transition-colors duration-200 block py-1">Digitala friskvårdspaket</a></li>
              <li><a href="https://shop.privatetrainingonline.se/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#a0c81d] transition-colors duration-200 block py-1">Webbshop</a></li>
              <li><a href="https://privatetrainingonline.se/villkor-info/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#a0c81d] transition-colors duration-200 block py-1">Användarvillkor</a></li>
            </ul>
          </div>

          {/* 4. KONTAKT */}
          <div>
            <h4 className="font-heading font-bold text-white mb-6 tracking-wide">Kontakt</h4>
            <div className="flex gap-4">
              <a 
                href="https://privatetrainingonline.se/kontakt/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 rounded-xl bg-[#3D3D3D] border border-[#6B6158] flex items-center justify-center text-white hover:text-[#a0c81d] hover:border-[#a0c81d]/30 transition-all duration-300 group"
                title="Kontakta oss"
              >
                <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://instagram.com/privatetrainingonline/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 rounded-xl bg-[#3D3D3D] border border-[#6B6158] flex items-center justify-center text-white hover:text-[#a0c81d] hover:border-[#a0c81d]/30 transition-all duration-300 group"
                title="Instagram"
              >
                <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://facebook.com/privatetrainingonline/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 rounded-xl bg-[#3D3D3D] border border-[#6B6158] flex items-center justify-center text-white hover:text-[#a0c81d] hover:border-[#a0c81d]/30 transition-all duration-300 group"
                title="Facebook"
              >
                <Facebook className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* --- BOTTOM BAR --- */}
        <div className="border-t border-[#6B6158] pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#E6E1D8] font-medium">
          <p>© {new Date().getFullYear()} Private Training Online. Alla rättigheter förbehållna.</p>
          <a 
            href="https://privatetrainingonline.se/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white hover:text-[#a0c81d] transition-colors"
          >
            Besök privatetrainingonline.se
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
