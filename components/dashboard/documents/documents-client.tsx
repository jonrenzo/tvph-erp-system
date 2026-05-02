"use client";

import { useState } from "react";
import { Search, Filter, FolderOpen, Building2 } from "lucide-react";
import { CompanyLibrary } from "./company-library";
import { VendorGrid } from "./vendor-grid";
import { CompanyFolderView } from "./company-folder-view";

interface DocumentsClientProps {
  companyDocs: any[];
  vendors: any[];
  userRole: string;
  searchQuery: string;
}

export function DocumentsClient({ companyDocs, vendors, userRole, searchQuery }: DocumentsClientProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const filteredVendors = vendors?.filter(v => 
    !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Document Repository
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centralized access to all company and vendor records.
          </p>
        </div>
        
        <form className="relative group w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            name="search"
            defaultValue={searchQuery}
            placeholder="Search vendors or documents..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all shadow-sm shadow-slate-200/50 dark:shadow-none"
          />
        </form>
      </div>

      {/* 1. Company Library Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
             <FolderOpen className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Company Library</h2>
        </div>
        <CompanyLibrary 
          documents={companyDocs || []} 
          onFolderClick={(folderId) => setSelectedFolder(folderId)}
        />
      </section>

      {/* 2. Vendor Vault Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                 <Building2 className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Vendor Vault</h2>
           </div>
           
           <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">{filteredVendors?.length} Vendors Found</span>
              <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 transition-all">
                 <Filter className="h-4 w-4" />
              </button>
           </div>
        </div>

        <VendorGrid 
          vendors={filteredVendors || []} 
          userRole={userRole} 
        />
      </section>

      {/* Company Folder View Modal */}
      {selectedFolder && (
        <CompanyFolderView 
          category={selectedFolder}
          documents={companyDocs.filter(d => d.doc_type === selectedFolder)}
          onClose={() => setSelectedFolder(null)}
        />
      )}
    </div>
  );
}
