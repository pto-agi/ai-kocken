import React from 'react';
import { UserData, Gender, ActivityLevel, Goal } from '../types';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../constants';
import { User, Activity, Target, Settings2, RefreshCw } from 'lucide-react';

interface InputFormProps {
  data: UserData;
  onChange: (data: UserData) => void;
  onCalculate: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ data, onChange, onCalculate }) => {
  
  const handleChange = <K extends keyof UserData>(key: K, value: UserData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const handleMacroChange = (key: 'protein' | 'carbs' | 'fats', value: number) => {
    const newSplit = { ...data.macroSplit!, [key]: value };
    handleChange('macroSplit', newSplit);
  };

  const totalMacroPercentage = (data.macroSplit?.protein || 0) + (data.macroSplit?.carbs || 0) + (data.macroSplit?.fats || 0);
  const isMacroInvalid = data.useCustomMacros && totalMacroPercentage !== 100;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6 h-fit no-print border border-slate-100">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
        <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
        <h2 className="text-xl font-bold text-slate-800 font-mono uppercase tracking-wide">PROFIL</h2>
      </div>
      
      {/* Gender */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleChange('gender', Gender.MALE)}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
            data.gender === Gender.MALE 
              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-inner' 
              : 'border-slate-100 hover:border-emerald-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          <User className="w-8 h-8 mb-2" />
          <span className="font-bold text-sm uppercase tracking-wide">Man</span>
        </button>
        <button
          onClick={() => handleChange('gender', Gender.FEMALE)}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
            data.gender === Gender.FEMALE 
              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-inner' 
              : 'border-slate-100 hover:border-emerald-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          <User className="w-8 h-8 mb-2" />
          <span className="font-bold text-sm uppercase tracking-wide">Kvinna</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Age */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Ålder</label>
          <input
            type="number"
            value={data.age || ''}
            placeholder="0"
            onChange={(e) => handleChange('age', parseInt(e.target.value) || 0)}
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-lg focus:ring-0 focus:border-emerald-500 outline-none transition font-mono font-bold text-slate-800 placeholder:text-slate-300"
            min="10"
            max="120"
          />
        </div>

        {/* Height */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            Längd (cm)
          </label>
          <input
            type="number"
            value={data.height || ''}
            placeholder="0"
            onChange={(e) => handleChange('height', parseInt(e.target.value) || 0)}
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-lg focus:ring-0 focus:border-emerald-500 outline-none transition font-mono font-bold text-slate-800 placeholder:text-slate-300"
            min="100"
            max="250"
          />
        </div>

        {/* Weight */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            Vikt (kg)
          </label>
          <input
            type="number"
            value={data.weight || ''}
            placeholder="0"
            onChange={(e) => handleChange('weight', parseInt(e.target.value) || 0)}
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-lg focus:ring-0 focus:border-emerald-500 outline-none transition font-mono font-bold text-slate-800 placeholder:text-slate-300"
            min="30"
            max="300"
          />
        </div>
      </div>

      {/* Activity Level */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
           Aktivitetsnivå
        </label>
        <div className="relative">
          <select
            value={data.activityLevel}
            onChange={(e) => handleChange('activityLevel', e.target.value as ActivityLevel)}
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-lg appearance-none focus:ring-0 focus:border-emerald-500 outline-none transition cursor-pointer font-medium text-slate-700"
          >
            {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-emerald-600">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Goal */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
           Målsättning
        </label>
        <div className="relative">
          <select
            value={data.goal}
            onChange={(e) => handleChange('goal', e.target.value as Goal)}
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-lg appearance-none focus:ring-0 focus:border-emerald-500 outline-none transition cursor-pointer font-medium text-slate-700"
          >
             {Object.entries(GOAL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-emerald-600">
            <Target className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Custom Macros Toggle */}
      <div className="pt-2 border-t border-slate-100 mt-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center">
            <input 
              type="checkbox" 
              checked={data.useCustomMacros} 
              onChange={(e) => handleChange('useCustomMacros', e.target.checked)}
              className="peer sr-only" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800"></div>
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2 group-hover:text-emerald-600 transition">
            <Settings2 className="w-4 h-4" /> Anpassa makrofördelning
          </span>
        </label>
      </div>

      {/* Custom Macros Inputs */}
      {data.useCustomMacros && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fade-in-up">
           <div className="grid grid-cols-3 gap-4">
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Protein %</label>
               <input 
                  type="number" 
                  value={data.macroSplit?.protein} 
                  onChange={(e) => handleMacroChange('protein', parseInt(e.target.value) || 0)}
                  className="w-full p-2 border rounded bg-white text-center font-bold font-mono text-slate-700 focus:ring-0 focus:border-emerald-500 outline-none"
               />
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Kolhydrater %</label>
               <input 
                  type="number" 
                  value={data.macroSplit?.carbs} 
                  onChange={(e) => handleMacroChange('carbs', parseInt(e.target.value) || 0)}
                  className="w-full p-2 border rounded bg-white text-center font-bold font-mono text-slate-700 focus:ring-0 focus:border-blue-500 outline-none"
               />
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Fett %</label>
               <input 
                  type="number" 
                  value={data.macroSplit?.fats} 
                  onChange={(e) => handleMacroChange('fats', parseInt(e.target.value) || 0)}
                  className="w-full p-2 border rounded bg-white text-center font-bold font-mono text-slate-700 focus:ring-0 focus:border-amber-500 outline-none"
               />
             </div>
           </div>
           {isMacroInvalid && (
             <p className="text-red-500 text-xs mt-2 font-medium text-center bg-red-50 p-1 rounded">
               Totalen måste bli 100% (Just nu: {totalMacroPercentage}%)
             </p>
           )}
        </div>
      )}

      <button
        onClick={onCalculate}
        disabled={isMacroInvalid}
        className={`w-full text-slate-900 font-black uppercase tracking-widest text-sm py-4 px-6 rounded-xl transition duration-300 shadow-lg transform mt-4 flex items-center justify-center gap-2 ${
          isMacroInvalid 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
            : 'bg-emerald-400 hover:bg-emerald-300 hover:shadow-emerald-500/30 hover:-translate-y-1 active:translate-y-0'
        }`}
      >
        <RefreshCw className="w-4 h-4 stroke-[3]" />
        UPPDATERA
      </button>
    </div>
  );
};

export default InputForm;