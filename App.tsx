
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Loader2 } from 'lucide-react';
import { AuthGuard } from './components/AuthGuard';

const Home = React.lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Recipes = React.lazy(() => import('./pages/Recipes').then((module) => ({ default: module.Recipes })));
const Profile = React.lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })));
const Start = React.lazy(() => import('./pages/Start').then((module) => ({ default: module.Start })));
const StartTack = React.lazy(() => import('./pages/StartTack').then((module) => ({ default: module.StartTack })));
const Uppfoljning = React.lazy(() => import('./pages/Uppfoljning').then((module) => ({ default: module.Uppfoljning })));
const UppfoljningTack = React.lazy(() => import('./pages/UppfoljningTack').then((module) => ({ default: module.UppfoljningTack })));
const Intranet = React.lazy(() => import('./pages/Intranet').then((module) => ({ default: module.Intranet })));
const IntranetManager = React.lazy(() => import('./pages/IntranetManager').then((module) => ({ default: module.IntranetManager })));
const IntranetTodoist = React.lazy(() => import('./pages/IntranetTodoist').then((module) => ({ default: module.IntranetTodoist })));
const SalesCapital = React.lazy(() => import('./pages/SalesCapital').then((module) => ({ default: module.SalesCapital })));
const Support = React.lazy(() => import('./pages/Support').then((module) => ({ default: module.Support })));
const NpsSurvey = React.lazy(() => import('./pages/NpsSurvey').then((module) => ({ default: module.NpsSurvey })));
const ReferralPage = React.lazy(() => import('./pages/Referral').then((module) => ({ default: module.ReferralPage })));
const ReferralRegister = React.lazy(() => import('./pages/ReferralRegister').then((module) => ({ default: module.ReferralRegister })));
const Forlangning = React.lazy(() => import('./pages/Forlangning').then((module) => ({ default: module.Forlangning })));
const ForlangningFriskvardTack = React.lazy(() => import('./pages/ForlangningFriskvardTack').then((module) => ({ default: module.ForlangningFriskvardTack })));
const ForlangningTack = React.lazy(() => import('./pages/ForlangningTack').then((module) => ({ default: module.ForlangningTack })));

const Refill = React.lazy(() => import('./pages/Refill'));
const RefillTack = React.lazy(() => import('./pages/RefillTack').then((module) => ({ default: module.RefillTack })));
const AuthRequired = React.lazy(() => import('./pages/AuthRequired').then((module) => ({ default: module.AuthRequired })));
const Premium = React.lazy(() => import('./pages/Premium').then((module) => ({ default: module.Premium })));
const AuthScreen = React.lazy(() => import('./components/AuthScreen'));
const Checkout = React.lazy(() => import('./pages/Checkout').then((module) => ({ default: module.Checkout })));
const CheckoutSuccess = React.lazy(() => import('./pages/CheckoutSuccess').then((module) => ({ default: module.CheckoutSuccess })));

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
    title: 'Chatt',
    description: 'Chatt med teamet för snabb hjälp kring kost, medlemskap och teknik. Lanseras i mars 2026.'
  },
  '/profile': {
    title: 'Mina sidor',
    description: 'Dashboard för översikt, snabbåtgärder och genvägar. Se status, senaste inlämningar och din adminpanel för medlemskap och konto.'
  },
  '/start': {
    title: 'Startformulär',
    description: 'Skicka in startformulär med mål, kost och träningsvanor så att vi kan skapa din coach-plan. Tar ett par minuter.'
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
    description: 'Se ditt personliga erbjudande för att förlänga året ut. Bekräfta förlängning i steg och hantera betalningen separat med teamet.'
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
  '/intranet/todoist': {
    title: 'Intranät Todoist',
    description: 'Spegling av Todoist-projektet Ärenden för personal och manager. Hantera uppgifter, sektioner och status direkt i intranätet.'
  },
  '/sales-capital': {
    title: 'Sälj & Kapital',
    description: 'Power dashboard för försäljning, kapital och teamets momentum. Följ månadsmål, tillväxt och nyckeltal som driver fokus och avslut.'
  },
  '/checkout': {
    title: 'Bli medlem',
    description: 'Välj plan och starta din coaching med Private Training Online. Personlig coach, AI-recept och uppföljning — allt i en app.'
  },
  '/checkout/tack': {
    title: 'Tack för ditt köp',
    description: 'Din betalning är bekräftad. Nästa steg för att komma igång med Private Training Online.'
  },
  '/bli-klient': {
    title: 'Bli klient',
    description: 'Starta din resa med Private Training Online. Personlig coach, AI-drivna veckomenyer och skräddarsydd träning — allt i en app.'
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

const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12 md:pb-24 text-[#3D3D3D] min-h-[60vh]">
    {children}
  </div>
);

const RouteFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Loader2 className="w-10 h-10 animate-spin text-[#a0c81d]" />
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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ── Distraction-free checkout (no Navbar/Footer) ── */}
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/bli-klient" element={<Checkout />} />
          <Route path="/checkout/tack" element={<CheckoutSuccess />} />

          {/* ── Standard layout with Navbar + Footer ── */}
          <Route path="*" element={
            <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans selection:bg-[#a0c81d] selection:text-[#F6F1E7] flex flex-col">
              <Navbar />
              <main className="pt-20 flex-grow flex flex-col">
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route
                      path="/recept"
                      element={
                        <AuthGuard requirePremium={false}>
                          <Recipes />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/nps"
                      element={
                        <PageContainer>
                          <AuthGuard requirePremium={false}>
                            <NpsSurvey />
                          </AuthGuard>
                        </PageContainer>
                      }
                    />
                    <Route
                      path="/referral"
                      element={
                        <PageContainer>
                          <AuthGuard requirePremium={false}>
                            <ReferralPage />
                          </AuthGuard>
                        </PageContainer>
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
                      path="/profile/*"
                      element={
                        <PageContainer>
                          <AuthGuard requirePremium={false}>
                            <Profile />
                          </AuthGuard>
                        </PageContainer>
                      }
                    />
                    <Route path="/start" element={<Start />} />
                    <Route path="/start/tack" element={<StartTack />} />
                    <Route path="/uppfoljning" element={<Uppfoljning />} />
                    <Route path="/uppfoljning/tack" element={<UppfoljningTack />} />
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
                    <Route path="/refill" element={<Refill />} />
                    <Route path="/refill/tack" element={<RefillTack />} />
                    <Route
                      path="/intranet"
                      element={
                        <AuthGuard requireStaff>
                          <Intranet />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/intranet/manager"
                      element={
                        <AuthGuard requireStaff requireManager>
                          <IntranetManager />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/intranet/todoist"
                      element={
                        <AuthGuard requireStaff requireManager>
                          <IntranetTodoist />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/sales-capital"
                      element={
                        <AuthGuard requireStaff>
                          <SalesCapital />
                        </AuthGuard>
                      }
                    />
                    <Route path="/auth" element={<AuthScreen />} />
                    <Route path="/register" element={<ReferralRegister />} />
                    <Route path="/auth-required" element={<AuthRequired />} />
                    <Route
                      path="/premium"
                      element={<PageContainer><Premium /></PageContainer>}
                    />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          } />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
