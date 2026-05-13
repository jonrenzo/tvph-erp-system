import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  CreditCard,
  Clock,
  User,
  Mail,
  FolderGit2,
  FileDown
} from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { POProjectAssigner } from "@/components/dashboard/purchase-orders/po-project-assigner";
import { RecentActivity } from "@/components/dashboard/shared/recent-activity";

export const unstable_instant = { 
  prefetch: 'static',
  samples: [{ params: { id: 'sample-id' } }]
};

export default function PurchaseOrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PODetailSkeleton />}>
      <PODetailContent paramsPromise={props.params} />
    </Suspense>
  );
}

async function PODetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      *,
      vendors (
        name,
        contact_person,
        contact_email
      )
    `,
    )
    .eq("id", params.id)
    .single();

  if (error || !po) {
    notFound();
  }

  // Fetch all projects to allow assignment (many-to-many architecture)
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  // Fetch all invoices linked to this PO
  const { data: invoices } = await supabase
    .from("service_invoices")
    .select("id, amount, status, invoice_number")
    .eq("po_id", po.id);

  const invoiceIds = invoices?.map((i) => i.id) || [];

  // Fetch all payments for those invoices
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_paid")
    .in("invoice_id", invoiceIds);

  const totalPaid =
    payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
  const totalInvoiced =
    invoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const poAmount = Number(po.amount);
  const remainingBalance = Math.max(0, poAmount - totalPaid);
  const overpaidAmount = Math.max(0, totalPaid - poAmount);
  const progress = Math.min(100, Math.round((totalPaid / poAmount) * 100)) || 0;
  const isOverpaid = totalPaid > poAmount;

  return (
    <div className="p-6 lg:p-8 max-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/purchase-orders"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
                {po.po_number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                  po.status === "paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : po.status === "overpaid"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                      : po.status === "issued"
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {po.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Vendor:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {po.vendors?.name}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:ml-auto">
          {po.status === "draft" && (
            <form
              action={async () => {
                "use server";
                const { updatePOStatus } = await import("../actions");
                await updatePOStatus(po.id, "issued");
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
              >
                <Send className="h-4 w-4" />
                Issue PO
              </button>
            </form>
          )}
          <a
            href={`/api/purchase-orders/${po.id}/download`}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            <FileDown className="h-4 w-4" />
            Download PDF
          </a>
          <button className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition-all">
            Edit
          </button>
        </div>
      </div>

      {/* New Intuitive Financial Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Balance Ring/Card */}
        <div className="md:col-span-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="relative h-40 w-40 shrink-0">
            <svg className="h-full w-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * progress) / 100}
                strokeLinecap="round"
                className={isOverpaid ? "text-red-500" : "text-primary"}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {progress}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Paid
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Original Commitment
                </label>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₱{poAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Total Paid to Date
                </label>
                <div
                  className={`text-2xl font-bold ${isOverpaid ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  ₱{totalPaid.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800/50">
              {isOverpaid ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase">
                      Overpaid Balance
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      ₱{overpaidAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <CreditCard className="h-6 w-6 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">
                      Remaining to Pay
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      ₱{remainingBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoicing Progress Card */}
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Billing Health
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-500 uppercase">Invoiced vs PO</span>
                <span
                  className={
                    totalInvoiced > poAmount
                      ? "text-red-500"
                      : "text-slate-900 dark:text-white"
                  }
                >
                  {Math.round((totalInvoiced / poAmount) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${totalInvoiced > poAmount ? "bg-red-500" : "bg-blue-500"}`}
                  style={{
                    width: `${Math.min(100, (totalInvoiced / poAmount) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Bills Received</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₱{totalInvoiced.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Unbilled PO Amount</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₱{Math.max(0, poAmount - totalInvoiced).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> PO Details
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <p className="mt-1 text-slate-900 dark:text-slate-300 text-lg">
                  {po.description || "No description provided"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Issued Date
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                    {new Date(po.issued_date).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Due Date
                  </label>
                  <p className="mt-1 text-slate-900 dark:text-slate-300 font-medium">
                    {po.due_date
                      ? new Date(po.due_date).toLocaleDateString(undefined, {
                          dateStyle: "long",
                        })
                      : "No due date set"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Linked Invoices Section Placeholder */}
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Linked Invoices
              </h2>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
                {invoices?.length || 0}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Invoice #</th>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-slate-400 italic"
                      >
                        No invoices linked to this PO yet.
                      </td>
                    </tr>
                  ) : (
                    invoices?.map((inv: any) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {inv.invoice_number}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          ₱{Number(inv.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                            }`}
                          >
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Vendor Info */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
              Vendor Information
            </h3>
            <div className="space-y-4">
              <Link
                href={`/dashboard/vendors/${po.vendor_id}`}
                className="block group"
              >
                <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                  {po.vendors?.name}
                </div>
                <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  View Profile <ArrowLeft className="h-3 w-3 rotate-180" />
                </div>
              </Link>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <User className="h-4 w-4" />{" "}
                  {po.vendors?.contact_person || "N/A"}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Mail className="h-4 w-4" />{" "}
                  {po.vendors?.contact_email || "N/A"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-primary" /> Associated Project
            </h3>
            <POProjectAssigner 
              poId={po.id} 
              currentProjectId={po.project_id} 
              projects={allProjects || []} 
            />
          </div>

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-6">
            <h3 className="font-semibold text-primary dark:text-primary mb-2">
              Internal Note
            </h3>
            <p className="text-sm text-primary/80 leading-relaxed italic">
              &quot;Please ensure the service report is attached when submitting
              invoices against this PO.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PODetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
         <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
      </div>
    </div>
  );
}
