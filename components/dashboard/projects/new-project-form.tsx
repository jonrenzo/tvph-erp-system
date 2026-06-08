"use client";

import { use, useEffect, useState } from "react";
import { useActionState } from "react";
import { Save, FolderGit2 } from "lucide-react";
import { createProject } from "@/app/dashboard/projects/actions";

export function NewProjectForm({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<{ account_id?: string }>;
}) {
  const searchParams = searchParamsPromise ? use(searchParamsPromise) : {};
  const prefilledAccountId = searchParams?.account_id || "";

  const [state, formAction, isPending] = useActionState(createProject, null);
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);

  useEffect(() => {
    fetch("/api/crm/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data || []))
      .catch(() => {});
  }, []);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
          <FolderGit2 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Project Details</h2>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g. Q3 Network Rollout"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="account_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Client <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <select
              id="account_id"
              name="account_id"
              defaultValue={prefilledAccountId}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              <option value="">No client</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.company_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="active"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="contract_file" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Contract Document <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <input
              id="contract_file"
              name="contract_file"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
              placeholder="Project details and scope..."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => window.history.back()}
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
          Create Project
        </button>
      </div>
    </form>
  );
}
