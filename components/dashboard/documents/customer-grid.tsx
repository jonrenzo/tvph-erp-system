"use client";

import { useState } from "react";
import { FileCheck, ShieldAlert, ChevronRight, Users2 } from "lucide-react";
import { CustomerDocumentDrawer } from "./customer-document-drawer";

interface Customer {
  id: string;
  company_name: string;
  status: string;
  crm_documents: {
    id: string;
    status: string;
    doc_type: string;
    label?: string | null;
    file_url?: string | null;
    file_name?: string | null;
    expiry_date?: string | null;
  }[];
}

export function CustomerGrid({ customers }: { customers: Customer[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === selectedId);

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500 dark:text-slate-400">
        <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Users2 className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-base font-medium text-slate-900 dark:text-white">No customers found</p>
        <p className="text-sm mt-1">Add customers from the CRM module.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {customers.map((customer) => {
          const totalDocs = customer.crm_documents?.length ?? 0;
          const expiredDocs = customer.crm_documents?.filter((d) => d.status === "expired").length ?? 0;
          const approvedDocs = customer.crm_documents?.filter((d) => d.status === "approved").length ?? 0;

          return (
            <div
              key={customer.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(customer.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(customer.id);
                }
              }}
              className="group bg-white dark:bg-[#071F15] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-400/30 transition-all text-left flex flex-col space-y-6 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl group-hover:scale-110 transition-transform">
                    {customer.company_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                      {customer.company_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          customer.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        {customer.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <FileCheck className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {totalDocs} {totalDocs === 1 ? "File" : "Files"}
                    </span>
                  </div>
                  {expiredDocs > 0 ? (
                    <div className="flex items-center gap-1.5 text-rose-500 animate-pulse">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">{expiredDocs} Expired</span>
                    </div>
                  ) : totalDocs > 0 ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {approvedDocs}/{totalDocs} Approved
                    </span>
                  ) : null}
                </div>

                <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CustomerDocumentDrawer
        customer={selectedCustomer}
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
