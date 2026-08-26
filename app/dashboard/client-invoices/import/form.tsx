"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { importClientBilling } from "../actions";

export function ImportForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    fetch('/api/crm/accounts').then(r=>r.json()).then(d=>setAccounts(d||[])).catch(()=>{});
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    if (accountId) fd.set("account_id", accountId);
    startTransition(async () => {
      const res = await importClientBilling(fd);
      if ((res as any)?.error) setError((res as any).error);
      else setResult(res);
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client-invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Import Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload the Excel tracker. Columns: S/N, INVOICE BATCH, INVOICE NUMBER, # OF NODES, REGION, DATE ISSUED, DATE ENDORSED TO SKY FINANCE, AMOUNT DUE VAT-EX/INC, DUE DATE, ESTIMATED PAYMENT DATE, STATUS.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Target Client (used when the file has no Client column)</label>
          <select value={accountId} onChange={e=>setAccountId(e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
            <option value="">— choose if file lacks Client —</option>
            {accounts.map(a=> <option key={a.id} value={a.id}>{a.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Spreadsheet <span className="text-rose-500">*</span></label>
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary" />
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl">{error}</p>}
        {result && (
          <div className="text-sm bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-1">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">Import complete</p>
            <p>Created: {result.created} · Updated: {result.updated} · Errors: {result.errors?.length ?? 0} · Rows: {result.totalRows}</p>
            {result.errors?.length > 0 && (
              <ul className="text-xs text-red-600 dark:text-red-400 list-disc ml-4 max-h-32 overflow-auto">
                {result.errors.slice(0,20).map((e:any,i:number)=> <li key={i}>Row {e.row}: {e.reason}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/dashboard/client-invoices" className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">Back</Link>
          <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-white disabled:opacity-50">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isPending ? 'Importing…' : 'Import'}
          </button>
        </div>
      </form>
    </div>
  );
}
