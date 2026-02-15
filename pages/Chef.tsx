
import React from 'react';
import { useAuthStore } from '../store/authStore';
import RecipeBank from '../components/RecipeBank'; 

export const Chef: React.FC = () => {
  const { session, profile } = useAuthStore();

  // Determine status
  const isPremium = profile?.membership_level === 'premium';
  // Check if user is logged in at all (for some basic features)
  const isAuthenticated = !!session;

  return (
    <div className="min-h-screen bg-[#0f172a] pb-20 animate-fade-in relative font-sans overflow-x-hidden text-slate-200">
       <RecipeBank isPremium={isPremium} isAuthenticated={isAuthenticated} /> 
    </div>
  );
};
