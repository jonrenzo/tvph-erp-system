"use client";

import { useState, useCallback, useTransition } from "react";
import { Pencil, Save, X, ExternalLink, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { updateClientBilling } from "@/app/dashboard/client-invoices/actions";
import { Combobox } from "@/components/ui/combobox";
import { REGIONS, REGION_NAMES } from "@/lib/constants/philippine-regions";
import { parseSiteDetailClipboard } from "@/utils/site-detail-parser";

interface NodeRow {
  region: string;
  area_city: string;
  node_id: string;
  phase: string;
  no_of_nodes: number;
  cable_length_km: number;
  has_mrs: boolean;
}

const areaByRegion: Record<string, string[]> = REGIONS;
const EMPTY: NodeRow = { region: "", area_city: "", node_id: "", phase: "1", no_of_nodes: 1, cable_length_km: 0, has_mrs: false };

type Row = {
  id: string;
  invoice_number: string | null;
  invoice_batch: string | null;
  project_id: string | null;
  project_name_free: string | null;
  amount_vat_ex: number;
  amount_vat_inc: number;
  due_date: string | null;
  est_payment_date: string | null;
  notes: string | null;
  file_url: string | null;
  region: string | null;
  num_nodes: number | null;
  date_issued: string;
  date_endorsed: string | null;
  collected_at: string | null;
  crm_accounts?: { company_name: string } | null;
  projects?: { id: string; name: string } | null;
};

export function BillingDetailEditor({ billingId, row, initialNodes, projects }: { billingId: string; row: Row; initialNodes: any[]; projects: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // form state
  const [invoiceNumber, setInvoiceNumber] = useState(row.invoice_number || "");
  const [invoiceBatch, setInvoiceBatch] = useState(row.invoice_batch || "");
  const [projectFree, setProjectFree] = useState(row.projects?.name || row.project_name_free || "");
  const [vatEx, setVatEx] = useState(String(row.amount_vat_ex ?? ""));
  const [vatInc, setVatInc] = useState(String(row.amount_vat_inc ?? ""));
  const [dueDate, setDueDate] = useState(row.due_date || "");
  const [estDate, setEstDate] = useState(row.est_payment_date || "");
  const [rtdUrl, setRtdUrl] = useState(row.file_url || "");
  const [notes, setNotes] = useState(row.notes || "");
  const [nodes, setNodes] = useState<NodeRow[]>(
    initialNodes.length ? initialNodes.map(n => ({ region: n.region || "", area_city: n.area_city || "", node_id: n.node_id || "", phase: n.phase || "1", no_of_nodes: n.no_of_nodes ?? 1, cable_length_km: Number(n.cable_length_km) || 0, has_mrs: !!n.has_mrs })) : [{ ...EMPTY }]
  );

  const projectNames = projects.map(p => p.name);

  const reset = useCallback(() => {
    setInvoiceNumber(row.invoice_number || "");
    setInvoiceBatch(row.invoice_batch || "");
    setProjectFree(row.projects?.name || row.project_name_free || "");
    setVatEx(String(row.amount_vat_ex ?? ""));
    setVatInc(String(row.amount_vat_inc ?? ""));
    setDueDate(row.due_date || "");
    setEstDate(row.est_payment_date || "");
    setRtdUrl(row.file_url || "");
    setNotes(row.notes || "");
    setNodes(initialNodes.length ? initialNodes.map((n: any) => ({ region: n.region || "", area_city: n.area_city || "", node_id: n.node_id || "", phase: n.phase || "1", no_of_nodes: n.no_of_nodes ?? 1, cable_length_km: Number(n.cable_length_km) || 0, has_mrs: !!n.has_mrs })) : [{ ...EMPTY }]);
  }, [row, initialNodes]);

  const cancel = () => { reset(); setEditing(false); };

  const updateNode = useCallback((idx: number, field: keyof NodeRow, value: string | number | boolean) => {
    setNodes(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (idx === 0 && (field === "region" || field === "area_city")) {
        for (let i = 1; i < next.length; i++) (next[i] as any)[field] = value;
      }
      return next;
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const { rows, warnings } = parseSiteDetailClipboard(e.clipboardData.getData("text/plain"));
    if (!rows.length) { if (warnings.length) { e.preventDefault(); toast.error(warnings.join("; ")); } return; }
    e.preventDefault();
    setNodes(prev => {
      const isTemplate = prev.every(s => !s.node_id);
      const t = isTemplate ? prev[0] : undefined;
      const newRows: NodeRow[] = rows.map(r => ({ region: t?.region || "", area_city: t?.area_city || "", node_id: r.node_id, phase: t?.phase || "1", no_of_nodes: t?.no_of_nodes || 1, cable_length_km: r.cable_length_km, has_mrs: false }));
      return isTemplate ? newRows : [...prev, ...newRows];
    });
    toast.success(`Added ${rows.length} node(s)`);
  }, []);

  const handleSave = () => {
    const fd = new FormData();
    fd.set("invoice_number", invoiceNumber);
    fd.set("invoice_batch", invoiceBatch);
    const matched = projects.find(p => p.name.toLowerCase() === projectFree.trim().toLowerCase());
    if (matched) { fd.set("project_id", matched.id); fd.delete("project_name_free" as any); }
    else if (projectFree.trim()) { fd.set("project_name_free", projectFree.trim()); fd.set("project_id", ""); }
    else { fd.set("project_id", ""); fd.set("project_name_free", ""); }
    fd.set("amount_vat_ex", vatEx);
    fd.set("amount_vat_inc", vatInc);
    fd.set("due_date", dueDate);
    fd.set("est_payment_date", estDate);
    fd.set("rtd_url", rtdUrl);
    fd.set("notes", notes);
    fd.set("node_details", JSON.stringify(nodes));
    startTransition(async () => {
      const res = await updateClientBilling(billingId, fd);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("Billing updated"); setEditing(false); }
    });
  };

  const th = "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const td = "px-3 py-2";
  const inp = "w-full px-3 py-2 bg-white dark:bg-white border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const inpDark = "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

  if (!editing) {
    return (
      <>
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Details</p>
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-slate-400">Invoice Number</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.invoice_number || '—'}</p></div>
            <div><p className="text-xs text-slate-400">Invoice Batch</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.invoice_batch || '—'}</p></div>
            <div><p className="text-xs text-slate-400">Project</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.projects?.name || row.project_name_free || '—'}</p></div>
            <div><p className="text-xs text-slate-400">Region</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.region || '—'}</p></div>
            <div><p className="text-xs text-slate-400"># Nodes</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.num_nodes ?? '—'}</p></div>
            <div><p className="text-xs text-slate-400">Date Issued</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.date_issued ? new Date(row.date_issued).toLocaleDateString() : '—'}</p></div>
            <div><p className="text-xs text-slate-400">Date Endorsed</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.date_endorsed ? new Date(row.date_endorsed).toLocaleDateString() : '—'}</p></div>
            <div><p className="text-xs text-slate-400">Due Date</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'}</p></div>
            <div><p className="text-xs text-slate-400">Est. Payment</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.est_payment_date ? new Date(row.est_payment_date).toLocaleDateString() : '—'}</p></div>
            <div><p className="text-xs text-slate-400">Collected At</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">{row.collected_at ? new Date(row.collected_at).toLocaleDateString() : '—'}</p></div>
            <div><p className="text-xs text-slate-400">VAT-ex</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">₱ {Number(row.amount_vat_ex || 0).toLocaleString()}</p></div>
            <div><p className="text-xs text-slate-400">VAT-inc</p><p className="font-medium text-slate-900 dark:text-white mt-0.5">₱ {Number(row.amount_vat_inc || 0).toLocaleString()}</p></div>
            {row.file_url && <div><p className="text-xs text-slate-400">RTD Document</p><a href={row.file_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline mt-0.5 inline-flex items-center gap-1">View RTD <ExternalLink className="h-3 w-3" /></a></div>}
          </div>
          {row.notes && <div className="pt-2 border-t border-slate-100 dark:border-white/10"><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-700 dark:text-slate-300">{row.notes}</p></div>}
        </div>

        {/* Read-only node table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Node Details</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{initialNodes.length}</span>
          </div>
          {initialNodes.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No nodes added yet. Click Edit above to add nodes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                  <th className={`${th} w-10`}>S/N</th><th className={th}>Region</th><th className={th}>Area / City</th><th className={th}>Node ID</th><th className={th}>Phase</th><th className={th}>Nodes</th><th className={th}>Cable (KM)</th><th className={`${th} text-center`}>MRS</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {initialNodes.map((n: any, i: number) => (
                    <tr key={i}><td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">{i + 1}</td><td className="px-3 py-2">{n.region || "—"}</td><td className="px-3 py-2">{n.area_city || "—"}</td><td className="px-3 py-2 font-medium">{n.node_id || "—"}</td><td className="px-3 py-2">{n.phase || "—"}</td><td className="px-3 py-2 text-right">{n.no_of_nodes}</td><td className="px-3 py-2 text-right">{Number(n.cable_length_km).toFixed(2)}</td><td className="px-3 py-2 text-center">{n.has_mrs ? "✓" : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // Editing mode: single form covering details + nodes
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Edit Details</p>
          <div className="flex items-center gap-2">
            <button onClick={cancel} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg"><X className="h-3.5 w-3.5" /> Cancel</button>
            <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Apply"}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Invoice Number</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. 0092" className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Invoice Batch</label><input value={invoiceBatch} onChange={e => setInvoiceBatch(e.target.value)} placeholder="e.g. QC 22" className={inp} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Project</label><Combobox options={projectNames} value={projectFree} onChange={setProjectFree} placeholder="Select or type a project…" /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount VAT-ex (PHP)</label><input type="number" value={vatEx} onChange={e => setVatEx(e.target.value)} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount VAT-inc (PHP)</label><input type="number" value={vatInc} onChange={e => setVatInc(e.target.value)} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Est. Payment Date</label><input type="date" value={estDate} onChange={e => setEstDate(e.target.value)} className={inp} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">RTD Document Link</label><input type="url" value={rtdUrl} onChange={e => setRtdUrl(e.target.value)} placeholder="https://… (SharePoint)" className={inp} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} /></div>
        </div>
      </div>

      {/* Nodes editing */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Node Details</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{nodes.length}</span>
          </div>
          <button type="button" onClick={() => setNodes(prev => [...prev, { ...EMPTY }])} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg"><Plus className="h-3.5 w-3.5" /> Add Node</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
              <th className={`${th} w-10`}>S/N</th><th className={th}>Region</th><th className={th}>Area / City</th><th className={`${th} w-28`}>Node ID</th><th className={`${th} w-20`}>Phase</th><th className={`${th} w-20`}>Nodes</th><th className={`${th} w-28`}>Cable (KM)</th><th className={`${th} w-14 text-center`}>MRS</th><th className={`${th} w-10`}></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {nodes.map((n, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td className={`${td} text-center text-slate-400 font-mono text-xs`}>{idx + 1}</td>
                  <td className={td}><Combobox options={REGION_NAMES} value={n.region} onChange={v => { updateNode(idx, "region", v); const a = areaByRegion[v] || []; if (!a.includes(n.area_city)) updateNode(idx, "area_city", ""); }} placeholder="Region" /></td>
                  <td className={td}><Combobox options={areaByRegion[n.region] || []} value={n.area_city} onChange={v => updateNode(idx, "area_city", v)} placeholder="Area / City" /></td>
                  <td className={td}><input type="text" value={n.node_id} onChange={e => updateNode(idx, "node_id", e.target.value)} onPaste={handlePaste} className={inpDark} placeholder="MN113" /></td>
                  <td className={td}><input type="text" value={n.phase} onChange={e => updateNode(idx, "phase", e.target.value)} className={inpDark} /></td>
                  <td className={td}><input type="number" min="0" value={n.no_of_nodes || ""} onChange={e => updateNode(idx, "no_of_nodes", parseInt(e.target.value) || 0)} className={`${inpDark} text-right`} /></td>
                  <td className={td}><input type="number" min="0" step="any" value={n.cable_length_km || ""} onChange={e => updateNode(idx, "cable_length_km", parseFloat(e.target.value) || 0)} className={`${inpDark} text-right`} /></td>
                  <td className={`${td} text-center`}><input type="checkbox" checked={n.has_mrs} onChange={e => updateNode(idx, "has_mrs", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" /></td>
                  <td className={td}><button type="button" onClick={() => setNodes(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))} disabled={nodes.length <= 1} className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
