"use client";

import { X, FileText, Download, Eye, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { DocumentPreview } from "./document-preview";

interface CompanyFolderViewProps {
  category: string;
  documents: any[];
  onClose: () => void;
}

export function CompanyFolderView({ category, documents, onClose }: CompanyFolderViewProps) {
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDocs = documents.filter(d => 
    d.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-[#071F15] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
          
          {/* Header */}
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex items-center gap-4">
               <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-8 w-8" />
               </div>
               <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight capitalize">
                    {category.replace(/_/g, ' ')} Library
                  </h2>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                    Internal Company Documents
                  </p>
               </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-8 py-4 bg-white dark:bg-[#071F15] border-b border-slate-100 dark:border-slate-800">
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search in ${category}...`}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
             </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-8 pt-4">
            {filteredDocs.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                 <FileText className="h-16 w-16 text-slate-300 mb-4" />
                 <p className="text-base font-bold text-slate-400">No documents found in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDocs.map((doc) => (
                  <div 
                    key={doc.id}
                    className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-4 truncate">
                      <div className="h-12 w-12 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {doc.label || doc.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
                          {doc.file_name?.split('.').pop() || 'PDF'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                         onClick={() => setPreviewDoc(doc)}
                         className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-slate-200 dark:border-slate-800"
                       >
                         <Eye className="h-4 w-4" />
                       </button>
                       <a 
                         href={doc.file_url}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-slate-200 dark:border-slate-800"
                       >
                         <Download className="h-4 w-4" />
                       </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewDoc && (
        <DocumentPreview 
          document={{
            file_url: previewDoc.file_url,
            file_name: previewDoc.file_name,
            doc_type: previewDoc.doc_type || 'Internal Document'
          }}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}
