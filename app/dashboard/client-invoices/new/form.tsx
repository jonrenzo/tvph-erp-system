"use client";

import { useState, useTransition, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClientInvoice } from "../actions";

export function NewClientInvoiceForm({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<{ client_po_id?: string; account_id?: string }>;
}) {
  const searchParams = searchParamsPromise ? use(searchParamsPromise) : {};
  const prefilledPoId = searchParams?.client_po_id || "";
  const prefilledAccountId = searchParams?.account_id || "";

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(prefilledAccountId);
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);
  const [pos, setPos] = useState<{ id: string; po_number: string; amount: number; currency: string }[]>([]);

  useEffect(() => {
    fetch('/api/crm/accounts')
      .then((r) => r.json())
      .then((data) => setAccounts(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAccount) { setPos([]); return; }
    fetch(`/api/client-pos?account_id=${selectedAccount}`)
      .then((r) => r.json())
      .then((data) => setPos(data || []))
      .catch(() => {});
  }, [selectedAccount]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("account_id", selectedAccount);
    startTransition(async () => {
      const result = await createClientInvoice(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        router.push(`/dashboard/client-invoices/${result.id}`);
      }
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client-invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Record Client Invoice</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Record an invoice issued by TVPH to a client.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
            Client <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            required
            className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select client…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.company_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
            Client PO <span className="text-rose-500">*</span>
          </label>
          <select
            name="client_po_id"
            required
            defaultValue={prefilledPoId}
            disabled={!selectedAccount}
            className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            <option value="">Select PO…</option>
            {pos.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number} — {po.currency} {Number(po.amount).toLocaleString()}
              </option>
            ))}
          </select>
          {selectedAccount && pos.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">No open POs for this client.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Invoice Number" name="invoice_number" placeholder="e.g. INV-2026-001" required />
          <Field label="Invoice Date" name="invoice_date" type="date" required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Currency</label>
            <select
              name="currency"
              defaultValue="PHP"
              className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="PHP">PHP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <Field label="Amount" name="amount" type="number" placeholder="0.00" required />
        </div>

        <Field label="Due Date (optional)" name="due_date" type="date" />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
            Attach Invoice Document (optional)
          </label>
          <input
            type="file"
            name="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Notes</label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Any remarks…"
            className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/dashboard/client-invoices" className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-white transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? 'Saving…' : 'Record Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", placeholder, required }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
      />
    </div>
  );
}
