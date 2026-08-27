"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CircleDollarSign,
  FileUp,
  FolderGit2,
  Hash,
  Loader2,
  Sparkles,
} from "lucide-react";
import { extractLegacyPoDetails, importLegacyPurchaseOrder } from "@/app/dashboard/purchase-orders/actions";

const inputClass =
  "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toDateInput(value: string): string {
  const text = value.trim();
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text);
  if (dmy) {
    const month = MONTHS.indexOf(dmy[2].toLowerCase().slice(0, 3)) + 1;
    if (month)
      return `${dmy[3]}-${String(month).padStart(2, "0")}-${String(+dmy[1]).padStart(2, "0")}`;
  }
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return "";
}

interface LegacyPoImportFormProps {
  vendors: { id: string; name: string; currency: string }[];
}

export function LegacyPoImportForm({ vendors }: LegacyPoImportFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, isPending] = useActionState(importLegacyPurchaseOrder, null);
  const [file, setFile] = useState<File | null>(null);

  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [project, setProject] = useState("");
  const [detectError, setDetectError] = useState<string | null>(null);

  const [isDetecting, startDetecting] = useTransition();

  useEffect(() => {
    if (state?.success) router.push(`/dashboard/purchase-orders/${state.id}`);
  }, [state, router]);

  const matchVendor = (name: string) => {
    const lower = name.trim().toLowerCase();
    return (
      vendors.find((v) => v.name.toLowerCase() === lower) ||
      vendors.find((v) => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())) ||
      null
    );
  };

  const detectFromPdf = () => {
    if (!file || isPending || isDetecting) return;
    const fd = new FormData();
    fd.append("file", file);
    startDetecting(async () => {
      const res = await extractLegacyPoDetails(null, fd);
      if (!res?.success || !res.extract) {
        setDetectError(res?.error || "Could not read the PDF.");
        return;
      }
      const ex = res.extract;
      const vendor = ex.vendorName ? matchVendor(ex.vendorName) : null;
      if (ex.poNumber) setPoNumber(ex.poNumber);
      if (ex.poDate) setIssuedDate((prev) => toDateInput(ex.poDate || "") || prev);
      if (ex.amount != null) setAmount(String(ex.amount));
      if (ex.currency) setCurrency(ex.currency);
      if (ex.project) setProject(ex.project);
      if (vendor) setVendorId(vendor.id);
      setDetectError(
        ex.vendorName && !vendor ? `Detected vendor "${ex.vendorName}" isn't in the list — select it manually.` : null,
      );
    });
  };

  return (
    <form ref={formRef} action={dispatch} className="space-y-6">
      {state?.error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      )}
      {detectError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">{detectError}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm divide-y divide-slate-200 dark:divide-slate-800">
        <div className="p-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <Building2 className="h-4 w-4 inline -mt-0.5 mr-1.5" />
            Vendor
          </label>
          <select
            name="vendor_id"
            required
            className={inputClass}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="" disabled>
              Select the vendor on the PO
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Hash className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              PO Number
            </label>
            <input
              name="po_number"
              required
              placeholder="PO-2026000027"
              className={inputClass}
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Calendar className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              Issued Date <span className="font-normal text-slate-400">(defaults to today if empty)</span>
            </label>
            <input
              name="issued_date"
              type="date"
              className={inputClass}
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <CircleDollarSign className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              Total Amount <span className="font-normal text-slate-400">(optional for placeholder)</span>
            </label>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave 0 if unknown — first invoice will set it"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {amount ? 'Caps what can be invoiced against this PO.' : 'Placeholder will use the first invoice amount as the ceiling. You can edit this later.'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Currency</label>
            <select
              name="currency"
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="PHP">PHP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <FolderGit2 className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              Project <span className="font-normal text-slate-400">(optional, free text)</span>
            </label>
            <input
              name="legacy_project"
              placeholder="e.g. Extraction of Coaxial Cables and Pole-Equipment"
              className={inputClass}
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Legacy POs predate the ERP, so the project is recorded as text rather than linked to a project record.
            </p>
          </div>
        </div>

        <div className="p-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <FileUp className="h-4 w-4 inline -mt-0.5 mr-1.5" />
            PO Document (PDF) <span className="font-normal text-slate-400">(optional for placeholder)</span>
          </label>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {file ? "The uploaded PDF becomes the PO's document." : "Leave empty to create a placeholder with just PO number + vendor — you can link the invoice now and upload the scan or edit the PO later."}
          </p>
          <button
            type="button"
            disabled={!file || isPending || isDetecting}
            onClick={detectFromPdf}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-primary/40 text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isDetecting ? "Reading PDF…" : "Detect details from PDF"}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/purchase-orders")}
          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import as Issued
        </button>
      </div>
    </form>
  );
}
