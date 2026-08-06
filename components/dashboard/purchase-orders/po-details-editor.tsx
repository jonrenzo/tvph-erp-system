"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, X, Check, Calendar, Clock, User, CheckCircle2 } from "lucide-react";
import { updatePODetails } from "@/app/dashboard/purchase-orders/actions";

export function PODetailsEditor({
  poId,
  description,
  issuedDate,
  dueDate,
  draftedBy,
  approvedBy,
  financeApprovedBy,
  canEdit,
  embedded = false,
}: {
  poId: string;
  description: string | null;
  issuedDate: string;
  dueDate: string | null;
  draftedBy: string;
  approvedBy: string;
  financeApprovedBy?: string;
  canEdit: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result: { error?: string; success?: boolean } = await updatePODetails(
        poId,
        new FormData(event.currentTarget),
      );
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className={embedded ? "" : "bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"}>
      {!embedded && (
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> PO Details
          </h2>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>
      )}

      {editing ? (
        <form onSubmit={submit} className="p-6 space-y-6">
          <div>
            <label htmlFor="po-details-description" className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              id="po-details-description"
              name="description"
              defaultValue={description ?? ""}
              rows={2}
              className={`${inputClass} mt-1 resize-none`}
              placeholder="No description provided"
            />
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Issued Date
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                {new Date(issuedDate).toLocaleDateString(undefined, { dateStyle: "long" })}
              </p>
            </div>
            <div>
              <label htmlFor="po-details-due-date" className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Due Date
              </label>
              <input
                id="po-details-due-date"
                name="due_date"
                type="date"
                defaultValue={dueDate ?? ""}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
            >
              {isPending ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className={`space-y-6${embedded ? "" : " p-6"}`}>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Description
            </label>
            <p className="mt-1 text-slate-900 dark:text-slate-300 text-lg whitespace-pre-line">
              {description || "No description provided"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Issued Date
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                {new Date(issuedDate).toLocaleDateString(undefined, { dateStyle: "long" })}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Due Date
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                {dueDate
                  ? new Date(dueDate).toLocaleDateString(undefined, { dateStyle: "long" })
                  : "No due date set"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Drafted by
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">{draftedBy}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approved by
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">{approvedBy}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Finance Approval
              </label>
              <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">{financeApprovedBy ?? "Not yet approved"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
