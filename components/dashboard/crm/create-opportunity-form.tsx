"use client";

import { useActionState, useMemo, useState } from "react";
import { Save, Briefcase, MapPin, ShieldAlert, CalendarClock, CircleDollarSign } from "lucide-react";
import { createOpportunity } from "@/app/dashboard/crm/actions";

interface AccountOption {
  id: string;
  company_name: string;
  status: string;
}

interface ContactOption {
  id: string;
  account_id: string;
  full_name: string;
}

interface OwnerOption {
  id: string;
  full_name: string;
  role: string;
}

export function CreateOpportunityForm({
  accounts,
  contacts,
  owners,
  currentUserId,
  initialAccountId = "",
}: {
  accounts: AccountOption[];
  contacts: ContactOption[];
  owners: OwnerOption[];
  currentUserId: string;
  initialAccountId?: string;
}) {
  const defaultAccount = initialAccountId || accounts[0]?.id || "";
  const [selectedAccount, setSelectedAccount] = useState(defaultAccount);
  const [opportunityState, opportunityAction, opportunityPending] = useActionState(createOpportunity, null);

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => contact.account_id === selectedAccount),
    [contacts, selectedAccount],
  );

  const jobTypes = [
    { value: "underground_mining", label: "Underground Mining" },
    { value: "pole_recovery", label: "Pole Copper Recovery" },
    { value: "copper_recovery", label: "General Copper Recovery" },
    { value: "site_survey", label: "Site Visit Only" },
    { value: "inspection_only", label: "Inspection Only" },
    { value: "other", label: "Other" },
  ];

  const stages = [
    { value: "prospect", label: "Prospect" },
    { value: "site_visit", label: "Site Visit" },
    { value: "quoted", label: "Quoted" },
    { value: "approved", label: "Approved" },
    { value: "ongoing", label: "Ongoing" },
  ];

  return (
    <form action={opportunityAction} className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-slate-900 dark:text-white">Create Customer Project</h2>
      </div>

      <div className="p-6 space-y-4">
        {opportunityState?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{opportunityState.error}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer Account</label>
            <select
              name="account_id"
              required
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.company_name} ({(account.status || "pending").replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Primary Contact</label>
            <select
              name="contact_id"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            >
              <option value="">Select contact (optional)</option>
              {filteredContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer Project Title</label>
            <input
              name="title"
              required
              placeholder="e.g. Pole copper recovery - North Zone"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Job Type</label>
            <select
              name="job_type"
              required
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            >
              {jobTypes.map((jobType) => (
                <option key={jobType.value} value={jobType.value}>
                  {jobType.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Initial Project Status</label>
            <select
              name="stage"
              defaultValue="prospect"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            >
              {stages.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Project Owner</label>
            <select
              name="owner_id"
              defaultValue={currentUserId}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name} ({owner.role})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Site Location
            </label>
            <input
              name="location"
              placeholder="Customer site location"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <CircleDollarSign className="h-3.5 w-3.5" /> Estimated Contract Value
            </label>
            <input
              name="estimated_contract_value"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Estimated Copper Volume</label>
            <input
              name="estimated_copper_volume"
              type="number"
              step="0.01"
              placeholder="In tons or agreed unit"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> Expected Start Date
            </label>
            <input
              name="expected_start_date"
              type="date"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expected Close Date</label>
            <input
              name="expected_close_date"
              type="date"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Next Follow-up Date</label>
            <input
              name="next_follow_up_date"
              type="date"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</label>
            <input
              name="source"
              placeholder="Referral, inbound request, repeat customer..."
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Access / Safety / Permit Requirements
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <textarea
                name="access_requirements"
                rows={3}
                placeholder="Access requirements"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary resize-none"
              />
              <textarea
                name="safety_requirements"
                rows={3}
                placeholder="Safety requirements"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary resize-none"
              />
              <textarea
                name="permit_requirements"
                rows={3}
                placeholder="Permit requirements"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={opportunityPending || accounts.length === 0}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {opportunityPending ? "Creating..." : "Create Customer Project"}
          </button>
        </div>
      </div>
    </form>
  );
}
