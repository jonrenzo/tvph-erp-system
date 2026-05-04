"use client";

import { X, Download, ExternalLink, Loader2, FileText } from "lucide-react";
import { useState, useEffect } from "react";

interface DocumentPreviewProps {
  document: {
    file_url: string;
    file_name: string;
    doc_type: string;
  };
  onClose: () => void;
}

export function DocumentPreview({ document: doc, onClose }: DocumentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_url || doc.file_name || "");
  const isOffice = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(doc.file_url || doc.file_name || "");
  const isPdf = /\.(pdf)$/i.test(doc.file_url || doc.file_name || "");

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Blob Intercept Logic
  useEffect(() => {
    let active = true;
    let objectUrl = '';

    if (isOffice) {
      setBlobUrl(`https://docs.google.com/gview?url=${encodeURIComponent(doc.file_url)}&embedded=true`);
      return;
    }

    if (isImage) {
      setBlobUrl(doc.file_url);
      return;
    }

    // For PDFs, fetch and strictly type as application/pdf to bypass download reflex
    const fetchAndTypeBlob = async () => {
      try {
        const res = await fetch(doc.file_url);
        if (!res.ok) throw new Error('Fetch failed');
        
        const rawBlob = await res.blob();
        // Force the browser to recognize this as a PDF regardless of server headers
        const typedBlob = new Blob([rawBlob], { type: 'application/pdf' });
        
        objectUrl = URL.createObjectURL(typedBlob);
        if (active) setBlobUrl(`${objectUrl}#toolbar=0`);
      } catch (err) {
        console.warn('Blob intercept failed (likely CORS). Falling back to raw URL:', err);
        if (active) setBlobUrl(`${doc.file_url}#toolbar=0`);
      }
    };

    fetchAndTypeBlob();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.file_url, isOffice, isImage]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full h-full max-w-6xl flex flex-col bg-white dark:bg-[#071F15] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Top Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-5 w-5" />
             </div>
             <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight leading-none">
                  {doc.doc_type.replace(/_/g, ' ').toUpperCase()}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium truncate max-w-[200px] md:max-w-md">
                  {doc.file_name}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={doc.file_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </a>
            <a 
              href={doc.file_url} 
              download
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <div className="w-px h-6 bg-slate-200 dark:border-slate-800 mx-1" />
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 relative overflow-hidden flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-100 dark:bg-slate-950 z-10">
               <Loader2 className="h-8 w-8 text-primary animate-spin" />
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Preview...</p>
            </div>
          )}

          {isImage ? (
            <img 
              src={blobUrl || doc.file_url} 
              alt={doc.file_name}
              className="max-w-full max-h-full object-contain p-4 shadow-2xl"
              onLoad={() => setIsLoading(false)}
            />
          ) : blobUrl ? (
            <iframe 
              src={blobUrl}
              className="w-full h-full border-none"
              onLoad={() => setIsLoading(false)}
              title="Document Preview"
            />
          ) : null}
        </div>

        {/* Mobile Action Bar */}
        <div className="md:hidden p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center bg-white dark:bg-[#0a0a0a]">
           <a 
              href={doc.file_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary font-bold text-xs"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </a>
        </div>
      </div>
    </div>
  );
}
