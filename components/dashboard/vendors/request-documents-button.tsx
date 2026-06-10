"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, X, Loader2, Send } from "lucide-react";
import { DOCUMENT_TYPES } from "@/lib/vendors/document-types";
import { requestVendorDocuments } from "@/app/dashboard/vendors/actions";

interface DocLike {
  doc_type: string;
  status: string;
}

export function RequestDocumentsButton({
  vendorId,
  documents,
}: {
  vendorId: string;
  documents: DocLike[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Default selection: anything not yet approved (missing, not submitted, or expired).
  const defaultSelected = useMemo(() => {
    const byType = new Map(documents.map((d) => [d.doc_type, d.status]));
    const set = new Set<string>();
    for (const t of DOCUMENT_TYPES) {
      const status = byType.get(t.id);
      if (!status || status === "not_submitted" || status === "expired") {
        set.add(t.id);
      }
    }
    return set;
  }, [documents]);

  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openModal() {
    setSelected(new Set(defaultSelected));
    setError(null);
    setNote("");
    setOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestVendorDocuments(
        vendorId,
        Array.from(selected),
        note.trim() || undefined,
      );
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
      >
        <Mail className="h-3.5 w-3.5" />
        Request Documents
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Request documents from vendor
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Select the documents to request. The vendor will receive an email
                with a secure upload link.
              </p>
              {DOCUMENT_TYPES.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {t.label}
                  </span>
                </label>
              ))}

              <div className="pt-3">
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add a short message to the vendor…"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-slate-900 bg-white dark:bg-[#0a0a0a] dark:text-white border border-slate-300 dark:border-slate-700"
                />
              </div>

              {error && <p className="text-xs text-red-600 dark:text-red-400 pt-2">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || selected.size === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isPending ? "Sending…" : `Send request${selected.size ? ` (${selected.size})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
