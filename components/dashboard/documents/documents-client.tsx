"use client";

import { useState } from "react";
import { Filter, FolderOpen, Building2, Upload, Users2 } from "lucide-react";
import { CompanyLibrary } from "./company-library";
import { VendorGrid } from "./vendor-grid";
import { CustomerGrid } from "./customer-grid";
import { CompanyFolderView } from "./company-folder-view";
import { UploadCompanyDocModal } from "./upload-company-doc-modal";
import { SearchInput } from "@/components/ui/search-input";

interface DocumentsClientProps {
  companyDocs: any[];
  vendors: any[];
  customers: any[];
  userRole: string;
  searchQuery: string;
}

export function DocumentsClient({ companyDocs, vendors, customers, userRole, searchQuery }: DocumentsClientProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const isAdmin = userRole === 'admin';

  const filteredVendors = vendors?.filter(v =>
    !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers?.filter(c =>
    !searchQuery || c.company_name.toLowerCase().includes(searchQuery.toLowerCase())
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
        
        <div className="relative group w-full md:w-96">
          <SearchInput 
            placeholder="Search vendors or documents..." 
            paramName="search"
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all shadow-sm shadow-slate-200/50 dark:shadow-none"
          />
        </div>
      </div>

      {/* 1. Company Library Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
               <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Company Library</h2>
          </div>
          {isAdmin && (
            <button
              id="upload-company-doc-btn"
              onClick={() => setIsUploadOpen(true)}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #0A5C3B 0%, #0c6a43 100%)' }}
            >
              <Upload className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Upload Document</span>
            </button>
          )}
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

      {/* 3. Customer Vault Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Users2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Customer Vault</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">{filteredCustomers?.length} Customers Found</span>
          </div>
        </div>

        <CustomerGrid customers={filteredCustomers || []} />
      </section>

      {/* Company Folder View Modal */}
      {selectedFolder && (
        <CompanyFolderView 
          category={selectedFolder}
          documents={companyDocs.filter(d => d.doc_type === selectedFolder)}
          onClose={() => setSelectedFolder(null)}
        />
      )}

      {/* Upload Company Document Modal (admin only) */}
      {isAdmin && (
        <UploadCompanyDocModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />
      )}
    </div>
  );
}
