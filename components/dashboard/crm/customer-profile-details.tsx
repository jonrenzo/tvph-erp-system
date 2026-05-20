'use client';

import { useActionState, useEffect, useState } from 'react';
import { Building2, Edit2, Mail, MapPin, Phone, Save, Trash2, User, X } from 'lucide-react';
import { updateCustomerProfile } from '@/app/dashboard/crm/actions';

type ContactState = {
  id?: string;
  full_name: string;
  job_title: string;
  email: string;
  phone: string;
  fax: string;
  notes: string;
  is_primary: boolean;
};

export function CustomerProfileDetails({
  customer,
  contacts,
}: {
  customer: any;
  contacts: any[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCustomerProfile, null);
  const [contactDrafts, setContactDrafts] = useState<ContactState[]>(
    contacts.length > 0
      ? contacts.map((contact) => ({
          id: contact.id,
          full_name: contact.full_name || '',
          job_title: contact.job_title || '',
          email: contact.email || '',
          phone: contact.phone || '',
          fax: contact.fax || '',
          notes: contact.notes || '',
          is_primary: Boolean(contact.is_primary),
        }))
      : [{ full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: true }],
  );

  useEffect(() => {
    if (state?.success) {
      setIsEditing(false);
    }
  }, [state]);

  const addContact = () =>
    setContactDrafts((prev) => [
      ...prev,
      { full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: false },
    ]);

  const removeContact = (index: number) =>
    setContactDrafts((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((contact) => contact.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next.length > 0 ? next : [{ full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: true }];
    });

  const updateContact = (index: number, field: keyof ContactState, value: string | boolean) =>
    setContactDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  const setPrimary = (index: number) =>
    setContactDrafts((prev) => prev.map((contact, i) => ({ ...contact, is_primary: i === index })));

  if (!isEditing) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Customer Profile
            </h2>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Edit2 className="h-4 w-4" /> Edit
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Registered Address
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                {customer.registered_address || 'No address provided'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  TIN
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 font-mono text-xs">{customer.tin || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300">{customer.status || 'pending'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Notes
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300">{customer.notes || '-'}</p>
              </div>
            </div>

            <div className="pt-2 space-y-4">
              {contacts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No contacts available.</p>
              ) : (
                contacts.map((contact, index) => (
                  <div key={contact.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                        {contact.is_primary ? 'Primary Contact' : `Contact #${index + 1}`}
                      </p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">{contact.full_name || '-'}</p>
                      <p className="text-xs text-slate-500">{contact.job_title || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Phone / Fax</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {contact.phone || '-'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Fax: {contact.fax || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Email</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {contact.email || '-'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6 animate-in fade-in duration-300">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <input type="hidden" name="id" value={customer.id} />
      <input type="hidden" name="customer_contacts" value={JSON.stringify(contactDrafts)} />

      <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-6 space-y-6 shadow-sm ring-1 ring-primary/20">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Edit Customer
          </h2>
          <button
            type="button"
            onClick={addContact}
            className="text-xs font-bold text-primary hover:underline"
          >
            Add Contact
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Customer Name
            </label>
            <input
              name="company_name"
              required
              defaultValue={customer.company_name}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Registered Address
            </label>
            <input
              name="registered_address"
              defaultValue={customer.registered_address}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              TIN
            </label>
            <input
              name="tin"
              defaultValue={customer.tin}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Status
            </label>
            <select
              name="status"
              defaultValue={customer.status || 'pending'}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Internal Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={customer.notes}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
          {contactDrafts.map((contact, index) => (
            <div key={`edit-contact-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="md:col-span-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {contact.is_primary ? 'Primary Contact' : `Contact #${index + 1}`}
                </p>
                <div className="flex items-center gap-3">
                  {!contact.is_primary && (
                    <button type="button" onClick={() => setPrimary(index)} className="text-xs font-bold text-primary hover:underline">
                      Set Primary
                    </button>
                  )}
                  {contactDrafts.length > 1 && (
                    <button type="button" onClick={() => removeContact(index)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <input
                value={contact.full_name}
                onChange={(e) => updateContact(index, 'full_name', e.target.value)}
                placeholder="Contact name"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <input
                value={contact.job_title}
                onChange={(e) => updateContact(index, 'job_title', e.target.value)}
                placeholder="Job title"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <input
                value={contact.email}
                onChange={(e) => updateContact(index, 'email', e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <input
                value={contact.phone}
                onChange={(e) => updateContact(index, 'phone', e.target.value)}
                placeholder="Phone"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <input
                value={contact.fax}
                onChange={(e) => updateContact(index, 'fax', e.target.value)}
                placeholder="Fax"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <input
                value={contact.notes}
                onChange={(e) => updateContact(index, 'notes', e.target.value)}
                placeholder="Contact notes"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setContactDrafts(
              contacts.length > 0
                ? contacts.map((contact) => ({
                    id: contact.id,
                    full_name: contact.full_name || '',
                    job_title: contact.job_title || '',
                    email: contact.email || '',
                    phone: contact.phone || '',
                    fax: contact.fax || '',
                    notes: contact.notes || '',
                    is_primary: Boolean(contact.is_primary),
                  }))
                : [{ full_name: '', job_title: '', email: '', phone: '', fax: '', notes: '', is_primary: true }],
            );
          }}
          className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
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
          Save Changes
        </button>
      </div>
    </form>
  );
}
