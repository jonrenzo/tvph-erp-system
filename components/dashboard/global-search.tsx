"use client";

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Search, 
  Building2, 
  ClipboardList, 
  Receipt, 
  X, 
  Loader2, 
  FolderGit2, 
  CreditCard, 
  FileText, 
  Navigation,
  BriefcaseBusiness,
  PlusCircle,
  Settings,
  User as UserIcon,
  ChevronRight,
  Package
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { globalSearch } from "@/app/dashboard/search/actions";

interface SearchResults {
  vendors: any[];
  pos: any[];
  invoices: any[];
  projects: any[];
  payments: any[];
  documents: any[];
  crm_accounts: any[];
  crm_opportunities: any[];
  employees: any[];
  assets: any[];
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  type: 'navigation' | 'action';
  icon: any;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'nav-vendors', title: 'Vendors', subtitle: 'View all vendors', path: '/dashboard/vendors', type: 'navigation', icon: Building2 },
  { id: 'act-new-vendor', title: 'New Vendor', subtitle: 'Register a new vendor', path: '/dashboard/vendors/new', type: 'action', icon: PlusCircle },
  { id: 'nav-pos', title: 'Purchase Orders', subtitle: 'Manage POs', path: '/dashboard/purchase-orders', type: 'navigation', icon: ClipboardList },
  { id: 'act-new-po', title: 'New PO', subtitle: 'Create a new purchase order', path: '/dashboard/purchase-orders/new', type: 'action', icon: PlusCircle },
  { id: 'nav-projects', title: 'Projects', subtitle: 'View active projects', path: '/dashboard/projects', type: 'navigation', icon: FolderGit2 },
  { id: 'nav-crm', title: 'Customers', subtitle: 'Customer profiles and contacts', path: '/dashboard/crm', type: 'navigation', icon: BriefcaseBusiness },
  { id: 'act-new-customer', title: 'Add Customer', subtitle: 'Create a customer profile', path: '/dashboard/crm/new', type: 'action', icon: PlusCircle },
  { id: 'act-new-opportunity', title: 'New Customer Project', subtitle: 'Add customer job', path: '/dashboard/crm/projects/new', type: 'action', icon: PlusCircle },
  { id: 'nav-invoices', title: 'Invoices', subtitle: 'Manage service invoices', path: '/dashboard/invoices', type: 'navigation', icon: Receipt },
  { id: 'nav-payments', title: 'Payments', subtitle: 'Record and track payments', path: '/dashboard/payments', type: 'navigation', icon: CreditCard },
  { id: 'nav-docs', title: 'Documents', subtitle: 'Central document repository', path: '/dashboard/documents', type: 'navigation', icon: FileText },
  { id: 'nav-settings', title: 'Settings', subtitle: 'System configuration', path: '/dashboard/settings', type: 'navigation', icon: Settings },
  { id: 'nav-profile', title: 'Profile', subtitle: 'Account settings', path: '/dashboard/profile', type: 'navigation', icon: UserIcon },
];

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResults>({ 
    vendors: [], pos: [], invoices: [], projects: [], payments: [], documents: [], crm_accounts: [], crm_opportunities: [], employees: [], assets: []
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleNavigate = useCallback((path: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(path);
  }, [router]);

  // Filter quick actions locally
  const filteredActions = useMemo(() => {
    if (!query || query.length < 2) return [];
    return QUICK_ACTIONS.filter(action => 
      action.title.toLowerCase().includes(query.toLowerCase()) ||
      action.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      action.path.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  // Combine all results for keyboard navigation indexing
  const flatResults = useMemo(() => {
    const items: any[] = [];
    filteredActions.forEach(a => items.push({ ...a, category: 'Navigation & Actions' }));
    results.vendors.forEach(v => items.push({ ...v, category: 'Vendors', icon: Building2, path: `/dashboard/vendors/${v.id}`, displayTitle: v.name, displaySub: `TIN: ${v.tin || 'N/A'}` }));
    results.projects.forEach(p => items.push({ ...p, category: 'Projects', icon: FolderGit2, path: `/dashboard/projects/${p.id}`, displayTitle: p.name, displaySub: p.project_code }));
    results.crm_accounts.forEach(a => items.push({ ...a, category: 'Customer Accounts', icon: Building2, path: `/dashboard/crm/${a.id}`, displayTitle: a.company_name, displaySub: (a.status || '').replace(/_/g, ' ') }));
    results.crm_opportunities.forEach(o => items.push({ ...o, category: 'Customer Projects', icon: BriefcaseBusiness, path: `/dashboard/crm/projects/${o.id}`, displayTitle: o.title, displaySub: `${(o.stage || '').replace(/_/g, ' ')} • ₱${Number(o.estimated_contract_value || 0).toLocaleString()}` }));
    results.pos.forEach(po => items.push({ ...po, category: 'Purchase Orders', icon: ClipboardList, path: `/dashboard/purchase-orders/${po.id}`, displayTitle: po.po_number, displaySub: `₱${Number(po.amount).toLocaleString()}` }));
    results.invoices.forEach(inv => items.push({ ...inv, category: 'Invoices', icon: Receipt, path: `/dashboard/invoices/${inv.id}`, displayTitle: inv.invoice_number, displaySub: `₱${Number(inv.amount).toLocaleString()}` }));
    results.payments.forEach(pay => items.push({ ...pay, category: 'Payments', icon: CreditCard, path: `/dashboard/invoices/${pay.invoice_id}`, displayTitle: pay.reference_number, displaySub: `₱${Number(pay.amount_paid).toLocaleString()}` }));
    results.documents.forEach(doc => items.push({ ...doc, category: 'Documents', icon: FileText, path: `/dashboard/vendors/${doc.vendor_id}`, displayTitle: doc.file_name, displaySub: doc.doc_type.replace(/_/g, ' ') }));
    results.employees.forEach(emp => items.push({ ...emp, category: 'Employees', icon: UserIcon, path: `/dashboard/hr/${emp.id}`, displayTitle: emp.full_name, displaySub: emp.department || 'No department' }));
    results.assets.forEach(ast => items.push({ ...ast, category: 'Assets', icon: Package, path: `/dashboard/assets/${ast.id}`, displayTitle: ast.name, displaySub: ast.asset_tag }));
    return items;
  }, [filteredActions, results]);

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
      if (isOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        }
        if (e.key === "Enter" && flatResults[selectedIndex]) {
          e.preventDefault();
          handleNavigate(flatResults[selectedIndex].path);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, handleNavigate]);

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
        setSelectedIndex(0);
      });
    } else {
      setResults({ vendors: [], pos: [], invoices: [], projects: [], payments: [], documents: [], crm_accounts: [], crm_opportunities: [], employees: [], assets: [] });
      setSelectedIndex(0);
    }
  }, [debouncedQuery]);

  const hasResults = flatResults.length > 0;

  return (
    <>
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

      <button onClick={() => setIsOpen(true)} className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl">
        <Search className="h-5 w-5" />
      </button>

      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#071F15] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-8 duration-200">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything (vendors, projects, settings...)"
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

            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
              {query.length < 2 ? (
                <div className="p-12 text-center">
                  <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Navigation className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                  </div>
                  <p className="text-slate-900 dark:text-white font-medium">Ready to explore?</p>
                  <p className="text-sm text-slate-500 mt-1">Start typing to find data, pages, or quick actions.</p>
                </div>
              ) : !hasResults && !isPending ? (
                <div className="p-12 text-center text-slate-500">
                  No results found for &quot;{query}&quot;
                </div>
              ) : (
                <div className="space-y-6 py-2">
                  {/* Group Results by Category */}
                  {Array.from(new Set(flatResults.map(i => i.category))).map(category => (
                    <div key={category}>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 px-3">{category}</h3>
                      <div className="space-y-1">
                        {flatResults.filter(i => i.category === category).map((item) => {
                          const isSelected = flatResults[selectedIndex]?.id === item.id || (item.path && flatResults[selectedIndex]?.path === item.path && flatResults[selectedIndex]?.displayTitle === item.displayTitle);
                          const Icon = item.icon || Navigation;
                          
                          return (
                            <button
                              key={`${item.id}-${item.displayTitle || item.title}`}
                              onClick={() => handleNavigate(item.path)}
                              onMouseEnter={() => setSelectedIndex(flatResults.indexOf(item))}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                                isSelected 
                                  ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02] z-10" 
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <div className={`p-2 rounded-lg transition-colors ${
                                isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                              }`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-bold truncate ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                  {item.displayTitle || item.title}
                                </div>
                                <div className={`text-[10px] font-medium truncate ${isSelected ? "text-white/70" : "text-slate-500"}`}>
                                  {item.displaySub || item.subtitle}
                                </div>
                              </div>
                              {isSelected && <ChevronRight className="h-4 w-4 text-white/50" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer / Shortcuts Info */}
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">↑↓</kbd>
                Navigate
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">Enter</kbd>
                Select
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">Esc</kbd>
                Close
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
