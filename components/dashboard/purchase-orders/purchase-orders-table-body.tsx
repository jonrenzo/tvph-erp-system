'use client'

import { useRouter } from 'next/navigation'
import { FileText, Download } from 'lucide-react'
import { DeletePOButton } from './delete-po-button'

export function PurchaseOrdersTableBody({ pos, error }: { pos: any[] | null; error: any }) {
  const router = useRouter()

  return (
    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
      {error ? (
        <tr>
          <td colSpan={6} className="px-6 py-12 text-center text-red-500">
            Failed to load purchase orders.
          </td>
        </tr>
      ) : pos?.length === 0 ? (
        <tr>
          <td colSpan={6} className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-base font-medium text-slate-900 dark:text-white">No purchase orders found</p>
              <p className="text-sm mt-1">Start tracking expenses by creating a new PO.</p>
            </div>
          </td>
        </tr>
      ) : (
        pos?.map((po: any) => (
          <tr
            key={po.id}
            onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
            className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
          >
            <td className="px-6 py-4">
              <div className="font-bold text-slate-900 dark:text-white">{po.po_number}</div>
              <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{new Date(po.issued_date).toLocaleDateString()}</div>
            </td>
            <td className="px-6 py-4">
              <div className="font-medium text-slate-900 dark:text-white">{po.vendors?.name || 'Unknown Vendor'}</div>
            </td>
            <td className="px-6 py-4">
              {po.projects ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-xs font-semibold border border-primary/10">
                  {po.projects.name}
                </span>
              ) : (
                <span className="text-xs text-slate-400 italic">No Project</span>
              )}
            </td>
            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
              ₱{Number(po.amount).toLocaleString()}
            </td>
            <td className="px-6 py-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                po.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' :
                po.status === 'issued' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50' :
                po.status === 'draft' ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' :
                po.status === 'overpaid' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' :
                'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
              }`}>
                {po.status.replace('_', ' ').charAt(0).toUpperCase() + po.status.replace('_', ' ').slice(1)}
              </span>
            </td>
            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-end gap-1">
                <a
                  href={`/api/purchase-orders/${po.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                  title="View PDF"
                >
                  <Download className="h-4 w-4" />
                </a>
                <DeletePOButton poId={po.id} poNumber={po.po_number} />
              </div>
            </td>
          </tr>
        ))
      )}
    </tbody>
  )
}
