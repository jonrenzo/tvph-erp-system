import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { StatusSelect } from "@/components/ui/status-select";
import { SortColumnButton } from "@/components/ui/sort-column-button";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, pageRange } from "@/components/ui/pagination-utils";
import { VendorsTableBody } from "@/components/dashboard/vendors/vendors-table-body";
import { ImportExportButtons } from "@/components/dashboard/import-export-buttons";
import { importVendors } from "@/app/dashboard/vendors/actions";

const VENDORS_PAGE_SIZE = 10;

export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { q: null, status: null, sort: null, page: null } }],
};

export default function VendorsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; sort?: string; page?: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Vendors
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your suppliers and accreditation documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportButtons
            title="Vendors"
            exportBaseUrl="/api/export/vendors"
            importAction={importVendors}
          />
          <Link
            href="/dashboard/vendors/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Add Vendor
          </Link>
        </div>
      </div>

      <Suspense fallback={<VendorsSkeleton />}>
        <VendorsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function VendorsContent({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<any>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || "";
  const statusFilter = searchParams?.status || "all";
  const sort = searchParams?.sort as "asc" | "desc" | undefined;
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, VENDORS_PAGE_SIZE);

  let query = supabase
    .from("vendors")
    .select(
      "id, vendor_code, name, address, tin, contact_person, contact_email, contact_phone, bank_name, payment_terms, status, vendor_documents(doc_type, status)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(sort ? "name" : "created_at", { ascending: sort === "asc" ? true : sort === "desc" ? false : false });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: vendors, error, count } = await query.range(from, to);

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
        <SearchInput placeholder="Search vendors..." paramName="q" />

        <StatusSelect
          paramName="status"
          options={[
            { value: "all", label: "All Statuses" },
            { value: "active", label: "Active" },
            { value: "pending", label: "Pending" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      <div>
        <table className="w-full table-fixed text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold w-[28%]">
                <SortColumnButton label="Vendor Details" paramName="sort" />
              </th>
              <th className="px-4 py-3 font-semibold w-[10%]">TIN</th>
              <th className="px-4 py-3 font-semibold w-[18%]">Contact Person</th>
              <th className="px-4 py-3 font-semibold w-[17%]">Accreditation</th>
              <th className="px-4 py-3 font-semibold w-[10%]">Status</th>
              <th className="px-4 py-3 font-semibold w-[10%]">NDA</th>
              <th className="px-4 py-3 font-semibold w-[7%] text-right">Actions</th>
            </tr>
          </thead>
          <VendorsTableBody vendors={vendors} error={error} />
        </table>
      </div>

      <Pagination
        page={page}
        totalCount={count ?? 0}
        pageSize={VENDORS_PAGE_SIZE}
      />
    </div>
  );
}

function VendorsSkeleton() {
  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 h-16 bg-slate-50/50 dark:bg-[#0a0a0a]/50" />
      <div className="h-96" />
    </div>
  );
}
