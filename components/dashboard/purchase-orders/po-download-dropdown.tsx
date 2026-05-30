"use client";

import { useState, useRef, useEffect } from "react";
import { FileDown, FileText, ChevronDown } from "lucide-react";

export function PODownloadDropdown({ poId }: { poId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
      >
        <FileDown className="h-4 w-4" />
        Download
        <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <a
            href={`/api/purchase-orders/${poId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="h-4 w-4 text-red-500" />
            PDF Document
          </a>
          <a
            href={`/api/purchase-orders/${poId}/docx`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="h-4 w-4 text-blue-500" />
            DOCX Document
          </a>
        </div>
      )}
    </div>
  );
}
