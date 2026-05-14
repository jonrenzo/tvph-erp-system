"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ArrowLeft,
  Save,
  Building2,
  User,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react";
import { createVendor } from "../actions";

export default function NewVendorPage() {
  const [state, formAction, isPending] = useActionState(createVendor, null);

  const [secondaryContacts, setSecondaryContacts] = useState<
    { name: string; email: string; phone: string }[]
  >([]);
  const [secondaryBanks, setSecondaryBanks] = useState<
    { bank_name: string; account_name: string; account_number: string }[]
  >([]);

  const addSecondaryContact = () =>
    setSecondaryContacts([
      ...secondaryContacts,
      { name: "", email: "", phone: "" },
    ]);
  const removeSecondaryContact = (index: number) =>
    setSecondaryContacts(secondaryContacts.filter((_, i) => i !== index));
  const updateSecondaryContact = (
    index: number,
    field: string,
    value: string,
  ) => {
    const newContacts = [...secondaryContacts];
    newContacts[index] = {
      ...newContacts[index],
      [field as keyof (typeof newContacts)[0]]: value,
    };
    setSecondaryContacts(newContacts);
  };

  const addSecondaryBank = () =>
    setSecondaryBanks([
      ...secondaryBanks,
      { bank_name: "", account_name: "", account_number: "" },
    ]);
  const removeSecondaryBank = (index: number) =>
    setSecondaryBanks(secondaryBanks.filter((_, i) => i !== index));
  const updateSecondaryBank = (index: number, field: string, value: string) => {
    const newBanks = [...secondaryBanks];
    newBanks[index] = {
      ...newBanks[index],
      [field as keyof (typeof newBanks)[0]]: value,
    };
    setSecondaryBanks(newBanks);
  };

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
        <input
          type="hidden"
          name="secondary_contacts"
          value={JSON.stringify(secondaryContacts)}
        />
        <input
          type="hidden"
          name="secondary_banking"
          value={JSON.stringify(secondaryBanks)}
        />

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
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Contact Information
              </h2>
            </div>
            <button
              type="button"
              onClick={addSecondaryContact}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Secondary Contact
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Primary Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
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

              <div className="space-y-2">
                <label
                  htmlFor="contact_fax"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Fax Number
                </label>
                <input
                  id="contact_fax"
                  name="contact_fax"
                  type="text"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="+63 2 000 0000"
                />
              </div>
            </div>

            {/* Secondary Contacts */}
            {secondaryContacts.map((contact, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
              >
                <div className="absolute -left-2 -top-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-2">
                  Secondary #{index + 1}
                  <button
                    type="button"
                    onClick={() => removeSecondaryContact(index)}
                    className="text-red-500 hover:text-red-600 transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) =>
                      updateSecondaryContact(index, "name", e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Jane Smith"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) =>
                      updateSecondaryContact(index, "email", e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) =>
                      updateSecondaryContact(index, "phone", e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="+63 900 000 0000"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Banking Info */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Banking & Terms
              </h2>
            </div>
            <button
              type="button"
              onClick={addSecondaryBank}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Secondary Bank
            </button>
          </div>

          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
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

              <div className="space-y-2">
                <label
                  htmlFor="currency"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue="PHP"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                >
                  <option value="PHP">₱ PHP — Philippine Peso</option>
                  <option value="USD">$ USD — US Dollar</option>
                </select>
              </div>
            </div>

            {/* Secondary Banks */}
            {secondaryBanks.map((bank, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
              >
                <div className="absolute -left-2 -top-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-2">
                  Secondary #{index + 1}
                  <button
                    type="button"
                    onClick={() => removeSecondaryBank(index)}
                    className="text-red-500 hover:text-red-600 transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bank.bank_name}
                    onChange={(e) =>
                      updateSecondaryBank(index, "bank_name", e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="e.g. BDO, BPI"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={bank.account_name}
                    onChange={(e) =>
                      updateSecondaryBank(index, "account_name", e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Registered Account Name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bank.account_number}
                    onChange={(e) =>
                      updateSecondaryBank(
                        index,
                        "account_number",
                        e.target.value,
                      )
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="0000 0000 0000"
                  />
                </div>
              </div>
            ))}

            <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800/50">
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
