"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Edit2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { isVendorProfileComplete, getVendorMissingFields } from "@/utils/completeness";
import GenerateLinkButton from "@/components/dashboard/vendors/generate-link-button";
import { DeleteVendorButton } from "@/components/dashboard/vendors/delete-vendor-button";
import { updateVendorStatus } from "@/app/dashboard/vendors/actions";

export default function VendorDetailHeader({ vendor, canDelete }: { vendor: any; canDelete?: boolean }) {
  const [status, setStatus] = useState(vendor.status);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isActive = status === "active";

  function toggle() {
    const next = isActive ? "inactive" : "active";
    setStatus(next);
    startTransition(async () => {
      const res: any = await updateVendorStatus(vendor.id, next);
      if (res?.error) setStatus(vendor.status);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <Link
          href="/dashboard/vendors"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <Tooltip
              content={
                isVendorProfileComplete(vendor) ? (
                  "Profile complete"
                ) : (
                  <>
                    Missing: <span className="font-normal">{getVendorMissingFields(vendor).join(", ")}</span>
                  </>
                )
              }
            >
              <span className="flex items-center gap-2">
                <span className={`inline-block h-3 w-3 rounded-full flex-shrink-0 ${isVendorProfileComplete(vendor) ? "bg-emerald-500" : "bg-red-500"}`} />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">{vendor.name}</h1>
              </span>
            </Tooltip>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                  : status === "pending"
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                    : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              }`}
            >
              {(status || "unknown").charAt(0).toUpperCase() + (status || "unknown").slice(1)}
              {isPending && " …"}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <FileText className="h-4 w-4" /> TIN: <span className="font-mono">{vendor.tin || "Not provided"}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 md:ml-auto">
        {canDelete && <DeleteVendorButton vendorId={vendor.id} vendorName={vendor.name} onDeleted={() => router.push("/dashboard/vendors")} />}
        <Link
          href={`/dashboard/vendors/${vendor.id}/edit`}
          className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
        >
          <Edit2 className="h-4 w-4" />
          Edit Vendor
        </Link>
        <GenerateLinkButton entityId={vendor.id} entityType="vendor" />
        <button
          onClick={toggle}
          disabled={isPending}
          className={
            !isActive
              ? "inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
              : "inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          }
        >
          {!isActive ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Activate Vendor
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              Deactivate
            </>
          )}
        </button>
      </div>
    </div>
  );
}
