
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
import AuthScreen from './components/AuthScreen';
import PremiumPaywall from './components/PremiumPaywall';

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
              path="/intranet"
              element={
                <AuthGuard requireStaff>
                  <Intranet />
                </AuthGuard>
              }
            />

            <Route path="/auth" element={<AuthScreen />} />
            
            <Route path="/premium" element={<PageContainer><PremiumPaywall variant="premium" /></PageContainer>} />
            
          </Routes>
        </main>

        <Footer />
        
      </div>
    </Router>
  );
}

export default App;
