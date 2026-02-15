
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Clock, Flame, ChefHat, ArrowLeft, Heart, Check, Loader2 
} from 'lucide-react';

interface RecipeCardProps {
  recipe: any;
  onAddToShoppingList?: (ingredients: string[]) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  isShopping?: boolean;
  isPremium: boolean;
  showSaveSuccess: boolean;
  showShoppingSuccess?: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ 
  recipe, onSave, onClose, isSaving, showSaveSuccess 
}) => {
  
  const title = recipe.title || "Ditt Recept";
  const content = typeof recipe === 'string' ? recipe : (recipe.content || recipe.instructions || "");
  const time = recipe.meta?.time || "Enligt recept";
  const kcal = recipe.meta?.kcal || "";

  return (
    <div className="bg-white h-full flex flex-col relative animate-fade-in">
        {/* Header Bar - Sticky & High Z-Index ensures visibility over content */}
        <div className="flex flex-wrap items-center justify-between p-4 md:p-6 border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <button 
                onClick={onClose} 
                className="flex items-center gap-2 text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-colors active:scale-95"
            >
                <ArrowLeft className="w-4 h-4" /> Tillbaka
            </button>

            <div className="flex items-center gap-3">
                <button 
                    onClick={onSave}
                    disabled={isSaving || showSaveSuccess}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 ${
                        showSaveSuccess 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-[#0f172a] text-white hover:bg-slate-800'
                    }`}
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : showSaveSuccess ? (
                        <><Check className="w-4 h-4" /> Sparat</>
                    ) : (
                        <><Heart className="w-4 h-4" /> Spara</>
                    )}
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-16 pb-32">
            <div className="max-w-4xl mx-auto">
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-4">
                        <ChefHat className="w-3 h-3" /> PTO Ai Chef
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 font-heading tracking-tight leading-tight">
                        {title}
                    </h1>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg text-slate-500 text-xs font-bold uppercase">
                            <Clock className="w-4 h-4" /> {time}
                        </div>
                        {kcal && (
                            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg text-amber-600 text-xs font-bold uppercase">
                                <Flame className="w-4 h-4" /> {kcal} kcal
                            </div>
                        )}
                    </div>
                </div>

                <div className="prose prose-slate prose-lg max-w-none 
                    prose-headings:font-black prose-headings:text-slate-900 
                    prose-h2:text-xl prose-h2:bg-[#a0c81d] prose-h2:inline-block prose-h2:px-4 prose-h2:py-1.5 prose-h2:rounded-lg prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-white prose-h2:transform prose-h2:rotate-[-1deg]
                    prose-ul:grid prose-ul:grid-cols-1 md:prose-ul:grid-cols-2 prose-ul:gap-x-12 prose-ul:gap-y-3 prose-ul:list-none prose-ul:p-8 prose-ul:bg-slate-50 prose-ul:rounded-3xl prose-ul:border prose-ul:border-slate-100 prose-ul:my-10
                    prose-li:flex prose-li:items-start prose-li:gap-3 prose-li:text-slate-700 prose-li:text-base prose-li:py-1 prose-li:font-medium prose-li:before:content-none
                ">
                    <ReactMarkdown components={{
                        li: ({node, ...props}) => <li {...props}><span className="mt-2 w-2 h-2 bg-[#a0c81d] rounded-full shrink-0 block" /><span>{props.children}</span></li>,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#a0c81d] pl-6 italic text-slate-500 bg-gradient-to-r from-slate-50 to-white p-6 rounded-r-2xl my-12" {...props} />
                    }}>
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    </div>
  );
};
