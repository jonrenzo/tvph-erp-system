"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, Upload, ChevronDown, FileSpreadsheet } from "lucide-react";
import { ImportModal } from "@/components/dashboard/import-modal";
import { useImport } from "@/components/dashboard/import-context";

type Props = {
  title: string;
  exportBaseUrl: string;
  importAction: (formData: FormData) => Promise<any>;
};

export function ImportExportButtons({ title, exportBaseUrl, importAction }: Props) {
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [preloadedFile, setPreloadedFile] = useState<File | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const { triggerRequest, clearTrigger } = useImport();

  // Watch for external trigger from AI chat
  useEffect(() => {
    if (triggerRequest && triggerRequest.title === title) {
      setPreloadedFile(triggerRequest.file);
      setShowImport(true);
      clearTrigger();
    }
  }, [triggerRequest, title, clearTrigger]);

  const handleClose = useCallback(() => {
    setShowImport(false);
    setPreloadedFile(null);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>

        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExport(!showExport)}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className={`h-4 w-4 transition-transform ${showExport ? "rotate-180" : ""}`} />
          </button>

          {showExport && (
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <a
                href={`${exportBaseUrl}?format=csv`}
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Export as CSV
              </a>
              <a
                href={`${exportBaseUrl}?format=xlsx`}
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                Export as Excel
              </a>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <ImportModal
          title={title}
          action={importAction}
          onClose={handleClose}
          preloadedFile={preloadedFile}
        />
      )}
    </>
  );
}
