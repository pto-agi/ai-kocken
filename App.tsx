
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Loader2 } from 'lucide-react';
import { AuthGuard } from './components/AuthGuard';

// Sidor
import { Home } from './pages/Home';
import { Recipes } from './pages/Recipes';
import { Profile } from './pages/Profile';
import { Start } from './pages/Start';
import { Uppfoljning } from './pages/Uppfoljning';
import { Intranet } from './pages/Intranet';
import { Support } from './pages/Support';
import { Forlangning } from './pages/Forlangning';
import Refill from './pages/Refill';
import AuthScreen from './components/AuthScreen';
import PremiumAccess from './components/PremiumAccess';

const META_BY_PATH: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Medlemssidor',
    description: 'Samlad översikt för medlemmar med veckomeny, uppföljning, påfyllning och support. Se medlemskap, beställningar och genvägar med snabb överblick.'
  },
  '/recept': {
    title: 'Veckomeny',
    description: 'Skapa veckomeny med recept, inköpslista och makron. Anpassa efter mål, preferenser och budget, spara favoriter och exportera när du vill. Perfekt för veckans planering.'
  },
  '/support': {
    title: 'Support',
    description: 'Chatta med teamet och få snabb hjälp med kost, medlemskap och teknik. Vi guidar dig vidare, svarar på frågor och hjälper i appen när du behöver.'
  },
  '/profile': {
    title: 'Mina sidor',
    description: 'Hantera konto, medlemskap, adresser och sparade planer. Se premiumstatus, uppdatera leveransuppgifter och prenumerationer, allt samlat på ett ställe.'
  },
  '/start': {
    title: 'Startformulär',
    description: 'Fyll i startformuläret för att kalibrera mål, träningsnivå och preferenser. Ger mer relevanta veckomenyer och rekommendationer från dag ett. Tar bara några minuter.'
  },
  '/uppfoljning': {
    title: 'Uppföljning',
    description: 'Skicka in uppföljning av din period. Dela feedback, mål och träningsrutin så att nästa plan blir bättre och mer personlig, snabbt och enkelt. Tar bara någon minut.'
  },
  '/forlangning': {
    title: 'Förlängning',
    description: 'Förläng medlemskapet till klientpris. Välj period och betalningssätt, få tillgång till premium utan avbrott och fortsätt resan tryggt. Klientpris utan krångel.'
  },
  '/refill': {
    title: 'Påfyllning',
    description: 'Beställ kosttillskott till medlemspris. Välj produkter, ange leveransuppgifter och skicka beställning direkt, vi hanterar leveransen åt dig. Snabbt och smidigt.'
  },
  '/premium': {
    title: 'Premium',
    description: 'Premium ger full tillgång till AI‑recept, veckomenyer och uppföljning. Aktivera medlemskap, lås upp allt och få bättre stöd varje vecka. Perfekt för kontinuitet.'
  },
  '/auth': {
    title: 'Logga in',
    description: 'Logga in eller skapa konto för att använda PTO Ai. Spara planer, följ din utveckling, hantera medlemskap och få verktygen direkt. Säker inloggning med e-post.'
  },
  '/intranet': {
    title: 'Intranät',
    description: 'Personalens intranät för administration och uppföljning. Hantera ärenden, kundstatus och interna uppgifter i ett samlat gränssnitt för teamet.'
  }
};

const MetaManager = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = META_BY_PATH[pathname] || META_BY_PATH['/'];
    const title = `${meta.title} - PTOAi`;
    if (document.title !== title) {
      document.title = title;
    }

    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.setAttribute('name', 'description');
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute('content', meta.description);
  }, [pathname]);

  return null;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const StaffRedirect = () => {
  const { session, profile, isLoading } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!session) return;
    if (profile?.is_staff !== true) return;
    if (location.pathname === '/intranet') return;
    navigate('/intranet', { replace: true });
  }, [isLoading, session, profile?.is_staff, location.pathname, navigate]);

  return null;
};

const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-7xl mx-auto px-4 md:px-8 pb-24 text-slate-50 min-h-[60vh]">
    {children}
  </div>
);

function App() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 className="w-12 h-12 animate-spin text-[#a0c81d]" />
      </div>
    );
  }

  return (
    <Router>
      <MetaManager />
      <ScrollToTop />
      <StaffRedirect />
      <div className="min-h-screen bg-[#0f172a] text-slate-50 font-sans selection:bg-[#a0c81d] selection:text-[#0f172a] flex flex-col">
        
        <Navbar />

        <main className="pt-20 flex-grow flex flex-col">
          <Routes>
            <Route 
              path="/" 
              element={
                <Home />
              } 
            />

            <Route 
              path="/recept" 
              element={
                <AuthGuard requirePremium={false}>
                  <Recipes />
                </AuthGuard>
              } 
            />

            <Route 
              path="/support" 
              element={
                <AuthGuard requirePremium={false}>
                  <Support />
                </AuthGuard>
              } 
            />

            <Route 
              path="/profile" 
              element={
                <PageContainer>
                  <AuthGuard requirePremium={false}>
                    <Profile />
                  </AuthGuard>
                </PageContainer>
              } 
            />

            <Route
              path="/start"
              element={
                <AuthGuard requirePremium={false}>
                  <Start />
                </AuthGuard>
              }
            />

            <Route
              path="/uppfoljning"
              element={
                <AuthGuard requirePremium={false}>
                  <Uppfoljning />
                </AuthGuard>
              }
            />

            <Route
              path="/forlangning"
              element={<Forlangning />}
            />

            <Route
              path="/refill"
              element={
                <AuthGuard requirePremium={false}>
                  <Refill />
                </AuthGuard>
              }
            />

            <Route
              path="/intranet"
              element={
                <AuthGuard requireStaff>
                  <Intranet />
                </AuthGuard>
              }
            />

            <Route path="/auth" element={<AuthScreen />} />
            
            <Route path="/premium" element={<PageContainer><PremiumAccess mode="logged_out" /></PageContainer>} />
            
          </Routes>
        </main>

        <Footer />
        
      </div>
    </Router>
  );
}

export default App;
