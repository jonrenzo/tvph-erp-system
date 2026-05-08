"use client";

import { useState } from "react";
import { 
  Building2, 
  FileCheck, 
  ShieldAlert, 
  ChevronRight,
  MoreVertical,
  Activity
} from "lucide-react";
import { DocumentDrawer } from "./document-drawer";

interface Vendor {
  id: string;
  name: string;
  status: string;
  vendor_documents: {
    id: string;
    status: string;
    doc_type: string;
  }[];
}

export function VendorGrid({ vendors, userRole }: { vendors: Vendor[], userRole: string }) {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {vendors.map((vendor) => {
          const totalDocs = vendor.vendor_documents?.length || 0;
          const expiredDocs = vendor.vendor_documents?.filter(d => d.status === 'expired').length || 0;
          const complianceRate = Math.min(Math.round((totalDocs / 14) * 100), 100);

          return (
            <div
              key={vendor.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedVendorId(vendor.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedVendorId(vendor.id);
                }
              }}
              className="group bg-white dark:bg-[#071F15] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all text-left flex flex-col space-y-6 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-xl group-hover:scale-110 transition-transform">
                    {vendor.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight group-hover:text-primary transition-colors">
                      {vendor.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${vendor.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{vendor.status}</span>
                    </div>
                  </div>
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              {/* Compliance Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Compliance Health</span>
                  <span className={complianceRate === 100 ? 'text-emerald-500' : ''}>{complianceRate}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      complianceRate === 100 ? 'bg-emerald-500' : 'bg-primary'
                    }`} 
                    style={{ width: `${complianceRate}%` }} 
                  />
                </div>
              </div>

              {/* Stats Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                      <FileCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{totalDocs} Files</span>
                   </div>
                   {expiredDocs > 0 && (
                     <div className="flex items-center gap-1.5 text-rose-500 animate-pulse">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{expiredDocs} Expired</span>
                     </div>
                   )}
                </div>
                
                <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over Drawer */}
      <DocumentDrawer 
        vendor={selectedVendor} 
        isOpen={!!selectedVendorId} 
        onClose={() => setSelectedVendorId(null)} 
        userRole={userRole}
      />
    </>
  );
}
