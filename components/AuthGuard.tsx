
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import PremiumAccess from './PremiumAccess';

interface AuthGuardProps {
  children: React.ReactNode;
  requirePremium?: boolean;
  requireStaff?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requirePremium = false,
  requireStaff = false
}) => {
  const { session, profile, isLoading } = useAuthStore();
  const location = useLocation();
  const isStaff = profile?.is_staff === true;

  // 1. Laddar profil/session
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Om användaren är helt UTLOGGAD
  if (!session) {
    // Om sidan är en "Premium-sida" (t.ex. Kocken), visa den säljande Paywallen
    if (requirePremium) {
      return <PremiumAccess mode="logged_out" />;
    }
    // Redirect to /auth for consistent login experience
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireStaff && !isStaff) {
    return <Navigate to="/" replace />;
  }

  if (!requireStaff && isStaff) {
    return <Navigate to="/intranet" replace />;
  }

  // 3. Om inloggad men saknar Premium (på en sida som kräver det)
  if (requirePremium && profile?.membership_level !== 'premium') {
    return (
      <PremiumAccess 
        mode="locked"
        title="Premiuminnehåll" 
        description="Denna funktion är exklusiv för våra Premium-medlemmar. Uppgradera för att få tillgång."
      />
    );
  }

  // 4. Allt grönt -> Visa innehållet
  return <>{children}</>;
};
