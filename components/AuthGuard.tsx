
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requirePremium?: boolean;
  requireStaff?: boolean;
  requireManager?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requirePremium: _requirePremium = false,
  requireStaff = false,
  requireManager = false
}) => {
  const { session, profile, isLoading } = useAuthStore();
  const location = useLocation();
  const isStaff = profile?.is_staff === true;
  const isManager = profile?.is_manager === true;

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
    return <Navigate to="/auth-required" state={{ from: location }} replace />;
  }

  if (requireStaff && !isStaff) {
    return <Navigate to="/" replace />;
  }

  if (requireManager && !isManager) {
    return <Navigate to="/intranet" replace />;
  }

  if (!requireStaff && isStaff) {
    return <Navigate to="/intranet" replace />;
  }

  // 3. Allt grönt -> Visa innehållet
  return <>{children}</>;
};
