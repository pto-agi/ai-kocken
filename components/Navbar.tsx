
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  ChefHat, 
  Home,
  User, 
  Menu, 
  X, 
  LogOut,
  ChevronRight,
  Settings,
  ShieldCheck,
  ClipboardCheck,
  ShoppingBasket
} from 'lucide-react';

const Navbar: React.FC = () => {
  const { session, signOut, profile } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isStaff = profile?.is_staff === true;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsDrawerOpen(false);
  };

  const navLinks = isStaff
    ? [{ path: '/intranet', label: 'INTRANÄT', icon: ShieldCheck }]
    : [
        { path: '/', label: 'HEM', icon: Home },
        { path: '/recept', label: 'RECEPT', icon: ChefHat },
        { path: '/uppfoljning', label: 'UPPFÖLJNING', icon: ClipboardCheck },
        { path: '/refill', label: 'SHOP', icon: ShoppingBasket },
      ];

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          scrolled 
            ? 'bg-[#3D3D3D]/95 backdrop-blur-md border-[#6B6158] h-20 shadow-xl' 
            : 'bg-[#3D3D3D] border-transparent h-24'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group relative z-50">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl border border-[#6B6158] shadow-lg bg-[#3D3D3D] group-hover:border-[#a0c81d]/30 transition-all duration-300 overflow-hidden">
                <img src="/pto-logotyp-2026.png" alt="PTO" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex flex-col">
                <div className="flex items-baseline leading-none">
                    <span className="text-xl font-bold text-white tracking-tight font-heading">PTO</span>
                </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="relative group py-2"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-heading font-semibold tracking-wide transition-colors duration-300 ${
                    isActive(link.path) ? 'text-[#a0c81d]' : 'text-white group-hover:text-[#a0c81d]'
                  }`}>
                    {link.label}
                  </span>
                  {'aiBadge' in link && link.aiBadge && (
                    <span className="relative ml-1 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a0c81d]/60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#a0c81d]" />
                    </span>
                  )}
                </div>
                <span className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#a0c81d] transition-all duration-300 ${
                  isActive(link.path) ? 'opacity-100 scale-100 shadow-[0_0_8px_#a0c81d]' : 'opacity-0 scale-0'
                }`}></span>
              </Link>
            ))}
            
            {session ? (
              <div className="ml-2 flex items-center gap-2">
                {!isStaff && (
                  <Link
                    to="/profile"
                    className="p-2 text-white/70 hover:text-[#a0c81d] transition-colors"
                    title="Mina sidor"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}
                <button 
                  onClick={handleSignOut} 
                  className="p-2 text-white/70 hover:text-red-400 transition-colors"
                  title="Logga ut"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="ml-2 flex items-center gap-2">
                {!isStaff && (
                  <Link
                    to="/profile"
                    className="p-2 text-white/70 hover:text-[#a0c81d] transition-colors"
                    title="Mina sidor"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}
                <Link to="/auth" className="px-4 py-2 bg-transparent border border-white/70 rounded-lg text-xs font-bold text-white uppercase tracking-wide hover:text-[#a0c81d] hover:border-[#a0c81d] transition-all">
                  Logga in
                </Link>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="md:hidden p-2 text-white/80 hover:text-white transition-colors relative z-50"
            aria-label="Öppna meny"
          >
            <Menu className="w-8 h-8 stroke-[1.5]" />
          </button>
        </div>
      </nav>

      <div 
        className={`fixed inset-0 bg-[#3D3D3D]/30 backdrop-blur-sm z-[60] transition-opacity duration-300 md:hidden ${
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsDrawerOpen(false)}
      />

      <div 
        className={`fixed top-0 bottom-0 right-0 w-[85%] max-w-sm bg-[#3D3D3D] z-[70] shadow-2xl border-l border-[#6B6158] transform transition-transform duration-300 ease-out md:hidden flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-3 border-b border-[#6B6158] bg-[#3D3D3D] relative">
            <button 
                onClick={() => setIsDrawerOpen(false)}
                className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white bg-[#3D3D3D] rounded-full transition-colors"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pr-10">
                <div className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-[#6B6158] bg-[#3D3D3D] overflow-hidden">
                    <img src="/pto-logotyp-2026.png" alt="PTO" className="w-7 h-7 object-contain" />
                </div>
                <div className="flex items-baseline leading-none">
                    <span className="text-lg font-bold text-white tracking-tight font-heading">PTO</span>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 group border border-transparent ${
                isActive(link.path) 
                  ? 'bg-[#a0c81d]/15 border-[#a0c81d]/40' 
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <link.icon className={`w-4 h-4 ${isActive(link.path) ? 'text-[#a0c81d]' : 'text-white group-hover:text-[#a0c81d]'}`} />
                <span className={`font-heading text-sm font-semibold tracking-wide ${isActive(link.path) ? 'text-[#a0c81d]' : 'text-white group-hover:text-[#a0c81d]'}`}>
                  {link.label}
                </span>
                {'aiBadge' in link && link.aiBadge && (
                  <span className="relative ml-1 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a0c81d]/60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#a0c81d]" />
                  </span>
                )}
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-white/60 transition-transform group-hover:translate-x-1 ${isActive(link.path) ? 'text-[#a0c81d]' : ''}`} />
            </Link>
          ))}

          <div className="mt-4 pt-4 border-t border-[#6B6158] px-1">
             <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2 px-2">Konto</p>
             {session ? (
               <>
                 <Link to="/profile" className="flex items-center gap-3 p-2.5 text-white hover:text-[#a0c81d] transition-colors">
                    <User className="w-4 h-4" />
                    <span className="font-medium text-sm">Mina sidor</span>
                 </Link>
                 <Link to="/profile/konto" className="flex items-center gap-3 p-2.5 text-white hover:text-[#a0c81d] transition-colors">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium text-sm">Inställningar</span>
                 </Link>
                 <button 
                   onClick={handleSignOut}
                   className="w-full flex items-center gap-3 p-2.5 text-white hover:text-red-400 transition-colors"
                 >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium text-sm">Logga ut</span>
                 </button>
               </>
             ) : (
               <>
                 <Link to="/profile" className="flex items-center gap-3 p-2.5 text-white hover:text-[#a0c81d] transition-colors">
                    <User className="w-4 h-4" />
                    <span className="font-medium text-sm">Mina sidor</span>
                 </Link>
                 <Link to="/profile/konto" className="flex items-center gap-3 p-2.5 text-white hover:text-[#a0c81d] transition-colors">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium text-sm">Inställningar</span>
                 </Link>
                 <Link to="/auth" className="flex items-center gap-3 p-2.5 text-white hover:text-[#a0c81d] transition-colors">
                    <User className="w-4 h-4" />
                    <span className="font-medium text-sm">Logga in</span>
                 </Link>
               </>
             )}
          </div>
        </div>

        <div className="p-4 border-t border-[#6B6158] bg-[#3D3D3D]">
           <div className="flex items-center justify-center gap-2 text-[9px] text-white/70 uppercase tracking-widest font-bold">
              <ShieldCheck className="w-3 h-3" /> Säker anslutning
           </div>
        </div>
      </div>

    </>
  );
};

export default Navbar;
