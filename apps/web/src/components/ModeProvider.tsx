"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type AppMode = "arena" | "rate";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = "rateanything-mode";
const DEFAULT_MODE: AppMode = "arena";

function isValidMode(value: unknown): value is AppMode {
  return value === "arena" || value === "rate";
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidMode(stored)) {
        setModeState(stored);
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
    setHydrated(true);
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "arena" ? "rate" : "arena");
  }, [mode, setMode]);

  if (!hydrated) {
    return (
      <ModeContext.Provider value={{ mode: DEFAULT_MODE, setMode, toggleMode }}>
        {children}
      </ModeContext.Provider>
    );
  }

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
