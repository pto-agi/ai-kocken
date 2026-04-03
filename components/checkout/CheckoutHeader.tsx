import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'PT Online', href: 'https://privatetrainingonline.se/pt-online/' },
  { label: 'Program', href: 'https://privatetrainingonline.se/program/' },
  { label: 'Artiklar', href: 'https://privatetrainingonline.se/artiklar/' },
  { label: 'Webbutik', href: 'https://privatetrainingonline.se/webbutik/' },
];

export const CheckoutHeader: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#3D3D3D]">
      <div className="w-full px-5 md:px-8 flex items-center justify-between" style={{ height: '56px' }}>
        {/* Logo */}
        <a href="https://privatetrainingonline.se/" className="flex items-center shrink-0 hover:opacity-90 transition-opacity" aria-label="Private Training Online – Startsida">
          <img
            src="https://privatetrainingonline.se/wp-content/uploads/2024/10/Logotyp-PT-Online.png"
            alt="Logotyp – Private Training Online"
            className="h-[36px] w-auto object-contain"
          />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Huvudnavigering">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="px-5 py-2 text-white/90 hover:text-[#a0c81d] transition-colors uppercase"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '15px', letterSpacing: '0.02em' }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-10 h-10 text-white/90 hover:text-white transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Stäng meny' : 'Öppna meny'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="md:hidden bg-[#3D3D3D] border-t border-white/10 pb-4" aria-label="Mobilnavigering">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="block px-6 py-4 text-white/90 hover:text-[#a0c81d] hover:bg-white/5 transition-colors uppercase text-center"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '17px' }}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
};

export default CheckoutHeader;
