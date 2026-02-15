import React from 'react';
import { 
  ChefHat, 
  Utensils, 
  Database, 
  LayoutDashboard,
  Cpu,
  UserCircle
} from 'lucide-react';
import { AppRoute, UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  user: UserProfile | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentRoute, 
  onNavigate
}) => {
  
  const navItems = [
    { id: AppRoute.HOME, label: 'Hem', icon: LayoutDashboard },
    { id: AppRoute.CHEF, label: 'AI Kock', icon: ChefHat },
    { id: AppRoute.KITCHEN, label: 'Köket', icon: Utensils },
    { id: AppRoute.FOOD_HUB, label: 'Livsmedel', icon: Database },
    { id: AppRoute.HEALTH, label: 'Min Profil', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0 flex flex-col">
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onNavigate(AppRoute.HOME)}>
              <div className="bg-slate-900 rounded-lg p-1.5 shadow-md group-hover:scale-105 transition-transform">
                <div className="relative">
                   <Cpu className="w-6 h-6 text-emerald-400" />
                   <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                      <UserCircle className="w-1.5 h-1.5 text-emerald-600" />
                   </div>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tighter text-slate-900 font-heading">PTO <span className="text-emerald-500">Ai</span></span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    currentRoute === item.id 
                      ? 'text-emerald-600' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
               {/* No User/Logout buttons needed for Open Version */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 mt-auto pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center text-center">
           <p className="text-slate-400 text-sm font-medium mb-2">
             &copy; {new Date().getFullYear()} Private Training Online. Alla rättigheter förbehållna.
           </p>
           <a 
             href="https://privatetrainingonline.se/" 
             target="_blank" 
             rel="noopener noreferrer"
             className="text-xs font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
           >
             Besök PrivateTrainingOnline.se
           </a>
        </div>
      </footer>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 ${
              currentRoute === item.id ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <item.icon className={`w-6 h-6 ${currentRoute === item.id ? 'fill-current opacity-20' : ''}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};