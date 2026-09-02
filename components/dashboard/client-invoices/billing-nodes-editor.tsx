"use client";

import { useState, useCallback, useTransition } from "react";
import { Plus, Trash2, MapPin, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { updateClientBillingNodes } from "@/app/dashboard/client-invoices/actions";
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

export function BillingNodesEditor({ billingId, initialNodes }: { billingId: string; initialNodes: any[] }) {
  const [editing, setEditing] = useState(false);
  const [nodes, setNodes] = useState<NodeRow[]>(
    initialNodes.length ? initialNodes.map(n => ({ region: n.region || "", area_city: n.area_city || "", node_id: n.node_id || "", phase: n.phase || "1", no_of_nodes: n.no_of_nodes ?? 1, cable_length_km: Number(n.cable_length_km) || 0, has_mrs: !!n.has_mrs })) : [{ ...EMPTY }]
  );
  const [isPending, startTransition] = useTransition();

  const update = useCallback((idx: number, field: keyof NodeRow, value: string | number | boolean) => {
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
    fd.set("node_details", JSON.stringify(nodes));
    startTransition(async () => {
      const res = await updateClientBillingNodes(billingId, fd);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("Nodes updated"); setEditing(false); }
    });
  };

  const th = "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const td = "px-3 py-2";
  const inp = "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

  if (!editing) {
    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Node Details</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{initialNodes.length || nodes.length}</span>
          </div>
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
        {initialNodes.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No nodes added yet.</p>
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
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Edit Node Details</h2>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{nodes.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNodes(initialNodes.length ? initialNodes.map((n: any) => ({ region: n.region || "", area_city: n.area_city || "", node_id: n.node_id || "", phase: n.phase || "1", no_of_nodes: n.no_of_nodes ?? 1, cable_length_km: Number(n.cable_length_km) || 0, has_mrs: !!n.has_mrs })) : [{ ...EMPTY }]); setEditing(false); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button onClick={() => setNodes(prev => [...prev, { ...EMPTY }])} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg">
            <Plus className="h-3.5 w-3.5" /> Add Node
          </button>
          <button onClick={handleSave} disabled={isPending} className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save"}
          </button>
        </div>
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
                <td className={td}><Combobox options={REGION_NAMES} value={n.region} onChange={v => { update(idx, "region", v); const a = areaByRegion[v] || []; if (!a.includes(n.area_city)) update(idx, "area_city", ""); }} placeholder="Region" /></td>
                <td className={td}><Combobox options={areaByRegion[n.region] || []} value={n.area_city} onChange={v => update(idx, "area_city", v)} placeholder="Area / City" /></td>
                <td className={td}><input type="text" value={n.node_id} onChange={e => update(idx, "node_id", e.target.value)} onPaste={handlePaste} className={inp} placeholder="MN113" /></td>
                <td className={td}><input type="text" value={n.phase} onChange={e => update(idx, "phase", e.target.value)} className={inp} /></td>
                <td className={td}><input type="number" min="0" value={n.no_of_nodes || ""} onChange={e => update(idx, "no_of_nodes", parseInt(e.target.value) || 0)} className={`${inp} text-right`} /></td>
                <td className={td}><input type="number" min="0" step="any" value={n.cable_length_km || ""} onChange={e => update(idx, "cable_length_km", parseFloat(e.target.value) || 0)} className={`${inp} text-right`} /></td>
                <td className={`${td} text-center`}><input type="checkbox" checked={n.has_mrs} onChange={e => update(idx, "has_mrs", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" /></td>
                <td className={td}><button type="button" onClick={() => setNodes(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))} disabled={nodes.length <= 1} className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
