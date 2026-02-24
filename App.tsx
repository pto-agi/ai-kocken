
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
import { StartTack } from './pages/StartTack';
import { Uppfoljning } from './pages/Uppfoljning';
import { UppfoljningTack } from './pages/UppfoljningTack';
import { Intranet } from './pages/Intranet';
import { Support } from './pages/Support';
import { Forlangning } from './pages/Forlangning';
import { ForlangningFriskvardTack } from './pages/ForlangningFriskvardTack';
import { ForlangningTack } from './pages/ForlangningTack';
import { Changelog } from './pages/Changelog';
import Refill from './pages/Refill';
import { RefillTack } from './pages/RefillTack';
import { AuthRequired } from './pages/AuthRequired';
import { Premium } from './pages/Premium';
import AuthScreen from './components/AuthScreen';

const META_BY_PATH: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Medlemssidor',
    description: 'Samlad översikt för medlemmar med veckomeny, uppföljning, Shop och support. Se medlemskap, beställningar och genvägar med snabb överblick.'
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
  '/start/tack': {
    title: 'Startformulär Mottaget',
    description: 'Bekräftelse på mottagen startinlämning. Vi återkopplar med planering och inbjudan via e-post.'
  },
  '/uppfoljning': {
    title: 'Uppföljning',
    description: 'Skicka in uppföljning av din period. Dela feedback, mål och träningsrutin så att nästa plan blir bättre och mer personlig, snabbt och enkelt. Tar bara någon minut.'
  },
  '/uppfoljning/tack': {
    title: 'Uppföljning Mottagen',
    description: 'Bekräftelse på mottagen uppföljning. Vi använder din feedback i nästa planering och återkopplar när allt är klart.'
  },
  '/forlangning': {
    title: 'Förlängning',
    description: 'Förläng medlemskapet till klientpris. Välj period och betalningssätt, få tillgång till premium utan avbrott och fortsätt resan tryggt. Klientpris utan krångel.'
  },
  '/tack-forlangning': {
    title: 'Förlängning Mottagen',
    description: 'Bekräftelse på mottagen förlängning. Ditt medlemskap uppdateras och du behåller klientpriser utan avbrott.'
  },
  '/tack-forlangning-friskvard': {
    title: 'Friskvårdsbetalning',
    description: 'Instruktioner för att slutföra betalningen via friskvårdsportal och aktivera förlängningen.'
  },
  '/refill': {
    title: 'Shop',
    description: 'Beställ kosttillskott till medlemspris. Välj produkter, ange leveransuppgifter och skicka beställning direkt, vi hanterar leveransen åt dig. Snabbt och smidigt.'
  },
  '/refill/tack': {
    title: 'Beställning Mottagen',
    description: 'Bekräftelse på mottagen beställning med summering och leveransinformation.'
  },
  '/premium': {
    title: 'Premium',
    description: 'Premium ger full tillgång till AI‑recept, veckomenyer och uppföljning. Aktivera medlemskap, lås upp allt och få bättre stöd varje vecka. Perfekt för kontinuitet.'
  },
  '/auth': {
    title: 'Logga in',
    description: 'Logga in eller skapa konto för att använda My PTO. Spara planer, följ din utveckling, hantera medlemskap och få verktygen direkt. Säker inloggning med e-post.'
  },
  '/auth-required': {
    title: 'Inloggning krävs',
    description: 'Denna sida kräver inloggning. Logga in eller skapa konto för att fortsätta.'
  },
  '/intranet': {
    title: 'Intranät',
    description: 'Personalens intranät för administration och uppföljning. Hantera ärenden, kundstatus och interna uppgifter i ett samlat gränssnitt för teamet.'
  },
  '/changelog': {
    title: 'Changelog',
    description: 'Samlad ändringslogg för appen, automatiskt uppdaterad vid push till GitHub.'
  }
};

const MetaManager = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = META_BY_PATH[pathname] || META_BY_PATH['/'];
    const title = `${meta.title} - My PTO`;
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
  <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12 md:pb-24 text-[#3D3D3D] min-h-[60vh]">
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
      <div className="min-h-screen flex items-center justify-center bg-[#F6F1E7]">
        <Loader2 className="w-12 h-12 animate-spin text-[#a0c81d]" />
      </div>
    );
  }

  return (
    <Router>
      <MetaManager />
      <ScrollToTop />
      <StaffRedirect />
      <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans selection:bg-[#a0c81d] selection:text-[#F6F1E7] flex flex-col">
        
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
              path="/start/tack"
              element={
                <AuthGuard requirePremium={false}>
                  <StartTack />
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
              path="/uppfoljning/tack"
              element={
                <AuthGuard requirePremium={false}>
                  <UppfoljningTack />
                </AuthGuard>
              }
            />

            <Route
              path="/forlangning"
              element={
                <AuthGuard requirePremium={false}>
                  <Forlangning />
                </AuthGuard>
              }
            />
            <Route
              path="/tack-forlangning"
              element={
                <AuthGuard requirePremium={false}>
                  <ForlangningTack />
                </AuthGuard>
              }
            />
            <Route
              path="/tack-forlangning-friskvard"
              element={
                <AuthGuard requirePremium={false}>
                  <ForlangningFriskvardTack />
                </AuthGuard>
              }
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
              path="/refill/tack"
              element={
                <AuthGuard requirePremium={false}>
                  <RefillTack />
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

            <Route
              path="/changelog"
              element={
                <AuthGuard requirePremium={false}>
                  <Changelog />
                </AuthGuard>
              }
            />

            <Route path="/auth" element={<AuthScreen />} />
            <Route path="/auth-required" element={<AuthRequired />} />
            
            <Route
              path="/premium"
              element={
                <AuthGuard requirePremium={false}>
                  <PageContainer><Premium /></PageContainer>
                </AuthGuard>
              }
            />
            
          </Routes>
        </main>

        <Footer />
        
      </div>
    </Router>
  );
}

export default App;
