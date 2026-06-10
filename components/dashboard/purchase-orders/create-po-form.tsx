"use client";

import { useActionState, useState, useCallback } from "react";
import {
  Save,
  Building2,
  Calendar,
  CircleDollarSign,
  FileText,
  FolderGit2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  MapPin,
} from "lucide-react";
import { createPurchaseOrder } from "@/app/dashboard/purchase-orders/actions";
import { hasCapability } from "@/lib/auth/roles";

interface VendorWithNda {
  id: string;
  name: string;
  currency: string;
  status: string;
  nda_approved: boolean;
}

interface LineItem {
  item_code: string;
  description: string;
  qty: number;
  uom: string;
  unit_price: number;
}

interface SiteDetail {
  region: string;
  area_city: string;
  no_of_nodes: number;
  cable_length_km: number;
}

const UOM_OPTIONS = ["LOT", "PCS", "SET", "HRS", "DAYS", "MOS", "SQM", "LM", "KG"];

const EMPTY_LINE_ITEM: LineItem = {
  item_code: "",
  description: "",
  qty: 1,
  uom: "LOT",
  unit_price: 0,
};

const EMPTY_SITE: SiteDetail = {
  region: "",
  area_city: "",
  no_of_nodes: 0,
  cable_length_km: 0,
};

export function CreatePOForm({
  vendors,
  projects,
  userRole,
}: {
  vendors: VendorWithNda[];
  projects: { id: string; name: string }[];
  userRole: string;
}) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrder, null);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [siteDetails, setSiteDetails] = useState<SiteDetail[]>([{ ...EMPTY_SITE }]);
  const [waiveRequirements, setWaiveRequirements] = useState(false);

  const vendor = vendors.find((v) => v.id === selectedVendor);
  const ndaBlocked = vendor && !vendor.nda_approved;
  const statusBlocked = vendor && vendor.status !== "active";
  const hasBlockers = !!ndaBlocked || !!statusBlocked;
  const isAdmin = hasCapability(userRole, "po.waive_requirements");
  const currencySymbol = vendor?.currency === "USD" ? "$" : "₱";
  const currencyLabel = vendor?.currency || "PHP";

  // ── Line item helpers ──
  const updateLineItem = useCallback(
    (index: number, field: keyof LineItem, value: string | number) => {
      setLineItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);
  }, []);

  const removeLineItem = useCallback(
    (index: number) => {
      if (lineItems.length <= 1) return;
      setLineItems((prev) => prev.filter((_, i) => i !== index));
    },
    [lineItems.length]
  );

  // ── Site detail helpers ──
  const updateSite = useCallback(
    (index: number, field: keyof SiteDetail, value: string | number) => {
      setSiteDetails((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addSite = useCallback(() => {
    setSiteDetails((prev) => [...prev, { ...EMPTY_SITE }]);
  }, []);

  const removeSite = useCallback(
    (index: number) => {
      if (siteDetails.length <= 1) return;
      setSiteDetails((prev) => prev.filter((_, i) => i !== index));
    },
    [siteDetails.length]
  );

  // ── Computed totals ──
  const totalAmount = lineItems.reduce(
    (sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
    0
  );
  const totalNodes = siteDetails.reduce((sum, s) => sum + (Number(s.no_of_nodes) || 0), 0);
  const totalCable = siteDetails.reduce((sum, s) => sum + (Number(s.cable_length_km) || 0), 0);

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const thClass =
    "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const tdClass = "px-3 py-2";

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden fields for serialized data */}
      <input type="hidden" name="line_items" value={JSON.stringify(lineItems)} />
      <input type="hidden" name="site_details" value={JSON.stringify(siteDetails)} />
      <input type="hidden" name="amount" value={totalAmount.toString()} />

      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      {/* Status Warning Banner */}
      {statusBlocked && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Cannot Create PO — Vendor Not Active
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/60 mt-1">
              This vendor is currently marked as &quot;{vendor.status}&quot;. Only active
              (Accredited) vendors can receive purchase orders.
            </p>
          </div>
        </div>
      )}

      {/* NDA Warning Banner */}
      {ndaBlocked && !statusBlocked && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Cannot Create PO — Signed NDA Not Approved
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
              This vendor does not have an approved Signed NDA on file. Go to the vendor&apos;s
              Accreditation Docs tab to submit and approve the NDA before creating a purchase order.
            </p>
          </div>
        </div>
      )}

      {vendor && vendor.nda_approved && vendor.status === "active" && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Signed NDA approved — PO creation allowed. Currency: {currencyLabel}
          </span>
        </div>
      )}

      {/* Admin-only waiver checkbox — shown only when there are blockers */}
      {hasBlockers && isAdmin && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
          waiveRequirements
            ? "bg-orange-50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-700/50"
            : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700"
        }`}>
          <ShieldAlert className={`h-5 w-5 shrink-0 mt-0.5 ${waiveRequirements ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`} />
          <label className="flex items-start gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              name="waive_requirements"
              checked={waiveRequirements}
              onChange={(e) => setWaiveRequirements(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Waive requirements and create PO anyway
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This PO will be created pending executive approval and <span className="font-semibold">cannot be issued</span> until an executive approves the waiver.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          SECTION 1: PO Details
         ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">PO Details</h2>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="vendor_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Vendor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                id="vendor_id"
                name="vendor_id"
                required
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="">Select a vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="project_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Project <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                id="project_id"
                name="project_id"
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="">
                  {projects.length > 0 ? "Select a project" : "No projects available"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description / Subject
            </label>
            <input
              id="description"
              name="description"
              type="text"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g. Server Maintenance for Q3"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="issued_date" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Issued Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="issued_date"
                name="issued_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="due_date" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Due Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="due_date"
                name="due_date"
                type="date"
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="dp_amount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Down Payment Amount <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="dp_amount"
                name="dp_amount"
                type="number"
                min="0"
                step="0.01"
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          SECTION 2: Line Items Table
         ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Line Items</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {lineItems.length}
            </span>
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                <th className={`${thClass} w-12`}>#</th>
                <th className={`${thClass} w-24`}>Item Code</th>
                <th className={thClass}>Description</th>
                <th className={`${thClass} w-20`}>Qty</th>
                <th className={`${thClass} w-24`}>UoM</th>
                <th className={`${thClass} w-32`}>Unit Price</th>
                <th className={`${thClass} w-32`}>Amount</th>
                <th className={`${thClass} w-10`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {lineItems.map((li, idx) => {
                const rowAmount = (Number(li.qty) || 0) * (Number(li.unit_price) || 0);
                return (
                  <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>
                      {idx + 1}
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={li.item_code}
                        onChange={(e) => updateLineItem(idx, "item_code", e.target.value)}
                        className={inputClass}
                        placeholder="—"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                        className={inputClass}
                        placeholder="Item description"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={li.qty || ""}
                        onChange={(e) => updateLineItem(idx, "qty", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`}
                        placeholder="1"
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        value={li.uom}
                        onChange={(e) => updateLineItem(idx, "uom", e.target.value)}
                        className={`${inputClass} appearance-none`}
                      >
                        {UOM_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.unit_price || ""}
                        onChange={(e) => updateLineItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`}
                        placeholder="0.00"
                      />
                    </td>
                    <td className={`${tdClass} text-right font-semibold text-slate-900 dark:text-white pr-4`}>
                      {currencySymbol}
                      {rowAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <td colSpan={6} className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total ({currencyLabel})
                </td>
                <td className="px-3 py-3 text-right font-bold text-lg text-slate-900 dark:text-white pr-4">
                  {currencySymbol}
                  {totalAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          SECTION 3: Site Details Table
         ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Sites &amp; Details
            </h2>
            <span className="text-xs text-slate-400 font-normal">(Optional)</span>
          </div>
          <button
            type="button"
            onClick={addSite}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Site
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                <th className={`${thClass} w-12`}>S/N</th>
                <th className={thClass}>Region</th>
                <th className={thClass}>Area / City</th>
                <th className={`${thClass} w-28`}>No. of Nodes</th>
                <th className={`${thClass} w-36`}>Cable Length (KM)</th>
                <th className={`${thClass} w-10`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {siteDetails.map((site, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>
                    {idx + 1}
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      value={site.region}
                      onChange={(e) => updateSite(idx, "region", e.target.value)}
                      className={inputClass}
                      placeholder="Region"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      value={site.area_city}
                      onChange={(e) => updateSite(idx, "area_city", e.target.value)}
                      className={inputClass}
                      placeholder="Area / City"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min="0"
                      value={site.no_of_nodes || ""}
                      onChange={(e) => updateSite(idx, "no_of_nodes", parseInt(e.target.value) || 0)}
                      className={`${inputClass} text-right`}
                      placeholder="0"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={site.cable_length_km || ""}
                      onChange={(e) => updateSite(idx, "cable_length_km", parseFloat(e.target.value) || 0)}
                      className={`${inputClass} text-right`}
                      placeholder="0.00"
                    />
                  </td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      onClick={() => removeSite(idx)}
                      disabled={siteDetails.length <= 1}
                      className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <td colSpan={3} className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total
                </td>
                <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {totalNodes.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {totalCable.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || (hasBlockers && !waiveRequirements)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          {isPending ? (
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          Create PO
        </button>
      </div>
    </form>
  );
}
