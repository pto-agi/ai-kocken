
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
  Crown,
  ArrowRight,
  LifeBuoy,
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
  const isPremium = profile?.membership_level === 'premium';
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
        ...(session ? [{ path: '/uppfoljning', label: 'UPPFÖLJNING', icon: ClipboardCheck }] : []),
        ...(session ? [{ path: '/refill', label: 'PÅFYLLNING', icon: ShoppingBasket }] : []),
        { path: '/support', label: 'SUPPORT', icon: LifeBuoy },
        { path: '/profile', label: 'MINA SIDOR', icon: User }
      ];

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          scrolled 
            ? 'bg-[#0f172a]/95 backdrop-blur-md border-white/5 h-20 shadow-xl' 
            : 'bg-[#0f172a] border-transparent h-24'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group relative z-50">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 shadow-lg bg-[#0f172a] group-hover:border-[#a0c81d]/30 transition-all duration-300 overflow-hidden">
                <img src="/pto-logotyp-2026.png" alt="PTO" className="w-7 h-7 object-contain" />
            </div>
            <div className="flex flex-col">
                <div className="flex items-baseline leading-none">
                    <span className="text-xl font-bold text-white tracking-tight font-heading">PTO</span>
                    <span className="text-xl font-bold text-[#a0c81d] font-heading ml-0.5">Ai</span>
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
                    isActive(link.path) ? 'text-[#a0c81d]' : 'text-slate-400 group-hover:text-white'
                  }`}>
                    {link.label}
                  </span>
                </div>
                <span className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#a0c81d] transition-all duration-300 ${
                  isActive(link.path) ? 'opacity-100 scale-100 shadow-[0_0_8px_#a0c81d]' : 'opacity-0 scale-0'
                }`}></span>
              </Link>
            ))}
            
            {session ? (
              <button 
                onClick={handleSignOut} 
                className="ml-2 p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Logga ut"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
                <Link to="/auth" className="ml-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white uppercase tracking-wide hover:bg-[#a0c81d] hover:text-[#0f172a] hover:border-[#a0c81d] transition-all">
                    Logga in
                </Link>
            )}
          </div>

          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="md:hidden p-2 text-slate-300 hover:text-white transition-colors relative z-50"
            aria-label="Öppna meny"
          >
            <Menu className="w-8 h-8 stroke-[1.5]" />
          </button>
        </div>
      </nav>

      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity duration-300 md:hidden ${
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsDrawerOpen(false)}
      />

      <div 
        className={`fixed top-0 bottom-0 right-0 w-[85%] max-w-sm bg-[#0f172a] z-[70] shadow-2xl border-l border-white/5 transform transition-transform duration-300 ease-out md:hidden flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-white/5 bg-[#0f172a] relative">
            <button 
                onClick={() => setIsDrawerOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 rounded-full transition-colors"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="mt-6 mb-2">
                {isStaff ? (
                    <div className="flex items-center justify-center w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold uppercase tracking-wide">
                        <ShieldCheck className="w-4 h-4 mr-2" /> Personal
                    </div>
                ) : !isPremium ? (
                    <Link 
                        to="/premium" 
                        onClick={() => setIsDrawerOpen(false)}
                        className="flex items-center justify-center w-full py-4 rounded-xl bg-[#a0c81d] text-[#0f172a] font-black uppercase tracking-wide shadow-[0_0_20px_rgba(160,200,29,0.3)] hover:bg-[#b5e02e] hover:shadow-[0_0_30px_rgba(160,200,29,0.5)] transition-all group"
                    >
                        <Crown className="w-5 h-5 mr-2 fill-current" />
                        Bli Medlem
                        <ArrowRight className="w-4 h-4 ml-1 opacity-50 group-hover:translate-x-1 transition-transform" />
                    </Link>
                ) : (
                    <div className="flex items-center justify-center w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-bold uppercase tracking-wide">
                        <Crown className="w-4 h-4 mr-2" /> Premium Aktiv
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 group border border-transparent ${
                isActive(link.path) 
                  ? 'bg-[#a0c81d]/10 border-[#a0c81d]/20' 
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-4">
                <link.icon className={`w-5 h-5 ${isActive(link.path) ? 'text-[#a0c81d]' : 'text-slate-400 group-hover:text-white'}`} />
                <span className={`font-heading font-semibold tracking-wide ${isActive(link.path) ? 'text-[#a0c81d]' : 'text-slate-200 group-hover:text-white'}`}>
                  {link.label}
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform group-hover:translate-x-1 ${isActive(link.path) ? 'text-[#a0c81d]' : ''}`} />
            </Link>
          ))}

          <div className="mt-6 pt-6 border-t border-white/5 px-2">
             <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-2">Konto</p>
             {session ? (
               <>
                 <Link to="/profile" className="flex items-center gap-3 p-3 text-slate-400 hover:text-white transition-colors">
                    <Settings className="w-5 h-5" />
                    <span className="font-medium text-sm">Inställningar</span>
                 </Link>
                 <button 
                   onClick={handleSignOut}
                   className="w-full flex items-center gap-3 p-3 text-red-400 hover:text-red-300 transition-colors"
                 >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium text-sm">Logga ut</span>
                 </button>
               </>
             ) : (
               <Link to="/auth" className="flex items-center gap-3 p-3 text-[#a0c81d] hover:text-emerald-400 transition-colors">
                  <User className="w-5 h-5" />
                  <span className="font-medium text-sm">Logga in</span>
               </Link>
             )}
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0f172a]">
           <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 uppercase tracking-widest font-bold">
              <ShieldCheck className="w-3 h-3" /> Säker anslutning
           </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 z-40 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center h-[70px] px-2">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex flex-col items-center justify-center w-full h-full gap-1 transition-all group active:scale-95"
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${active ? '-translate-y-1' : ''}`}>
                   <link.icon 
                     className={`w-6 h-6 transition-colors duration-300 ${active ? 'text-[#a0c81d] fill-[#a0c81d]/10' : 'text-slate-400 group-hover:text-slate-200'}`} 
                     strokeWidth={active ? 2.5 : 2}
                   />
                   {active && (
                     <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#a0c81d] rounded-full shadow-[0_0_5px_#a0c81d]"></span>
                   )}
                </div>
                <span className={`text-[9px] font-bold tracking-widest font-condensed uppercase transition-colors ${active ? 'text-[#a0c81d]' : 'text-slate-500'}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Navbar;
