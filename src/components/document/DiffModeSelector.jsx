import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlignJustify, SplitSquareVertical, Columns } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const STORAGE_KEY = 'consenz_diff_mode';

export const DIFF_MODES = {
  INLINE: 'inline',
  SPLIT: 'split',
  SIDE_BY_SIDE: 'side-by-side'
};

export function useDiffMode() {
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || DIFF_MODES.INLINE;
    }
    return DIFF_MODES.INLINE;
  });
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);
  
  return [mode, setMode];
}

export default function DiffModeSelector({ mode, onModeChange, size = "sm" }) {
  const { t, isRTL } = useLanguage();
  
  const modes = [
    { 
      id: DIFF_MODES.INLINE, 
      icon: AlignJustify, 
      label: 'Inline',
      title: 'תצוגה משולבת'
    },
    { 
      id: DIFF_MODES.SPLIT, 
      icon: SplitSquareVertical, 
      label: 'Split',
      title: 'תצוגה מפוצלת'
    },
    { 
      id: DIFF_MODES.SIDE_BY_SIDE, 
      icon: Columns, 
      label: 'Side',
      title: 'זה לצד זה'
    },
  ];
  
  return (
    <div className={`flex items-center bg-slate-100 rounded-lg p-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {modes.map(({ id, icon: Icon, label, title }) => (
        <Button
          key={id}
          variant="ghost"
          size={size}
          onClick={() => onModeChange(id)}
          className={`h-7 px-2 rounded-md transition-all ${
            mode === id 
              ? 'bg-white shadow-sm text-blue-600' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-transparent'
          }`}
          title={title}
        >
          <Icon className="w-3.5 h-3.5" />
        </Button>
      ))}
    </div>
  );
}