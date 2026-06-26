"use client";

import { X, FileText, Download, ShieldAlert, CheckCircle2, Lock, ExternalLink, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { DocumentPreview } from "./document-preview";
import { isAdminOrAbove } from "@/lib/auth/roles";

interface VendorDocument {
  id: string;
  status: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  expiry_date: string | null;
}

interface DocumentDrawerProps {
  vendor: any;
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

const SENSITIVE_DOCS = ['audited_financial_statements', 'vendor_information_summary', 'sec_registration'];

export function DocumentDrawer({ vendor, isOpen, onClose, userRole }: DocumentDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<VendorDocument | null>(null);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!mounted || !vendor) return null;

  const isStaff = isAdminOrAbove(userRole) || userRole === 'finance';
  const documents = vendor.vendor_documents || [];

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 z-[var(--z-drawer-backdrop)] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-[var(--z-drawer)] w-full max-w-xl bg-white dark:bg-[#071F15] shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-500 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {vendor.name.substring(0, 2).toUpperCase()}
                 </div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                   {vendor.name}
                 </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-widest ml-1">
                Vendor Records Repository
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {documents.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                 <FileText className="h-12 w-12 text-slate-300" />
                 <p className="text-sm font-medium text-slate-500">No documents uploaded for this vendor.</p>
              </div>
            ) : (
              documents.map((doc: VendorDocument) => {
                const isSensitive = SENSITIVE_DOCS.includes(doc.doc_type);
                const hasAccess = !isSensitive || isStaff;

                return (
                  <div 
                    key={doc.id}
                    className={`group relative p-4 rounded-2xl border transition-all ${
                      hasAccess 
                        ? 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-primary/50' 
                        : 'bg-slate-50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800/50 grayscale'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                          hasAccess ? 'bg-primary/5 text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {hasAccess ? <FileText className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${hasAccess ? 'text-slate-900 dark:text-white' : 'text-slate-400 font-medium italic'}`}>
                            {hasAccess ? doc.doc_type.replace(/_/g, ' ').toUpperCase() : 'Sensitive Information Restricted'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                              doc.status === 'approved' ? 'text-emerald-500' : 
                              doc.status === 'expired' ? 'text-rose-500' : 'text-amber-500'
                            }`}>
                              {doc.status}
                            </span>
                            {doc.expiry_date && (
                              <span className="text-[10px] text-slate-400 font-medium italic">
                                • Exp: {new Date(doc.expiry_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasAccess && doc.file_url && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setPreviewDoc(doc)}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                            title="Quick Peek"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                            title="Download"
                          >
                            <Download className="h-5 w-5" />
                          </a>
                        </div>
                      )}
                    </div>

                    {!hasAccess && (
                      <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5 ml-1">
                        <ShieldAlert className="h-3 w-3" />
                        <span>Only Admin or Finance can view this record.</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
             <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                <ExternalLink className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-primary/80 leading-relaxed font-medium">
                  To update or upload new documents for this vendor, please navigate to the <strong>Vendors List</strong> and select <strong>Edit Vendor</strong>.
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <DocumentPreview 
          document={previewDoc} 
          onClose={() => setPreviewDoc(null)} 
        />
      )}
    </>
  );
}
