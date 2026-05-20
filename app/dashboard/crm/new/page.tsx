import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CustomerEnrollmentForm } from '@/components/dashboard/crm/customer-enrollment-form';

export default function NewCustomerPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/crm"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Add New Customer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create a customer profile with registered address, tax details, and contacts.
          </p>
        </div>
      </div>

      <CustomerEnrollmentForm />
    </div>
  );
}
