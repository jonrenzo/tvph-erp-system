'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Save, Trash2, User } from 'lucide-react';
import { createCustomer } from '@/app/dashboard/crm/actions';

type ContactDraft = {
  id?: string;
  full_name: string;
  job_title: string;
  email: string;
  phone: string;
  fax: string;
  notes: string;
  is_primary: boolean;
};

export function CustomerEnrollmentForm() {
  const [state, formAction, isPending] = useActionState(createCustomer, null);
  const [contacts, setContacts] = useState<ContactDraft[]>([
    { full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: true },
  ]);

  const addContact = () =>
    setContacts((prev) => [
      ...prev,
      { full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: prev.length === 0 },
    ]);

  const removeContact = (index: number) => {
    setContacts((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((contact) => contact.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next.length > 0 ? next : [{ full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: true }];
    });
  };

  const updateContact = (index: number, field: keyof ContactDraft, value: string | boolean) => {
    setContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const setPrimaryContact = (index: number) => {
    setContacts((prev) =>
      prev.map((contact, i) => ({
        ...contact,
        is_primary: i === index,
      })),
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <input type="hidden" name="customer_contacts" value={JSON.stringify(contacts)} />

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Customer Information</h2>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="company_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              type="text"
              placeholder="e.g. Acme Telecom Services"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="registered_address" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Registered Address
            </label>
            <input
              id="registered_address"
              name="registered_address"
              type="text"
              placeholder="Full registered business address"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="tin" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              TIN
            </label>
            <input
              id="tin"
              name="tin"
              type="text"
              placeholder="000-000-000-000"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="pending"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Internal Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional notes about this customer"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Contact Information</h2>
          </div>
          <button
            type="button"
            onClick={addContact}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        </div>

        <div className="p-6 space-y-8">
          {contacts.map((contact, index) => (
            <div
              key={`contact-${index}`}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4 border-t border-slate-100 dark:border-slate-800/50 first:border-0 first:pt-0"
            >
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-2">
                {contact.is_primary ? 'Primary' : `Contact #${index + 1}`}
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="text-red-500 hover:text-red-600 transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2 md:col-span-2 mt-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contact Person Name</label>
                <input
                  type="text"
                  value={contact.full_name}
                  onChange={(e) => updateContact(index, 'full_name', e.target.value)}
                  placeholder="Juan dela Cruz"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Job Title</label>
                <input
                  type="text"
                  value={contact.job_title}
                  onChange={(e) => updateContact(index, 'job_title', e.target.value)}
                  placeholder="Procurement Officer"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContact(index, 'email', e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                <input
                  type="text"
                  value={contact.phone}
                  onChange={(e) => updateContact(index, 'phone', e.target.value)}
                  placeholder="+63 900 000 0000"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fax Number</label>
                <input
                  type="text"
                  value={contact.fax}
                  onChange={(e) => updateContact(index, 'fax', e.target.value)}
                  placeholder="+63 2 000 0000"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contact Notes</label>
                <textarea
                  rows={2}
                  value={contact.notes}
                  onChange={(e) => updateContact(index, 'notes', e.target.value)}
                  placeholder="Optional contact-specific notes"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              {!contact.is_primary && (
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setPrimaryContact(index)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Set as primary contact
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-4">
        <Link
          href="/dashboard/crm"
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
          Save Customer
        </button>
      </div>
    </form>
  );
}
