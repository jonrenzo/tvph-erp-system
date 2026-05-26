'use client'

import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { DeleteVendorButton } from './delete-vendor-button'

export function VendorsTableBody({ vendors, error }: { vendors: any[] | null; error: any }) {
  const router = useRouter()

  return (
    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
      {error ? (
        <tr>
          <td colSpan={6} className="px-6 py-12 text-center text-red-500">
            Failed to load vendors.
          </td>
        </tr>
      ) : vendors?.length === 0 ? (
        <tr>
          <td colSpan={6} className="px-6 py-12 text-center">
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
            className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
          >
            <td className="px-6 py-4">
              <div className="font-semibold text-slate-900 dark:text-white">{vendor.name}</div>
              <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate max-w-xs">{vendor.address || 'No address provided'}</div>
            </td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
              {vendor.tin || '-'}
            </td>
            <td className="px-6 py-4">
              {vendor.contact_person ? (
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{vendor.contact_person}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs">{vendor.contact_email}</div>
                </div>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
            <td className="px-6 py-4">
              {(() => {
                const TOTAL = 14
                const docs: any[] = vendor.vendor_documents || []
                const submitted = docs.filter((d: any) => d.status === 'submitted' || d.status === 'approved').length
                const pct = Math.round((submitted / TOTAL) * 100)
                const color = pct === 100
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
                  : pct >= 50
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50'
                return (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
                      {submitted}/{TOTAL}
                    </span>
                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })()}
            </td>
            <td className="px-6 py-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                vendor.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' :
                vendor.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50' :
                'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}>
                {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
              </span>
            </td>
            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
              <DeleteVendorButton vendorId={vendor.id} vendorName={vendor.name} />
            </td>
          </tr>
        ))
      )}
    </tbody>
  )
}
