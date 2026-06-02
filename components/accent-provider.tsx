"use client"

import React, { createContext, useContext, useEffect, useState } from "react";

export type AccentColor = "default" | "blue" | "rose" | "violet" | "orange";

interface AccentContextType {
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
}

const AccentContext = createContext<AccentContextType | undefined>(undefined);

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>("default");

  useEffect(() => {
    const saved = localStorage.getItem("tvph-accent") as AccentColor;
    if (saved) {
      setAccentState(saved);
      document.documentElement.setAttribute("data-accent", saved);
    } else {
      document.documentElement.setAttribute("data-accent", "default");
    }
  }, []);

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    localStorage.setItem("tvph-accent", newAccent);
    document.documentElement.setAttribute("data-accent", newAccent);
  };

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent() {
  const context = useContext(AccentContext);
  if (!context) {
    throw new Error("useAccent must be used within an AccentProvider");
  }
  return context;
}
