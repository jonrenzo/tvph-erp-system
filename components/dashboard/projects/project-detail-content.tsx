"use client";

import { useState, useActionState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FolderGit2, Edit2, ExternalLink, Clock, FileText, Building2,
  Package, Plus, Unlink, Loader2, AlertCircle, Users, Upload,
  TrendingUp, CircleDollarSign, CreditCard, CheckCircle2,
} from "lucide-react";
import { updateProject, uploadContractDocument } from "@/app/dashboard/projects/actions";
import { linkVendorToProject, removeVendorFromProject } from "@/app/dashboard/projects/actions";
import { getCompletionOverride, setCompletionOverride } from "@/lib/completion-override";
import Link from "next/link";

type Account = { id: string; company_name: string };

type Project = {
  id: string;
  name: string;
  description: string;
  account_id?: string | null;
  contract_file_url?: string | null;
  contract_file_name?: string | null;
  status: string;
  created_at: string;
  completion_pct?: number | null;
  crm_accounts?: Account | null;
};

type Vendor = { id: string; name: string; currency?: string };

type PO = {
  id: string;
  po_number: string;
  issued_date: string;
  amount: number;
  status: string;
  project_id: string | null;
  currency?: string;
  vendors?: Vendor;
};

type BillingPODetail = {
  poId: string;
  poNumber: string;
  vendorName: string;
  amount: number;
  dpAmount: number;
  invoiced: number;
  paid: number;
  billingPct: number;
  completionPct: number;
};

type BillingSummary = {
  totalPOValue: number;
  totalInvoiced: number;
  totalPaid: number;
  billingPct: number;
  completionPct: number;
  variance: number;
  poDetails: BillingPODetail[];
};

export function ProjectDetailContent({
  project,
  pos,
  linkedVendors,
  availableVendors,
  allAccounts,
  billingSummary,
}: {
  project: Project;
  pos: PO[];
  linkedVendors: Vendor[];
  availableVendors: Vendor[];
  allAccounts: Account[];
  billingSummary: BillingSummary;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedVendorToLink, setSelectedVendorToLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isPendingLink, startLinkTransition] = useTransition();
  const [isPendingRemove, startRemoveTransition] = useTransition();
  const [removingVendorId, setRemovingVendorId] = useState<string | null>(null);
  const [contractUploading, setContractUploading] = useState(false);
  const contractInputRef = useRef<HTMLInputElement>(null);
  // TEMPORARY: completion % is stored client-side only (localStorage) for testing,
  // since the projects.completion_pct DB column does not exist yet. See lib/completion-override.
  const [manualCompletionPct, setManualCompletionPct] = useState<number | null>(
    project.completion_pct ?? null
  );

  const [updateState, updateAction, isUpdating] = useActionState(updateProject, null);

  useEffect(() => {
    if (updateState?.success) setIsEditing(false);
  }, [updateState]);

  // Hydrate the manual completion % from the local (testing-only) override on mount.
  useEffect(() => {
    const override = getCompletionOverride(project.id);
    if (override !== null) setManualCompletionPct(override);
  }, [project.id]);

  const updateCompletionPct = (pct: number | null) => {
    setManualCompletionPct(pct);
    setCompletionOverride(project.id, pct); // local-only persistence (testing)
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "completed": return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "on_hold": return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  const getPOStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
      case "issued": return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";
      case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
    }
  };

  const handleLinkVendor = () => {
    if (!selectedVendorToLink) return;
    setLinkError(null);
    startLinkTransition(async () => {
      const result = await linkVendorToProject(project.id, selectedVendorToLink);
      if (result.error) { setLinkError(result.error); }
      else { setIsLinking(false); setSelectedVendorToLink(""); router.refresh(); }
    });
  };

  const handleRemoveVendor = (vendorId: string) => {
    setRemoveError(null);
    setRemovingVendorId(vendorId);
    startRemoveTransition(async () => {
      const result = await removeVendorFromProject(project.id, vendorId);
      if (result.error) { setRemoveError(result.error); }
      else { router.refresh(); }
      setRemovingVendorId(null);
    });
  };

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setContractUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const result = await uploadContractDocument(project.id, formData);
    setContractUploading(false);
    if (result.error) { alert(result.error); }
    else { router.refresh(); }
  };

  const totalPOValue = pos.reduce((sum, po) => sum + Number(po.amount), 0);
  const client = project.crm_accounts;
  const effectiveCompletionPct = manualCompletionPct ?? billingSummary.completionPct;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
        <Link href="/dashboard/projects" className="hover:text-primary transition-colors flex items-center gap-1.5">
          <FolderGit2 className="h-4 w-4" /> Projects
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
              {project.name}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}>
              {project.status.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
            {client ? (
              <Link
                href={`/dashboard/crm/${client.id}`}
                className="flex items-center gap-1.5 text-primary hover:underline font-medium"
              >
                <Users className="h-4 w-4" />
                {client.company_name}
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Users className="h-4 w-4" /> No client linked
              </span>
            )}
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 hover:border-primary/50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Edit2 className="h-4 w-4" /> Edit Project
          </button>
        )}
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-6 shadow-sm ring-1 ring-primary/20">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Edit Project Details</h3>
          <form action={updateAction} className="space-y-4">
            {updateState?.error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
                {updateState.error}
              </div>
            )}
            <input type="hidden" name="id" value={project.id} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Project Name</label>
                <input
                  name="name"
                  defaultValue={project.name}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                <select
                  name="status"
                  defaultValue={project.status}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Client</label>
                <select
                  name="account_id"
                  defaultValue={project.account_id || ""}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="">No client</option>
                  {allAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
                <textarea
                  name="description"
                  defaultValue={project.description}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" disabled={isUpdating} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all">
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {project.description && !isEditing && (
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-wider">Description</h3>
          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{project.description}</p>
        </div>
      )}

      {/* Progress & Billing Summary Card */}
      {pos.length > 0 && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Progress &amp; Billing</h2>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Progress Ring — now shows billing % */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative h-36 w-36">
                <svg className="h-full w-full -rotate-90">
                  <circle cx="72" cy="72" r="62" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
                  <circle cx="72" cy="72" r="62" fill="none" stroke="currentColor" strokeWidth="10"
                    strokeDasharray={390}
                    strokeDashoffset={390 - (390 * billingSummary.billingPct) / 100}
                    strokeLinecap="round"
                    className="text-blue-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{billingSummary.billingPct}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Billed</span>
                </div>
              </div>
              <div className="w-32">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Complete</span>
                  <span>{effectiveCompletionPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, effectiveCompletionPct)}%` }}></div>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">PO Total Value</label>
                <div className="text-xl font-bold text-slate-900 dark:text-white">₱{billingSummary.totalPOValue.toLocaleString()}</div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">PO Remaining Value</label>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  ₱{Math.max(0, billingSummary.totalPOValue - (billingSummary.totalInvoiced + pos.reduce((s, po) => s + Number((po as any).dp_amount || 0), 0))).toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Invoiced (+DP)</label>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">₱{(billingSummary.totalInvoiced + pos.reduce((s, po) => s + Number((po as any).dp_amount || 0), 0)).toLocaleString()}</span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{billingSummary.billingPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, billingSummary.billingPct)}%` }}></div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Paid</label>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">₱{billingSummary.totalPaid.toLocaleString()}</div>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Completion %
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={manualCompletionPct ?? ''}
                    placeholder={String(billingSummary.completionPct || 0)}
                    onChange={(e) => updateCompletionPct(e.target.value ? Math.min(100, Math.max(0, Number(e.target.value))) : null)}
                    className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-sm text-slate-500">/ 100</span>
                  {manualCompletionPct !== null && (
                    <button
                      onClick={() => updateCompletionPct(null)}
                      className="text-[10px] text-slate-400 hover:text-red-500 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">Saved locally for testing only (not persisted to the database).</p>
              </div>
            </div>

            {/* Variance — uses manual completion when set */}
            <div className="shrink-0 flex flex-col justify-center">
              {(() => {
                const effectiveComp = manualCompletionPct ?? billingSummary.completionPct;
                const effVariance = effectiveComp - billingSummary.billingPct;
                return effVariance > 0 ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl text-center">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Need to Pay</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{effVariance}%</p>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-1">more to match progress</p>
                  </div>
                ) : effVariance < 0 ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl text-center">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Overbilled</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-300">{Math.abs(effVariance)}%</p>
                    <p className="text-[10px] text-red-600/70 dark:text-red-400/60 mt-1">ahead of completion</p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">On Track</p>
                    <CheckCircle2 className="h-8 w-8 text-slate-400 mx-auto mt-1" />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Per-PO Breakdown Table */}
          {billingSummary.poDetails.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Per-PO Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-2 pr-4 font-semibold">PO</th>
                      <th className="text-left py-2 pr-4 font-semibold">Vendor</th>
                      <th className="text-right py-2 pr-4 font-semibold">Amount</th>
                      <th className="text-right py-2 pr-4 font-semibold">DP</th>
                      <th className="text-right py-2 pr-4 font-semibold">Billed</th>
                      <th className="text-right py-2 pr-4 font-semibold">Complete</th>
                      <th className="text-right py-2 pr-2 font-semibold">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {billingSummary.poDetails.map((d) => {
                      const effectiveComp = manualCompletionPct ?? d.completionPct;
                      const poVar = effectiveComp - d.billingPct;
                      return (
                        <tr key={d.poId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="py-2.5 pr-4">
                            <Link href={`/dashboard/purchase-orders/${d.poId}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors">
                              {d.poNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400 text-xs">{d.vendorName}</td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-slate-900 dark:text-white">₱{d.amount.toLocaleString()}</td>
                          <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-400">
                            {d.dpAmount > 0 ? `₱${d.dpAmount.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{d.billingPct}%</span>
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <span className={`text-xs font-bold ${d.completionPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {d.completionPct > 0 ? `${d.completionPct}%` : '—'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-right">
                            {poVar > 0 ? (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{poVar}%</span>
                            ) : poVar < 0 ? (
                              <span className="text-xs font-bold text-red-600 dark:text-red-400">{poVar}%</span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Linked Vendors */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Linked Vendors
            </h2>
            <button
              onClick={() => setIsLinking(!isLinking)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Link Vendor
            </button>
          </div>

          {isLinking && (
            <div className="bg-white dark:bg-[#0a0a0a] border border-primary/30 rounded-2xl p-4 shadow-sm ring-1 ring-primary/20 space-y-3">
              <select
                value={selectedVendorToLink}
                onChange={(e) => setSelectedVendorToLink(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select a vendor…</option>
                {availableVendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              {linkError && (
                <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {linkError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleLinkVendor}
                  disabled={isPendingLink || !selectedVendorToLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-medium transition-all"
                >
                  {isPendingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Link
                </button>
                <button onClick={() => { setIsLinking(false); setLinkError(null); }} className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {removeError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-500 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {removeError}
            </div>
          )}

          <div className="space-y-3">
            {linkedVendors.length > 0 ? linkedVendors.map((vendor) => {
              const vendorPOs = pos.filter((po) => po.vendors?.id === vendor.id);
              return (
                <div key={vendor.id} className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-primary/50 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <Link href={`/dashboard/vendors/${vendor.id}`} className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      {vendor.name}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <button
                      onClick={() => handleRemoveVendor(vendor.id)}
                      disabled={isPendingRemove && removingVendorId === vendor.id}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Remove from project"
                    >
                      {isPendingRemove && removingVendorId === vendor.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Unlink className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" />{vendorPOs.length} PO{vendorPOs.length === 1 ? '' : 's'}</span>
                    {vendor.currency && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{vendor.currency}</span>}
                  </div>
                </div>
              );
            }) : (
              <div className="bg-slate-50 dark:bg-[#0a0a0a]/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No Vendors Linked</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Click &ldquo;Link Vendor&rdquo; to connect vendors to this project.</p>
              </div>
            )}
          </div>
        </div>

        {/* POs + Contract */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Connected POs
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
              {pos.length} POs · ₱{totalPOValue.toLocaleString()}
            </span>
          </div>

          <div className="space-y-3">
            {pos.length > 0 ? pos.map((po) => {
              const sym = po.currency === 'USD' ? '$' : '₱';
              return (
                <div key={po.id} className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-primary/50 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Link href={`/dashboard/purchase-orders/${po.id}`} className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {po.po_number}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      {po.vendors && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {po.vendors.name}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getPOStatusColor(po.status)}`}>
                      {po.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{new Date(po.issued_date).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{sym}{Number(po.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-slate-50 dark:bg-[#0a0a0a]/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No Purchase Orders</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">This project has no associated POs yet.</p>
              </div>
            )}
          </div>

          {/* Contract Document */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Contract Document
            </h2>
            <label className="cursor-pointer">
              <input ref={contractInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleContractUpload} disabled={contractUploading} />
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${contractUploading ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}>
                {contractUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {project.contract_file_url ? 'Replace' : 'Upload'}
              </div>
            </label>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {project.contract_file_url ? (
              <>
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[70%]">{project.contract_file_name || 'Contract'}</span>
                  <a href={project.contract_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <iframe src={project.contract_file_url} className="w-full border-0" style={{ height: 560 }} title="Contract Document" allow="fullscreen" />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 dark:bg-slate-900/20">
                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Contract Document</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Upload a contract document (PDF, Word, or image) to keep it accessible here.</p>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 hover:border-primary/50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm">
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleContractUpload} disabled={contractUploading} />
                  {contractUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Contract
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
