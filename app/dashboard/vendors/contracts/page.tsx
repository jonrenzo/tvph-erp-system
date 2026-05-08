import { createClient } from '@/utils/supabase/server';
import { FileText, Plus, Search, Filter, Calendar, Building2, ExternalLink, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { CreateContractModal } from '@/components/dashboard/vendors/contracts/create-contract-modal';

export default async function VendorContractsPage() {
  const supabase = await createClient();

  // Fetch all contracts with vendor details
  const { data: contracts } = await supabase
    .from('vendor_contracts')
    .select(`
      *,
      vendors (name),
      projects (name)
    `)
    .order('created_at', { ascending: false });

  // Fetch vendors for the creation modal
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  // Fetch projects for the creation modal
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, vendor_id')
    .is('deleted_at', null)
    .order('name');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'expired': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400';
      case 'draft': return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400';
      case 'terminated': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Master Contract Repository
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage legal agreements, MSAs, and formal contracts for all vendors.
          </p>
        </div>
        
        <CreateContractModal vendors={vendors || []} projects={projects || []} />
      </div>

      {/* Contracts Table */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Contract Info</th>
                <th className="px-6 py-4 font-semibold">Vendor</th>
                <th className="px-6 py-4 font-semibold">Project</th>
                <th className="px-6 py-4 font-semibold text-center">Period</th>
                <th className="px-6 py-4 font-semibold text-center">Total Value</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contracts?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    No contracts found. Upload your first agreement to get started.
                  </td>
                </tr>
              ) : (
                contracts?.map((contract) => (
                  <tr key={contract.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white">{contract.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{contract.contract_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium">{contract.vendors?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {contract.projects ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-xs font-semibold border border-primary/10">
                          {contract.projects.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Project</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                             <Calendar className="h-3 w-3" />
                             {new Date(contract.start_date).toLocaleDateString()}
                          </div>
                          {contract.end_date ? (
                             <div className="text-[10px] text-slate-400 italic">
                                expires {new Date(contract.end_date).toLocaleDateString()}
                             </div>
                          ) : (
                             <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">No Expiry</span>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                       {contract.total_value ? `₱${Number(contract.total_value).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(contract.status)}`}>
                         {contract.status.toUpperCase()}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {contract.file_url && (
                         <a 
                           href={contract.file_url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-xs"
                         >
                           <ExternalLink className="h-3 w-3" />
                           View PDF
                         </a>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
