'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'
import { isVendorProfileComplete, getVendorMissingFields } from '@/utils/completeness'
import { Tooltip } from '@/components/ui/tooltip'
import { TOTAL_REQUIRED_DOCS } from '@/lib/reports/compliance'

export function VendorsTableBody({ vendors, error }: { vendors: any[] | null; error: any }) {
  const router = useRouter()

  return (
    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
      {error ? (
        <tr>
          <td colSpan={7} className="px-4 py-12 text-center text-red-500">
            Failed to load vendors.
          </td>
        </tr>
      ) : vendors?.length === 0 ? (
        <tr>
          <td colSpan={7} className="px-4 py-12 text-center">
            <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Building2 className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-base font-medium text-slate-900 dark:text-white">No vendors found</p>
              <p className="text-sm mt-1">Get started by creating your first vendor record.</p>
            </div>
          </td>
        </tr>
      ) : (
        vendors?.map((vendor: any) => (
          <tr
            key={vendor.id}
            onClick={() => router.push(`/dashboard/vendors/${vendor.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(`/dashboard/vendors/${vendor.id}`)
              }
            }}
            tabIndex={0}
            className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <td className="px-4 py-3">
              <Tooltip content={
                isVendorProfileComplete(vendor)
                  ? "Profile complete"
                  : <>Missing: <span className="font-normal">{getVendorMissingFields(vendor).join(", ")}</span></>
              }>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${isVendorProfileComplete(vendor) ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="font-semibold text-slate-900 dark:text-white truncate">{vendor.name}</span>
                </div>
              </Tooltip>
              <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate">
                {vendor.address || "No address provided"}
              </div>
            </td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs truncate">
              {vendor.tin || "-"}
            </td>
            <td className="px-4 py-3">
              {vendor.contact_person ? (
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white truncate">
                    {vendor.contact_person}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs truncate">
                    {vendor.contact_email}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
            <td className="px-4 py-3">
              {(() => {
                const TOTAL = TOTAL_REQUIRED_DOCS;
                const docs: any[] = vendor.vendor_documents || [];
                const submitted = docs.filter(
                  (d: any) =>
                    d.status === "submitted" || d.status === "approved",
                ).length;
                const pct = Math.round((submitted / TOTAL) * 100);
                const color =
                  pct === 100
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                    : pct >= 50
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50";
                return (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}
                    >
                      {submitted}/{TOTAL}
                    </span>
                    <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct === 100
                            ? "bg-emerald-500"
                            : pct >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                  vendor.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                    : vendor.status === "pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                      : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                }`}
              >
                {vendor.status.charAt(0).toUpperCase() +
                  vendor.status.slice(1)}
              </span>
            </td>
            <td className="px-4 py-3">
              {(() => {
                const nda = vendor.vendor_documents?.find(
                  (d: { doc_type: string; status: string }) =>
                    d.doc_type === "signed_nda",
                );
                const label = !nda
                  ? "No NDA"
                  : nda.status === "approved"
                    ? "Signed NDA"
                    : nda.status === "expired"
                      ? "Expired"
                      : "Pending";
                const tone = !nda
                  ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  : nda.status === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                    : nda.status === "expired"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50";
                return (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${tone}`}
                  >
                    {label}
                  </span>
                );
              })()}
            </td>
            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/dashboard/vendors/${vendor.id}`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            </td>
          </tr>
        ))
      )}
    </tbody>
  )
}
