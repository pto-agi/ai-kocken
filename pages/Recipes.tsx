import React from 'react';
import WeeklyPlanner from '../components/WeeklyPlanner';

export const Recipes: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F6F1E7] pb-20 animate-fade-in relative font-sans overflow-x-hidden text-[#3D3D3D]">
      <WeeklyPlanner />
    </div>
  );
};
