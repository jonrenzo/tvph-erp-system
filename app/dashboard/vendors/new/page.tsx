"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Save, Building2, User, CreditCard } from "lucide-react";
import { createVendor } from "../actions";

export default function NewVendorPage() {
  const [state, formAction, isPending] = useActionState(createVendor, null);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/vendors"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Add New Vendor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create a new supplier profile. They will be marked as "Pending"
            until activated.
          </p>
        </div>
      </div>

      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Company Info */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Company Information
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="e.g. Test Corporation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="address"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Registered Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Full address"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="tin"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                TIN (Tax Identification Number)
              </label>
              <input
                id="tin"
                name="tin"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="000-000-000-000"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Primary Contact
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="contact_person"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Contact Person Name
              </label>
              <input
                id="contact_person"
                name="contact_person"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="contact_email"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email Address
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="contact_phone"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Phone Number
              </label>
              <input
                id="contact_phone"
                name="contact_phone"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="+63 900 000 0000"
              />
            </div>
          </div>
        </div>

        {/* Banking Info */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Banking & Terms
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="bank_name"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Bank Name
              </label>
              <input
                id="bank_name"
                name="bank_name"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="e.g. BDO, BPI"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="bank_account_name"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Account Name
              </label>
              <input
                id="bank_account_name"
                name="bank_account_name"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Registered Account Name"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="bank_account_number"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Account Number
              </label>
              <input
                id="bank_account_number"
                name="bank_account_number"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="0000 0000 0000"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="payment_terms"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Payment Terms
              </label>
              <input
                id="payment_terms"
                name="payment_terms"
                type="text"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="e.g. 30 Days, DP + 15 Days"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="notes"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Internal Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                placeholder="Any additional information..."
              ></textarea>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/dashboard/vendors"
            className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            {isPending ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Vendor
          </button>
        </div>
      </form>
    </div>
  );
}
