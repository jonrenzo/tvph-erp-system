"use client";

import { X, FileText, Download, Eye, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DocumentPreview } from "./document-preview";

const DOC_LABELS: Record<string, string> = {
  official_receipt: "Official Receipt",
  specimen_signature: "Specimen Signature",
  valid_id: "Valid ID",
};

interface CustomerDocument {
  id: string;
  status: string;
  doc_type: string;
  label?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  expiry_date?: string | null;
}

interface CustomerDocumentDrawerProps {
  customer: { id: string; company_name: string; crm_documents: CustomerDocument[] } | undefined;
  isOpen: boolean;
  onClose: () => void;
}

function docLabel(doc: CustomerDocument) {
  if (doc.label) return doc.label;
  return DOC_LABELS[doc.doc_type] ?? doc.doc_type.replace(/_/g, " ").toUpperCase();
}

export function CustomerDocumentDrawer({ customer, isOpen, onClose }: CustomerDocumentDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = isOpen ? "hidden" : "unset";
  }, [isOpen]);

  if (!mounted || !customer) return null;

  const documents = customer.crm_documents ?? [];

  return (
    <>
      <div
        className={`fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-[120] w-full max-w-xl bg-white dark:bg-[#071F15] shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-500 ease-in-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                  {customer.company_name.substring(0, 2).toUpperCase()}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                  {customer.company_name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-widest ml-1">
                Customer Records Repository
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
                <p className="text-sm font-medium text-slate-500">No documents uploaded for this customer.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative p-4 rounded-2xl border bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/5 text-primary">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {docLabel(doc)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest ${
                              doc.status === "approved"
                                ? "text-emerald-500"
                                : doc.status === "expired"
                                ? "text-rose-500"
                                : "text-amber-500"
                            }`}
                          >
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

                    {doc.file_url && (
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
                          title="Open file"
                        >
                          <Download className="h-5 w-5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
              <ExternalLink className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-primary/80 leading-relaxed font-medium">
                To upload or manage documents for this customer, visit the{" "}
                <Link
                  href={`/dashboard/crm/${customer.id}?tab=documents`}
                  className="underline font-bold"
                >
                  Customer Profile
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      {previewDoc && (
        <DocumentPreview
          document={previewDoc as any}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}
