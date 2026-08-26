"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClientBilling } from "../actions";

export function NewClientInvoiceForm({ initialAccountId }: { initialAccountId?: string }) {
  const prefilledAccountId = initialAccountId || "";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(prefilledAccountId);
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/crm/accounts').then(r=>r.json()).then(d=>setAccounts(d||[])).catch(()=>{});
  }, []);
  useEffect(() => {
    if (!selectedAccount) { setProjects([]); return; }
    fetch(`/api/projects?account_id=${selectedAccount}`).then(r=>r.json()).then(async d=>{
      if (Array.isArray(d)) setProjects(d);
      else {
        // fallback: fetch all projects and filter client-side
        const r2 = await fetch('/api/projects');
        const j = await r2.json().catch(()=>[]);
        setProjects(Array.isArray(j)? j.slice(0,100): []);
      }
    }).catch(()=>setProjects([]));
  }, [selectedAccount]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("account_id", selectedAccount);
    startTransition(async () => {
      const res = await createClientBilling(fd);
      if ((res as any).error) setError((res as any).error);
      else if ((res as any).id) router.push(`/dashboard/client-invoices/${(res as any).id}`);
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client-invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">New Billing Record</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">One row = one invoice linked to a client and optionally a project.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Client <span className="text-rose-500">*</span></label>
          <select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} required className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
            <option value="">Select client…</option>
            {accounts.map(a=> <option key={a.id} value={a.id}>{a.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Project (optional)</label>
          <select name="project_id" className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
            <option value="">No project</option>
            {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Invoice Number" name="invoice_number" placeholder="e.g. 0092" required />
          <Field label="Invoice Batch" name="invoice_batch" placeholder="e.g. QC 22" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Region" name="region" placeholder="e.g. NCR" />
          <Field label="# of Nodes" name="num_nodes" type="number" placeholder="1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount VAT-ex (PHP)" name="amount_vat_ex" type="number" placeholder="23035.71" />
          <Field label="Amount VAT-inc (PHP)" name="amount_vat_inc" type="number" placeholder="25339.29" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Due Date" name="due_date" type="date" />
          <Field label="Est. Payment Date" name="est_payment_date" type="date" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Attach Document (optional)</label>
          <input type="file" name="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Notes</label>
          <textarea name="notes" rows={3} placeholder="Any remarks…" className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white resize-none" />
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/dashboard/client-invoices" className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</Link>
          <button type="submit" disabled={isPending} className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-white disabled:opacity-50">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type="text", placeholder, required }: { label:string; name:string; type?:string; placeholder?:string; required?:boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">{label} {required && <span className="text-rose-500">*</span>}</label>
      <input type={type} name={name} placeholder={placeholder} required={required} className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );
}
