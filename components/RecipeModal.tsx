import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Clock, Flame, ChefHat, Printer, Cpu, Activity } from 'lucide-react';

interface Recipe {
  title: string;
  content: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  time?: string;
}

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
}

const RecipeModal: React.FC<RecipeModalProps> = ({ recipe, onClose }) => {
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in print:p-0 print:bg-white print:static">
      
      {/* Modal Container - Dark/Premium Theme */}
      <div className="bg-[#1e293b] w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border border-white/10 print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:h-auto print:border-none print:bg-white">
        
        {/* --- HEADER --- */}
        <div className="relative bg-[#0f172a] p-8 shrink-0 border-b border-white/5 print:bg-white print:text-slate-900 print:p-0 print:border-b-2 print:border-slate-900 print:mb-8">
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white print:hidden"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 bg-[#a0c81d]/10 border border-[#a0c81d]/20 px-3 py-1 rounded-full text-[10px] font-black text-[#a0c81d] uppercase tracking-widest w-fit print:hidden">
                <ChefHat className="w-3 h-3" /> AI Chef Generated
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black font-heading leading-tight text-white print:text-slate-900">
                {recipe.title}
            </h2>
            
            {/* Macros Row */}
            <div className="flex flex-wrap gap-3 mt-2">
                {recipe.time && (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-slate-300 text-xs font-bold uppercase print:bg-slate-100 print:text-slate-700">
                    <Clock className="w-4 h-4 text-[#a0c81d]" /> {recipe.time}
                  </div>
                )}
                {recipe.calories && (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-slate-300 text-xs font-bold uppercase print:bg-slate-100 print:text-slate-700">
                    <Flame className="w-4 h-4 text-orange-500" /> {recipe.calories} kcal
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-slate-300 text-xs font-bold uppercase print:bg-slate-100 print:text-slate-700">
                    <Activity className="w-4 h-4 text-blue-400" /> P: <span className="text-white print:text-slate-900">{recipe.protein || '-'}g</span>
                </div>
            </div>
          </div>
        </div>

        {/* --- CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#1e293b] print:overflow-visible print:p-0 print:bg-white custom-scrollbar">
          <div className="prose prose-invert prose-lg max-w-none 
            prose-headings:font-black prose-headings:text-white 
            prose-p:text-slate-300 prose-p:leading-relaxed
            prose-li:text-slate-300 prose-li:marker:text-[#a0c81d]
            prose-strong:text-white prose-strong:font-bold
            print:prose-slate print:prose-headings:text-slate-900 print:prose-p:text-slate-700 print:prose-li:text-slate-700"
          >
            <ReactMarkdown components={{
                 h1: ({node, ...props}) => <h1 className="text-2xl font-black text-white mb-6 pb-4 border-b border-white/10" {...props} />,
                 li: ({node, ...props}) => <li className="flex items-start gap-2" {...props}><span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#a0c81d] shrink-0 block"/><span>{props.children}</span></li>
            }}>
              {recipe.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* --- ACTIONS FOOTER --- */}
        <div className="p-6 border-t border-white/5 bg-[#0f172a] flex justify-end gap-3 shrink-0 print:hidden">
           <button 
             onClick={handlePrint}
             className="flex items-center gap-2 px-6 py-3 bg-[#a0c81d] text-[#0f172a] rounded-xl font-black uppercase text-xs hover:bg-[#b5e02e] transition-all shadow-lg hover:-translate-y-1"
           >
             <Printer className="w-4 h-4" /> Spara som PDF
           </button>
        </div>

        {/* --- PRINT BRANDING FOOTER --- */}
        <div className="hidden print:flex flex-col items-center justify-center mt-12 pt-8 border-t-2 border-slate-100 text-center">
            <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-slate-900" />
                <span className="text-lg font-black text-slate-900 tracking-tighter">PTO Ai</span>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                Optimized Nutrition • Generated by Intelligence
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
                www.privatetrainingonline.se
            </p>
        </div>

      </div>
    </div>
  );
};

export default RecipeModal;