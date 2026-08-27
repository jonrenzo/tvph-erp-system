import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { StatusSelect } from "@/components/ui/status-select";
import { Pagination } from "@/components/ui/pagination";
import { LIST_PAGE_SIZE, parsePage, pageRange } from "@/components/ui/pagination-utils";
import { PaymentRequestsTable } from "@/components/dashboard/accounting/payment-requests-table";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";

export default function PaymentRequestsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<PaymentRequestsSkeleton />}>
      <PaymentRequestsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PaymentRequestsContent({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<any>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || "";
  const statusFilter = searchParams?.status || "all";
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, LIST_PAGE_SIZE);
  const { role } = await getCurrentProfile(supabase);

  let query = supabase
    .from("payment_requests")
    .select(
      "id, request_number, po_id, amount, due_in_days, status, percent_complete, created_at, rejection_reason, is_downpayment, purchase_orders(po_number, vendors(name)), projects(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("request_number", `%${q}%`);
  }
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: requests, error, count } = await query.range(from, to);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Payment Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track vendor payment requests linked to purchase orders.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95 text-sm"
        >
          Record Vendor Invoice
        </Link>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search request number..." paramName="q" />
          <StatusSelect
            paramName="status"
            options={[
              { value: "all", label: "All Statuses" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "fully_invoiced", label: "Fully Invoiced" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>

        <div className="p-6">
          {error ? (
            <p className="text-sm text-red-500 text-center py-12">Failed to load payment requests.</p>
          ) : (
            <PaymentRequestsTable
              requests={(requests ?? []) as any}
              canApprove={hasCapability(role, "payment_request.approve")}
            />
          )}
        </div>

        <Pagination page={page} totalCount={count ?? 0} pageSize={LIST_PAGE_SIZE} />
      </div>
    </div>
  );
}

function PaymentRequestsSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
