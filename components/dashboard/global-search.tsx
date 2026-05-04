"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
import { Search, Building2, ClipboardList, Receipt, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { globalSearch } from "@/app/dashboard/search/actions";

interface SearchResults {
  vendors: any[];
  pos: any[];
  invoices: any[];
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResults>({ vendors: [], pos: [], invoices: [] });
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      startTransition(async () => {
        const data = await globalSearch(debouncedQuery);
        setResults(data);
      });
    } else {
      setResults({ vendors: [], pos: [], invoices: [] });
    }
  }, [debouncedQuery]);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(path);
  };

  const hasResults = results.vendors.length > 0 || results.pos.length > 0 || results.invoices.length > 0;

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-[#0a0a0a]/50 px-3 py-1.5 md:flex text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm flex-1 text-left">Search everything...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-500">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Mobile Search Icon */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Search Modal */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop click closer */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#071F15] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-8 duration-200">
            {/* Input Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vendors, purchase orders, or invoices..."
                className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none text-lg"
              />
              {isPending ? (
                <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
              ) : (
                <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.length < 2 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Type at least 2 characters to search...
                </div>
              ) : !hasResults && !isPending ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  {results.vendors.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Vendors</h3>
                      {results.vendors.map(v => (
                        <button key={v.id} onClick={() => handleNavigate(`/dashboard/vendors/${v.id}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                          <div className="p-2 bg-teal-500/10 text-teal-500 rounded-lg group-hover:scale-105 transition-transform">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{v.name}</div>
                            <div className="text-xs text-slate-500">TIN: {v.tin || 'N/A'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.pos.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Purchase Orders</h3>
                      {results.pos.map(po => (
                        <button key={po.id} onClick={() => handleNavigate(`/dashboard/purchase-orders/${po.id}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:scale-105 transition-transform">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{po.po_number}</div>
                            <div className="text-xs text-slate-500">Amount: ₱{Number(po.amount).toLocaleString()}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.invoices.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Service Invoices</h3>
                      {results.invoices.map(inv => (
                        <button key={inv.id} onClick={() => handleNavigate(`/dashboard/invoices/${inv.id}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-105 transition-transform">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{inv.invoice_number}</div>
                            <div className="text-xs text-slate-500">Amount: ₱{Number(inv.amount).toLocaleString()}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
