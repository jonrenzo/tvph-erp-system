"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createClientBilling } from "../actions";
import { Combobox } from "@/components/ui/combobox";
import { REGIONS, REGION_NAMES } from "@/lib/constants/philippine-regions";
import { parseSiteDetailClipboard } from "@/utils/site-detail-parser";

interface BillingNode {
  region: string;
  area_city: string;
  node_id: string;
  phase: string;
  no_of_nodes: number;
  cable_length_km: number;
  has_mrs: boolean;
}

const EMPTY_NODE: BillingNode = {
  region: "",
  area_city: "",
  node_id: "",
  phase: "1",
  no_of_nodes: 1,
  cable_length_km: 0,
  has_mrs: false,
};

const areaByRegion: Record<string, string[]> = REGIONS;

export function NewClientInvoiceForm({ initialAccountId }: { initialAccountId?: string }) {
  const prefilledAccountId = initialAccountId || "";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(prefilledAccountId);
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectFree, setProjectFree] = useState("");
  const [nodes, setNodes] = useState<BillingNode[]>([{ ...EMPTY_NODE }]);

  useEffect(() => {
    fetch('/api/crm/accounts').then(r=>r.json()).then(d=>setAccounts(d||[])).catch(()=>{});
  }, []);
  useEffect(() => {
    if (!selectedAccount) { setProjects([]); return; }
    fetch(`/api/projects?account_id=${selectedAccount}`).then(r=>r.json()).then(async d=>{
      if (Array.isArray(d)) setProjects(d);
      else {
        const r2 = await fetch('/api/projects');
        const j = await r2.json().catch(()=>[]);
        setProjects(Array.isArray(j)? j.slice(0,100): []);
      }
    }).catch(()=>setProjects([]));
  }, [selectedAccount]);

  const projectNames = projects.map(p => p.name);

  const updateNode = useCallback((idx: number, field: keyof BillingNode, value: string | number | boolean) => {
    setNodes(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value } as BillingNode;
      if (idx === 0 && (field === "region" || field === "area_city")) {
        for (let i = 1; i < next.length; i++) next[i] = { ...next[i], [field]: value } as BillingNode;
      }
      return next;
    });
  }, []);

  const addNode = useCallback(() => setNodes(prev => [...prev, { ...EMPTY_NODE }]), []);
  const removeNode = useCallback((idx: number) => {
    setNodes(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);

  const handleNodeIdPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const { rows, warnings } = parseSiteDetailClipboard(e.clipboardData.getData("text/plain"));
    if (rows.length === 0) {
      if (warnings.length) { e.preventDefault(); toast.error(`Paste skipped — ${warnings.join("; ")}`); }
      return;
    }
    e.preventDefault();
    setNodes(prev => {
      const isTemplate = prev.every(s => !s.node_id);
      const t = isTemplate ? prev[0] : undefined;
      const newRows: BillingNode[] = rows.map(r => ({
        region: t?.region || "",
        area_city: t?.area_city || "",
        node_id: r.node_id,
        phase: t?.phase || "1",
        no_of_nodes: t?.no_of_nodes || 1,
        cable_length_km: r.cable_length_km,
        has_mrs: false,
      }));
      return isTemplate ? newRows : [...prev, ...newRows];
    });
    const skipped = warnings.length ? ` — skipped ${warnings.length}: ${warnings.join("; ")}` : "";
    toast.success(`Added ${rows.length} site${rows.length === 1 ? "" : "s"}.${skipped}`);
  }, []);

  const totalNodes = nodes.reduce((s, n) => s + (Number(n.no_of_nodes) || 0), 0);
  const totalCable = nodes.reduce((s, n) => s + (Number(n.cable_length_km) || 0), 0);

  const thClass = "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const tdClass = "px-3 py-2";
  const inputClass = "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("account_id", selectedAccount);
    fd.set("node_details", JSON.stringify(nodes));
    // resolve project: if free text matches a known project, send project_id; else send free text
    const matched = projects.find(p => p.name.toLowerCase() === projectFree.trim().toLowerCase());
    if (matched) { fd.set("project_id", matched.id); fd.delete("project_name_free"); }
    else if (projectFree.trim()) { fd.set("project_name_free", projectFree.trim()); fd.delete("project_id"); }
    else fd.delete("project_id");
    startTransition(async () => {
      const res = await createClientBilling(fd);
      if ((res as any).error) setError((res as any).error);
      else if ((res as any).id) router.push(`/dashboard/client-invoices/${(res as any).id}`);
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client-invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">New Billing Record</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">One row = one billing linked to a client and optionally a project.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Client <span className="text-rose-500">*</span></label>
            <select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} required className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
              <option value="">Select client…</option>
              {accounts.map(a=> <option key={a.id} value={a.id}>{a.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Project <span className="text-slate-400 font-normal">(optional — type to create)</span></label>
            <Combobox options={projectNames} value={projectFree} onChange={setProjectFree} placeholder="Select or type a project…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Invoice Number" name="invoice_number" placeholder="e.g. 0092 — optional, set at approval" />
            <Field label="Invoice Batch" name="invoice_batch" placeholder="e.g. QC 22" />
          </div>
          <p className="text-xs text-slate-400 -mt-3">Invoice number is optional at creation; Sky Technical will set it on approval.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount VAT-ex (PHP)" name="amount_vat_ex" type="number" placeholder="23035.71" />
            <Field label="Amount VAT-inc (PHP)" name="amount_vat_inc" type="number" placeholder="25339.29" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Due Date" name="due_date" type="date" />
            <Field label="Est. Payment Date" name="est_payment_date" type="date" />
          </div>
          <p className="text-xs text-slate-400 -mt-3">Due date defaults to invoice date + 30 days if left blank.</p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">RTD Document Link</label>
            <input type="url" name="rtd_url" placeholder="https://… (SharePoint)" className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Notes</label>
            <textarea name="notes" rows={3} placeholder="Any remarks…" className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white resize-none" />
          </div>
        </div>

        {/* Node Details */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Node Details</h2>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{nodes.length}</span>
            </div>
            <button type="button" onClick={addNode} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all">
              <Plus className="h-3.5 w-3.5" /> Add Node
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                  <th className={`${thClass} w-12`}>S/N</th>
                  <th className={thClass}>Region</th>
                  <th className={thClass}>Area / City</th>
                  <th className={`${thClass} w-28`}>Node ID</th>
                  <th className={`${thClass} w-20`}>Phase</th>
                  <th className={`${thClass} w-24`}>Nodes</th>
                  <th className={`${thClass} w-28`}>Cable (KM)</th>
                  <th className={`${thClass} w-16 text-center`}>MRS</th>
                  <th className={`${thClass} w-10`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {nodes.map((n, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>{idx + 1}</td>
                    <td className={tdClass}><Combobox options={REGION_NAMES} value={n.region} onChange={v => { updateNode(idx, "region", v); const a = areaByRegion[v] || []; if (!a.includes(n.area_city)) updateNode(idx, "area_city", ""); }} placeholder="Region" /></td>
                    <td className={tdClass}><Combobox options={areaByRegion[n.region] || []} value={n.area_city} onChange={v => updateNode(idx, "area_city", v)} placeholder="Area / City" /></td>
                    <td className={tdClass}><input type="text" value={n.node_id} onChange={e => updateNode(idx, "node_id", e.target.value)} onPaste={handleNodeIdPaste} className={inputClass} placeholder="e.g. MN113" /></td>
                    <td className={tdClass}><input type="text" value={n.phase} onChange={e => updateNode(idx, "phase", e.target.value)} className={inputClass} placeholder="Phase" /></td>
                    <td className={tdClass}><input type="number" min="0" value={n.no_of_nodes || ""} onChange={e => updateNode(idx, "no_of_nodes", parseInt(e.target.value) || 0)} className={`${inputClass} text-right`} placeholder="0" /></td>
                    <td className={tdClass}><input type="number" min="0" step="any" value={n.cable_length_km || ""} onChange={e => updateNode(idx, "cable_length_km", parseFloat(e.target.value) || 0)} className={`${inputClass} text-right`} placeholder="0.00" /></td>
                    <td className={`${tdClass} text-center`}><input type="checkbox" checked={n.has_mrs} onChange={e => updateNode(idx, "has_mrs", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" /></td>
                    <td className={tdClass}><button type="button" onClick={() => removeNode(idx)} disabled={nodes.length <= 1} className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                  <td colSpan={5} className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">{totalNodes.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">{totalCable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800/50">Paste Node IDs from Excel (tab-separated Node ID + Cable Length). Check MRS if Material Return Slip is available for that node.</p>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl">{error}</p>}

        <div className="flex justify-end gap-3">
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

function Field({ label, name, type="text", placeholder }: { label:string; name:string; type?:string; placeholder?:string }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">{label}</label>
      <input type={type} name={name} placeholder={placeholder} className="w-full rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );
}
