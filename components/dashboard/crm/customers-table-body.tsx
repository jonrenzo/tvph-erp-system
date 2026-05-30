'use client'

import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { isCustomerProfileComplete, getCustomerMissingFields } from '@/utils/completeness'
import { Tooltip } from '@/components/ui/tooltip'

export function CustomersTableBody({ customers, error }: { customers: any[] | null; error: any }) {
  const router = useRouter()

  return (
    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
      {error ? (
        <tr>
          <td colSpan={5} className="px-6 py-12 text-center text-red-500">
            Failed to load customers.
          </td>
        </tr>
      ) : customers?.length === 0 ? (
        <tr>
          <td colSpan={5} className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Building2 className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-base font-medium text-slate-900 dark:text-white">No customers found</p>
              <p className="text-sm mt-1">Create your first customer profile to get started.</p>
            </div>
          </td>
        </tr>
      ) : (
        customers?.map((customer: any) => {
          const primaryContact = customer.crm_contacts?.[0];
          return (
            <tr
              key={customer.id}
              onClick={() => router.push(`/dashboard/crm/${customer.id}`)}
              className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
            >
              <td className="px-6 py-4">
                <Tooltip content={
                  isCustomerProfileComplete(customer, customer.crm_contacts)
                    ? "Profile complete"
                    : <>Missing: <span className="font-normal">{getCustomerMissingFields(customer, customer.crm_contacts).join(", ")}</span></>
                }>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${isCustomerProfileComplete(customer, customer.crm_contacts) ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="font-semibold text-slate-900 dark:text-white">{customer.company_name}</span>
                  </div>
                </Tooltip>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate max-w-xs">
                  {customer.registered_address || 'No registered address'}
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                {customer.tin || '-'}
              </td>
              <td className="px-6 py-4">
                {primaryContact ? (
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{primaryContact.full_name || '-'}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-xs">{primaryContact.email || primaryContact.phone || '-'}</div>
                  </div>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    customer.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
                      : customer.status === 'inactive'
                        ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                  }`}
                >
                  {customer.status?.charAt(0).toUpperCase() + customer.status?.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-primary group-hover:underline font-medium">View</span>
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  )
}
