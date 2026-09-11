"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Plus, FileText, ChevronRight, Clock, Upload, Search, X, SlidersHorizontal } from "lucide-react";
import { billingStatusBadgeClasses, billingStatusShortLabel, agingBand, agingBadgeClasses, agingLabel } from "@/lib/billing/status";
import { LIST_PAGE_SIZE } from "@/components/ui/pagination-utils";

type Row = {
  id: string;
  invoice_number: string | null;
  invoice_batch: string | null;
  region: string | null;
  num_nodes: number | null;
  date_issued: string | null;
  date_endorsed: string | null;
  due_date: string | null;
  est_payment_date: string | null;
  collected_at: string | null;
  amount_vat_inc: number;
  amount_vat_ex: number;
  status: string;
  project_name_free: string | null;
  account_id: string;
  project_id: string | null;
  crm_accounts: { company_name: string } | null;
  projects: { name: string } | null;
};

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  }, [options, q]);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          value={open ? q : selectedLabel}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQ(selectedLabel); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (e.target.value === "") onChange(""); }}
          className="w-full pl-8 pr-3 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          <button onClick={() => { onChange(""); setQ(""); setOpen(false); }} className={`w-full text-left px-3 py-2 text-sm ${!value ? "bg-primary/10 text-primary" : "hover:bg-slate-50"}`}>{placeholder}</button>
          {filtered.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setQ(o.label); setOpen(false); }} className={`w-full text-left px-3 py-2 text-sm ${value===o.value?"bg-primary/10 text-primary":"hover:bg-slate-50"}`}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientBillingClient({
  initialRows,
  mrsMap: initialMrsMap,
  accounts,
  projects,
  regions,
  batches,
}: {
  initialRows: Row[];
  mrsMap: Map<string, { total: number; withMrs: number }>;
  accounts: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  regions: string[];
  batches: string[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // local filter state - instant, no debounce for table
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [aging, setAging] = useState(searchParams.get("aging") || "all");
  const [client, setClient] = useState(searchParams.get("client") || "");
  const [project, setProject] = useState(searchParams.get("project") || "");
  const [region, setRegion] = useState(searchParams.get("region") || "");
  const [batch, setBatch] = useState(searchParams.get("batch") || "");
  const [amountMin, setAmountMin] = useState(searchParams.get("amountMin") || "");
  const [amountMax, setAmountMax] = useState(searchParams.get("amountMax") || "");
  const [issuedFrom, setIssuedFrom] = useState(searchParams.get("issuedFrom") || "");
  const [issuedTo, setIssuedTo] = useState(searchParams.get("issuedTo") || "");
  const [dueFrom, setDueFrom] = useState(searchParams.get("dueFrom") || "");
  const [dueTo, setDueTo] = useState(searchParams.get("dueTo") || "");
  const [estFrom, setEstFrom] = useState(searchParams.get("estFrom") || "");
  const [estTo, setEstTo] = useState(searchParams.get("estTo") || "");
  const [collectedFrom, setCollectedFrom] = useState(searchParams.get("collectedFrom") || "");
  const [collectedTo, setCollectedTo] = useState(searchParams.get("collectedTo") || "");
  const [endorsedFrom, setEndorsedFrom] = useState(searchParams.get("endorsedFrom") || "");
  const [endorsedTo, setEndorsedTo] = useState(searchParams.get("endorsedTo") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || "1"));
  const [filtersOpen, setFiltersOpen] = useState(false);

  // sync URL debounced 500ms, not blocking table
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "all") params.set("status", status);
      if (aging !== "all") params.set("aging", aging);
      if (client) params.set("client", client);
      if (project) params.set("project", project);
      if (region) params.set("region", region);
      if (batch) params.set("batch", batch);
      if (amountMin) params.set("amountMin", amountMin);
      if (amountMax) params.set("amountMax", amountMax);
      if (issuedFrom) params.set("issuedFrom", issuedFrom);
      if (issuedTo) params.set("issuedTo", issuedTo);
      if (dueFrom) params.set("dueFrom", dueFrom);
      if (dueTo) params.set("dueTo", dueTo);
      if (estFrom) params.set("estFrom", estFrom);
      if (estTo) params.set("estTo", estTo);
      if (collectedFrom) params.set("collectedFrom", collectedFrom);
      if (collectedTo) params.set("collectedTo", collectedTo);
      if (endorsedFrom) params.set("endorsedFrom", endorsedFrom);
      if (endorsedTo) params.set("endorsedTo", endorsedTo);
      if (page !== 1) params.set("page", String(page));
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    }, 500);
    return () => clearTimeout(t);
  }, [q,status,aging,client,project,region,batch,amountMin,amountMax,issuedFrom,issuedTo,dueFrom,dueTo,estFrom,estTo,collectedFrom,collectedTo,endorsedFrom,endorsedTo,page,pathname]);

  const todayStr = new Date().toISOString().split("T")[0]!;
  const plusDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().split("T")[0]!;

  const filtered = useMemo(() => {
    let out = initialRows as Row[];
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter(r => (r.invoice_number?.toLowerCase().includes(needle) || r.invoice_batch?.toLowerCase().includes(needle)));
    }
    if (status !== "all") out = out.filter(r => r.status === status);
    if (aging !== "all") {
      out = out.filter(r => {
        const ag = agingBand(r as any);
        if (aging === "overdue") return ag.band === "overdue";
        if (aging === "close_due") return ag.band === "close_due";
        if (aging === "healthy") return ag.band === "healthy";
        return false;
      });
    }
    if (client) out = out.filter(r => r.account_id === client);
    if (project) out = out.filter(r => r.project_id === project);
    if (region) out = out.filter(r => r.region === region);
    if (batch) out = out.filter(r => r.invoice_batch === batch);
    if (amountMin) out = out.filter(r => Number(r.amount_vat_inc) >= Number(amountMin));
    if (amountMax) out = out.filter(r => Number(r.amount_vat_inc) <= Number(amountMax));
    if (issuedFrom) out = out.filter(r => r.date_issued && r.date_issued >= issuedFrom);
    if (issuedTo) out = out.filter(r => r.date_issued && r.date_issued <= issuedTo);
    if (dueFrom) out = out.filter(r => r.due_date && r.due_date >= dueFrom);
    if (dueTo) out = out.filter(r => r.due_date && r.due_date <= dueTo);
    if (estFrom) out = out.filter(r => r.est_payment_date && r.est_payment_date >= estFrom);
    if (estTo) out = out.filter(r => r.est_payment_date && r.est_payment_date <= estTo);
    if (endorsedFrom) out = out.filter(r => r.date_endorsed && r.date_endorsed >= endorsedFrom);
    if (endorsedTo) out = out.filter(r => r.date_endorsed && r.date_endorsed <= endorsedTo);
    if (collectedFrom) out = out.filter(r => r.collected_at && r.collected_at >= `${collectedFrom}T00:00:00+08:00`);
    if (collectedTo) out = out.filter(r => r.collected_at && r.collected_at < `${plusDays(collectedTo,1)}T00:00:00+08:00`);
    return out;
  }, [initialRows, q, status, aging, client, project, region, batch, amountMin, amountMax, issuedFrom, issuedTo, dueFrom, dueTo, estFrom, estTo, endorsedFrom, endorsedTo, collectedFrom, collectedTo]);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [q,status,aging,client,project,region,batch,amountMin,amountMax,issuedFrom,issuedTo,dueFrom,dueTo,estFrom,estTo,collectedFrom,collectedTo,endorsedFrom,endorsedTo]);

  const total = filtered.length;
  const paged = useMemo(() => {
    const from = (page - 1) * LIST_PAGE_SIZE;
    return filtered.slice(from, from + LIST_PAGE_SIZE);
  }, [filtered, page]);

  const filteredSum = useMemo(() => filtered.reduce((a, r) => a + Number(r.amount_vat_inc || 0), 0), [filtered]);
  const overdueSum = useMemo(() => filtered.filter(r => r.due_date && ["for_payment","pending_payment"].includes(r.status) && r.due_date < todayStr).reduce((a, r) => a + Number(r.amount_vat_inc || 0), 0), [filtered, todayStr]);
  const collectedSum = useMemo(() => filtered.filter(r => r.status === "collected").reduce((a, r) => a + Number(r.amount_vat_inc || 0), 0), [filtered]);

  const hasActive = [client,project,region,batch,amountMin,amountMax,issuedFrom,issuedTo,dueFrom,dueTo,estFrom,estTo,collectedFrom,collectedTo,endorsedFrom,endorsedTo].some(Boolean);
  const activeCount = [client,project,region,batch,amountMin,amountMax,issuedFrom,issuedTo,dueFrom,dueTo,estFrom,estTo,collectedFrom,collectedTo,endorsedFrom,endorsedTo].filter(Boolean).length;
  const clearAll = () => { setClient(""); setProject(""); setRegion(""); setBatch(""); setAmountMin(""); setAmountMax(""); setIssuedFrom(""); setIssuedTo(""); setDueFrom(""); setDueTo(""); setEstFrom(""); setEstTo(""); setCollectedFrom(""); setCollectedTo(""); setEndorsedFrom(""); setEndorsedTo(""); };

  const inp = "w-full px-3 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input placeholder="Search invoice no. or batch..." value={q} onChange={e=>setQ(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="px-4 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm">
            <option value="all">All Statuses</option>
            <option value="for_billing">For Billing</option>
            <option value="pending_sky_technical">Submitted to Sky Technical</option>
            <option value="for_payment">For Payment</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="collected">Collected</option>
          </select>
          <select value={aging} onChange={e=>setAging(e.target.value)} className="px-4 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm">
            <option value="all">All Aging</option>
            <option value="overdue">Overdue</option>
            <option value="close_due">Close Due (≤7d)</option>
            <option value="healthy">Healthy (&gt;7d)</option>
          </select>
          <div className="inline-flex items-center gap-2 shrink-0">
            <button onClick={()=>setFiltersOpen(!filtersOpen)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${hasActive?"bg-primary text-white border-primary":"bg-white dark:bg-[#071F15] border-slate-200 dark:border-slate-800"}`}>
              <SlidersHorizontal className="h-4 w-4"/> Filters {activeCount>0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${hasActive?"bg-white text-primary":"bg-primary text-white"}`}>{activeCount}</span>}
            </button>
            {hasActive && <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-slate-500"><X className="h-3 w-3"/> Clear</button>}
          </div>
        </div>
        {filtersOpen && (
          <div className="basis-full w-full p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Client</label><SearchableSelect value={client} placeholder="All Clients" options={accounts.map(a=>({value:a.id,label:a.name}))} onChange={setClient} /></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Project</label><SearchableSelect value={project} placeholder="All Projects" options={projects.map(p=>({value:p.id,label:p.name}))} onChange={setProject} /></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Region</label><SearchableSelect value={region} placeholder="All Regions" options={regions.map(r=>({value:r,label:r}))} onChange={setRegion} /></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Batch</label><SearchableSelect value={batch} placeholder="All Batches" options={batches.map(b=>({value:b,label:b}))} onChange={setBatch} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount VAT-inc</label><div className="flex gap-2"><input type="number" placeholder="Min" value={amountMin} onChange={e=>setAmountMin(e.target.value)} className={inp}/><input type="number" placeholder="Max" value={amountMax} onChange={e=>setAmountMax(e.target.value)} className={inp}/></div></div>
              <div className="flex items-end"><p className="text-xs text-slate-400">Instant, no debounce for amounts.</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Issued Date</label><div className="flex gap-2"><input type="date" value={issuedFrom} onChange={e=>setIssuedFrom(e.target.value)} className={inp}/><input type="date" value={issuedTo} onChange={e=>setIssuedTo(e.target.value)} className={inp}/></div></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Due Date</label><div className="flex gap-2"><input type="date" value={dueFrom} onChange={e=>setDueFrom(e.target.value)} className={inp}/><input type="date" value={dueTo} onChange={e=>setDueTo(e.target.value)} className={inp}/></div></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Est. Payment</label><div className="flex gap-2"><input type="date" value={estFrom} onChange={e=>setEstFrom(e.target.value)} className={inp}/><input type="date" value={estTo} onChange={e=>setEstTo(e.target.value)} className={inp}/></div></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Collected (actual)</label><div className="flex gap-2"><input type="date" value={collectedFrom} onChange={e=>setCollectedFrom(e.target.value)} className={inp}/><input type="date" value={collectedTo} onChange={e=>setCollectedTo(e.target.value)} className={inp}/></div></div>
              <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Endorsed</label><div className="flex gap-2"><input type="date" value={endorsedFrom} onChange={e=>setEndorsedFrom(e.target.value)} className={inp}/><input type="date" value={endorsedTo} onChange={e=>setEndorsedTo(e.target.value)} className={inp}/></div></div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Invoice</th>
              <th className="px-6 py-4 font-semibold">Client / Project</th>
              <th className="px-6 py-4 font-semibold">Batch · Region</th>
              <th className="px-6 py-4 font-semibold">MRS</th>
              <th className="px-6 py-4 font-semibold">Amount (VAT-inc)</th>
              <th className="px-6 py-4 font-semibold">Due · Aging</th>
              <th className="px-6 py-4 font-semibold">Est. Payment</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {paged.length===0 ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center"><div className="flex flex-col items-center text-slate-500"><div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3"><FileText className="h-6 w-6 text-slate-400"/></div><p className="font-medium text-slate-900 dark:text-white">No billing records</p></div></td></tr>
            ) : paged.map((r:any)=>{
              const ag = agingBand(r as any);
              const mrs = initialMrsMap.get(r.id);
              return (
                <tr key={r.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <td className="px-6 py-4 whitespace-nowrap"><div className="font-bold text-slate-900 dark:text-white">{r.invoice_number||"—"}</div><div className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap"><Clock className="h-3 w-3"/>{r.date_issued?new Date(r.date_issued).toLocaleDateString("en-US",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric"}):"—"}</div></td>
                  <td className="px-6 py-4"><div className="font-medium text-slate-900 dark:text-white">{r.crm_accounts?.company_name||"—"}</div><div className="text-xs text-slate-400">{r.projects?.name||r.project_name_free||"No project"}</div></td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400"><div className="text-xs">{r.invoice_batch||"—"} {r.region?`· ${r.region}`:""} {r.num_nodes?`· ${r.num_nodes} nodes`:""}</div></td>
                  <td className={`px-6 py-4 text-xs ${!mrs?"text-slate-400":mrs.withMrs/mrs.total>0.5?"text-emerald-600 font-medium":"text-amber-600 font-medium"}`}>{mrs?`${mrs.withMrs}/${mrs.total} MRS`:"—"}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">₱ {Number(r.amount_vat_inc||0).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.due_date?new Date(r.due_date).toLocaleDateString("en-US",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric"}):"—"}</div>{ag.band && <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${agingBadgeClasses(ag.band)}`}>{agingLabel(ag.band, ag.daysDelayed)}</span>}</td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">{r.est_payment_date?new Date(r.est_payment_date).toLocaleDateString("en-US",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric"}):"—"}</td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center rounded-full font-bold border whitespace-nowrap ${r.status==="pending_sky_technical"?"text-[9px] px-2 py-0.5":"text-[10px] px-2.5 py-1"} ${billingStatusBadgeClasses(r.status)}`}>{billingStatusShortLabel(r.status).toUpperCase()}</span>{r.status==="collected"&&r.collected_at?<div className="text-[11px] text-emerald-600 mt-1">{new Date(r.collected_at).toLocaleDateString("en-US",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric"})}</div>:null}</td>
                  <td className="px-6 py-4 text-right"><Link href={`/dashboard/client-invoices/${r.id}`} className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 group-hover:text-primary group-hover:bg-primary/10"><ChevronRight className="h-5 w-5"/></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-slate-50 dark:bg-[#0a0a0a]/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-slate-400"/>{total} invoice{total!==1?"s":""} (filtered)</span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">₱ {filteredSum.toLocaleString()} VAT-inc</span>
          {overdueSum>0 && <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs font-bold text-red-600">Overdue ₱ {overdueSum.toLocaleString()}</span>}
          {collectedSum>0 && <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-600">Collected ₱ {collectedSum.toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded-lg border text-xs disabled:opacity-50">Prev</button>
          <span className="text-xs text-slate-500">Page {page} of {Math.max(1,Math.ceil(total/LIST_PAGE_SIZE))}</span>
          <button disabled={page>=Math.ceil(total/LIST_PAGE_SIZE)} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded-lg border text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
