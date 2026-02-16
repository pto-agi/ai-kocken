import React from 'react';
import WeeklyPlanner from '../components/WeeklyPlanner';

export const Recipes: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0f172a] pb-20 animate-fade-in relative font-sans overflow-x-hidden text-slate-200">
      <WeeklyPlanner />
    </div>
  );
};
