"use client";

import { useState, useActionState, useEffect } from "react";
import { Building2, MapPin, Phone, Mail, CreditCard, Clock, Edit2, Save, X, Plus, Trash2 } from "lucide-react";
import { updateVendorProfile } from "@/app/dashboard/vendors/actions";

export function VendorProfileDetails({ vendor }: { vendor: any }) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Need to handle action state for the edit form
  const [state, formAction, isPending] = useActionState(updateVendorProfile, null);

  // Close editing state if successful
  useEffect(() => {
    if (state?.success) {
      setIsEditing(false);
    }
  }, [state]);

  const [secondaryContacts, setSecondaryContacts] = useState<
    { name: string; email: string; phone: string }[]
  >(vendor.secondary_contacts || []);

  const [secondaryBanks, setSecondaryBanks] = useState<
    { bank_name: string; account_name: string; account_number: string }[]
  >(vendor.secondary_banking || []);

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

  if (!isEditing) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Company Details
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
                {vendor.address || "No address provided"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 relative">
              <div className="absolute -left-2 -top-2 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Contact Person
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                  {vendor.contact_person || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Phone
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {vendor.contact_phone || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Fax
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300">
                  {vendor.contact_fax || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {vendor.contact_email || "-"}
                </p>
              </div>
            </div>

            {vendor.secondary_contacts?.map((contact: any, idx: number) => (
              <div
                key={idx}
                className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
              >
                <div className="absolute -left-2 -top-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Secondary #{idx + 1}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Contact Person
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                    {contact.name || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Phone
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {contact.phone || "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Email Address
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {contact.email || "-"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Banking & Terms
            </h2>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Edit2 className="h-4 w-4" /> Edit
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 relative pt-6">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Bank Name
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                  {vendor.bank_name || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Account Name
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300">
                  {vendor.bank_account_name || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Account Number
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 font-mono tracking-tight">
                  {vendor.bank_account_number || "-"}
                </p>
              </div>
            </div>

            {vendor.secondary_banking?.map((bank: any, idx: number) => (
              <div
                key={idx}
                className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
              >
                <div className="absolute -left-2 -top-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Secondary #{idx + 1}
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Bank Name
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                    {bank.bank_name || "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Account Name
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300">
                    {bank.account_name || "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Account Number
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-mono tracking-tight">
                    {bank.account_number || "-"}
                  </p>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Payment Terms
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                {vendor.payment_terms || "Standard Terms"}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Currency
              </label>
              <p className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  vendor.currency === 'USD'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                }`}>
                  {vendor.currency === 'USD' ? '$ USD' : '₱ PHP'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {vendor.notes && (
          <div className="col-span-1 lg:col-span-2 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-500 mb-2">
              Internal Notes
            </h3>
            <p className="text-sm text-amber-900/70 dark:text-amber-200/70 whitespace-pre-wrap leading-relaxed">
              {vendor.notes}
            </p>
          </div>
        )}
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

      <input type="hidden" name="id" value={vendor.id} />
      <input type="hidden" name="secondary_contacts" value={JSON.stringify(secondaryContacts)} />
      <input type="hidden" name="secondary_banking" value={JSON.stringify(secondaryBanks)} />

      {/* Editing View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Company Details Edit */}
        <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-6 space-y-6 shadow-sm ring-1 ring-primary/20">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Edit Contacts
            </h2>
            <button
              type="button"
              onClick={addSecondaryContact}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Secondary Contact
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                Registered Address
              </label>
              <input
                name="address"
                defaultValue={vendor.address}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 relative pt-4">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
              <div className="col-span-2 mt-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Contact Person
                </label>
                <input
                  name="contact_person"
                  defaultValue={vendor.contact_person}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Phone
                </label>
                <input
                  name="contact_phone"
                  defaultValue={vendor.contact_phone}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Fax
                </label>
                <input
                  name="contact_fax"
                  defaultValue={vendor.contact_fax}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Email Address
                </label>
                <input
                  name="contact_email"
                  type="email"
                  defaultValue={vendor.contact_email}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            {secondaryContacts.map((contact, index) => (
              <div
                key={index}
                className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
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
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateSecondaryContact(index, "name", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) => updateSecondaryContact(index, "phone", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateSecondaryContact(index, "email", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Banking Details Edit */}
        <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-6 space-y-6 shadow-sm ring-1 ring-primary/20">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Edit Banking
            </h2>
            <button
              type="button"
              onClick={addSecondaryBank}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Secondary Bank
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 relative pt-4">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
              <div className="col-span-2 mt-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Bank Name
                </label>
                <input
                  name="bank_name"
                  defaultValue={vendor.bank_name}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Account Name
                </label>
                <input
                  name="bank_account_name"
                  defaultValue={vendor.bank_account_name}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Account Number
                </label>
                <input
                  name="bank_account_number"
                  defaultValue={vendor.bank_account_number}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            {secondaryBanks.map((bank, index) => (
              <div
                key={index}
                className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
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
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bank.bank_name}
                    onChange={(e) => updateSecondaryBank(index, "bank_name", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={bank.account_name}
                    onChange={(e) => updateSecondaryBank(index, "account_name", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bank.account_number}
                    onChange={(e) => updateSecondaryBank(index, "account_number", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                Payment Terms
              </label>
              <input
                name="payment_terms"
                defaultValue={vendor.payment_terms}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                Currency
              </label>
              <select
                name="currency"
                defaultValue={vendor.currency || 'PHP'}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="PHP">₱ PHP — Philippine Peso</option>
                <option value="USD">$ USD — US Dollar</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                Internal Notes
              </label>
              <textarea
                name="notes"
                defaultValue={vendor.notes}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 mt-6">
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setSecondaryContacts(vendor.secondary_contacts || []);
            setSecondaryBanks(vendor.secondary_banking || []);
          }}
          className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
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
