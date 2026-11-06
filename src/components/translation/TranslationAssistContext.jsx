import React, { createContext, useCallback, useContext, useState } from "react";

const STORAGE_KEY = "consenz_translation_assist";

const TranslationAssistContext = createContext(null);

export const useTranslationAssist = () =>
  useContext(TranslationAssistContext) || {
    assistEnabled: false,
    setAssistEnabled: () => {},
  };

/**
 * Holds the "help translate" mode. When off (the default), no suggestion
 * buttons are rendered anywhere in the app — they only appear after the user
 * explicitly turns the mode on from the sidebar.
 */
export default function TranslationAssistProvider({ children }) {
  const [assistEnabled, setAssistEnabledState] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const setAssistEnabled = useCallback((value) => {
    setAssistEnabledState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  return (
    <TranslationAssistContext.Provider value={{ assistEnabled, setAssistEnabled }}>
      {children}
    </TranslationAssistContext.Provider>
  );
}