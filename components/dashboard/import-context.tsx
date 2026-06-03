"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ImportRequest = {
  title: string;
  file: File;
};

type ImportContextValue = {
  triggerRequest: ImportRequest | null;
  triggerImport: (title: string, file: File) => void;
  clearTrigger: () => void;
};

const ImportContext = createContext<ImportContextValue | null>(null);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [triggerRequest, setTriggerRequest] = useState<ImportRequest | null>(null);

  const triggerImport = useCallback((title: string, file: File) => {
    setTriggerRequest({ title, file });
  }, []);

  const clearTrigger = useCallback(() => {
    setTriggerRequest(null);
  }, []);

  return (
    <ImportContext.Provider value={{ triggerRequest, triggerImport, clearTrigger }}>
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImport must be used within ImportProvider");
  return ctx;
}
