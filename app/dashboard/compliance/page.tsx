import { createClient } from '@/utils/supabase/server';
import { Lock, CheckCircle2, AlertCircle, Clock, XCircle, Search, Filter, ShieldCheck, Download } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  REQUIRED_DOCS,
  TOTAL_REQUIRED_DOCS,
  getDocStatus,
  calculateScore,
  computeComplianceSummary,
} from '@/lib/reports/compliance';

export const unstable_instant = { prefetch: 'static' };

export default function ComplianceHubPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" /> {TOTAL_REQUIRED_DOCS}-Point Compliance Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time accreditation tracking for all TelcoVantage vendors.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
                <Filter className="h-4 w-4" /> Filter
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">
                <Download className="h-4 w-4" /> Export Matrix
            </button>
        </div>
      </div>

      <Suspense fallback={<ComplianceSkeleton />}>
        <ComplianceContent />
      </Suspense>
    </div>
  );
}

async function ComplianceContent() {
  const supabase = await createClient();

  // Fetch all vendors with their document status
  const { data: vendors } = await supabase
    .from('vendors')
    .select(`
      id,
      name,
      status,
      vendor_documents (
        doc_type,
        status,
        expiry_date
      )
    `)
    .is('deleted_at', null)
    .order('name');

  const summary = computeComplianceSummary(vendors as any);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Overall Compliance</h3>
            <div className="mt-2 flex items-baseline gap-2">
               <span className="text-3xl font-bold text-slate-900 dark:text-white">{summary.overallPercentage}%</span>
               <span className="text-xs text-slate-500 font-medium">across {summary.totalVendors} vendor{summary.totalVendors === 1 ? '' : 's'}</span>
            </div>
         </div>
         <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pending Reviews</h3>
            <div className="mt-2 flex items-baseline gap-2">
               <span className="text-3xl font-bold text-slate-900 dark:text-white">{summary.pendingReviews}</span>
               <span className="text-xs text-amber-600 font-medium">{summary.pendingReviews === 0 ? 'All clear' : 'Awaiting approval'}</span>
            </div>
         </div>
         <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Non-Compliant</h3>
            <div className="mt-2 flex items-baseline gap-2">
               <span className="text-3xl font-bold text-red-600">{summary.nonCompliant}</span>
               <span className="text-xs text-red-500 font-medium">Missing or expired docs</span>
            </div>
         </div>
      </div>

      {/* Compliance Matrix Table */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold sticky left-0 z-10 bg-slate-50 dark:bg-slate-900">Vendor Name</th>
                <th className="px-6 py-4 font-semibold text-center">Score</th>
                {REQUIRED_DOCS.map(doc => (
                  <th key={doc.id} className="px-4 py-4 font-semibold text-center whitespace-nowrap">{doc.label}</th>
                ))}
                <th className="px-6 py-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vendors?.map((vendor) => {
                const { score, total, percentage } = calculateScore(vendor.vendor_documents);
                return (
                  <tr key={vendor.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white sticky left-0 z-10 bg-white dark:bg-[#071F15] border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <Link href={`/dashboard/vendors/${vendor.id}`} className="hover:text-primary transition-colors">
                        {vendor.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className={`font-bold ${percentage >= 80 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {score}/{total}
                          </span>
                          <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                             <div className={`h-full ${percentage >= 80 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }}></div>
                          </div>
                       </div>
                    </td>
                    
                    {REQUIRED_DOCS.map(doc => {
                       const status = getDocStatus(vendor.vendor_documents, doc.id);
                       return (
                         <td key={doc.id} className="px-4 py-4 text-center">
                            <div className="flex justify-center" title={status === 'submitted' ? 'Pending Review' : status.charAt(0).toUpperCase() + status.slice(1)}>
                               {status === 'approved' ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                               ) : status === 'submitted' ? (
                                  <Clock className="h-5 w-5 text-amber-500" />
                               ) : status === 'expired' ? (
                                  <AlertCircle className="h-5 w-5 text-red-500" />
                               ) : (
                                  <XCircle className="h-5 w-5 text-slate-200 dark:text-slate-700" />
                               )}
                            </div>
                         </td>
                       );
                    })}

                    <td className="px-6 py-4 text-right">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                         vendor.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                         vendor.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                         'bg-red-50 text-red-700 border-red-200'
                       }`}>
                         {vendor.status.toUpperCase()}
                       </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 p-4 bg-slate-50 dark:bg-slate-800/10 rounded-2xl border border-slate-200 dark:border-slate-800">
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Legend:</p>
         <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Approved
         </div>
         <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Clock className="h-4 w-4 text-amber-500" /> Pending Review
         </div>
         <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <AlertCircle className="h-4 w-4 text-red-500" /> Expired
         </div>
         <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <XCircle className="h-4 w-4 text-slate-200 dark:text-slate-700" /> Missing
         </div>
      </div>
    </>
  );
}

function ComplianceSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
