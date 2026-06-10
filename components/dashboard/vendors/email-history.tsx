import { createClient } from "@/utils/supabase/server";
import { Mail, Download, CheckCircle2, XCircle } from "lucide-react";
import { docTypeLabel } from "@/lib/vendors/document-types";

interface EmailLogRow {
  id: string;
  kind: "po_issued" | "doc_reminder" | "doc_request";
  ref_id: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  subject: string | null;
  status: "sent" | "failed";
  resend_id: string | null;
  error: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

const KIND_LABELS: Record<EmailLogRow["kind"], string> = {
  po_issued: "Purchase Order",
  doc_reminder: "Document Reminder",
  doc_request: "Document Request",
};

function referenceFor(
  row: EmailLogRow,
  poNumbers: Map<string, string>,
): string {
  switch (row.kind) {
    case "po_issued":
      return (row.ref_id && poNumbers.get(row.ref_id)) || "Purchase order";
    case "doc_reminder":
      return docTypeLabel(String(row.meta?.doc_type ?? ""));
    case "doc_request":
      return "Documents requested";
  }
}

/**
 * Per-vendor "Email History" — a receipt of every email the system dispatched
 * to this vendor's contact (PO issued, expiry reminders, document requests).
 * Read-only; backed by email_log (RLS restricts reads to staff).
 */
export async function VendorEmailHistory({ vendorId }: { vendorId: string }) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("email_log")
    .select(
      "id, kind, ref_id, to_addresses, cc_addresses, subject, status, resend_id, error, meta, created_at, created_by",
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(100);

  const logs = (rows ?? []) as EmailLogRow[];

  // Resolve friendly references/senders in batch.
  const poIds = logs.filter((r) => r.kind === "po_issued" && r.ref_id).map((r) => r.ref_id as string);
  const senderIds = Array.from(new Set(logs.map((r) => r.created_by).filter(Boolean))) as string[];

  const [{ data: poRows }, { data: senders }] = await Promise.all([
    poIds.length
      ? supabase.from("purchase_orders").select("id, po_number").in("id", poIds)
      : Promise.resolve({ data: [] as { id: string; po_number: string }[] }),
    senderIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", senderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const poNumbers = new Map((poRows ?? []).map((p) => [p.id, p.po_number]));
  const senderNames = new Map((senders ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Email History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record of emails sent to this vendor&apos;s contact. {logs.length} entr
            {logs.length === 1 ? "y" : "ies"}.
          </p>
        </div>
        {logs.length > 0 && (
          <a
            href={`/api/vendors/${vendorId}/email-log?format=csv`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </a>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-400 italic">
          No emails have been sent to this vendor yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 font-semibold">Sent</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold">Recipient</th>
                <th className="px-6 py-3 font-semibold">Subject</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Receipt ID</th>
                <th className="px-6 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors align-top">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {new Date(row.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{KIND_LABELS[row.kind]}</div>
                    <div className="text-xs text-slate-500">{referenceFor(row, poNumbers)}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                    {(row.to_addresses ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-[260px]">
                    <span className="line-clamp-2">{row.subject || "—"}</span>
                  </td>
                  <td className="px-6 py-4">
                    {row.status === "sent" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> SENT
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                        title={row.error || undefined}
                      >
                        <XCircle className="h-3 w-3" /> FAILED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">
                    {row.resend_id || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {(row.created_by && senderNames.get(row.created_by)) || "System"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
