import { create } from 'zustand';
import { RecipeIdea } from '../types';

interface RecipeState {
  // Data
  ideas: RecipeIdea[];
  generatedRecipeContent: string | null;
  selectedIdea: RecipeIdea | null;
  
  // Status
  isGenerating: boolean;
  isWritingRecipe: boolean;
  error: string | null;

  // Persisted Inputs
  preferences: {
    styles: string[];
    nutrition: string[];
    pantryInput: string;
  };

  // Actions
  setIdeas: (ideas: RecipeIdea[]) => void;
  setGeneratedRecipeContent: (content: string | null) => void;
  setSelectedIdea: (idea: RecipeIdea | null) => void;
  setGenerating: (isGenerating: boolean) => void;
  setWriting: (isWriting: boolean) => void;
  setError: (error: string | null) => void;
  
  updatePreferences: (updates: Partial<RecipeState['preferences']>) => void;
  reset: () => void;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  ideas: [],
  generatedRecipeContent: null,
  selectedIdea: null,
  
  isGenerating: false,
  isWritingRecipe: false,
  error: null,

  preferences: {
    styles: [],
    nutrition: [],
    pantryInput: ''
  },

  setIdeas: (ideas) => set({ ideas, error: null }),
  setGeneratedRecipeContent: (content) => set({ generatedRecipeContent: content, error: null }),
  setSelectedIdea: (idea) => set({ selectedIdea: idea }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setWriting: (isWriting) => set({ isWritingRecipe: isWriting }),
  setError: (error) => set({ error }),

  updatePreferences: (updates) => set((state) => ({
    preferences: { ...state.preferences, ...updates }
  })),

  reset: () => set({
    ideas: [],
    generatedRecipeContent: null,
    selectedIdea: null,
    error: null,
    isGenerating: false,
    isWritingRecipe: false
  })
}));