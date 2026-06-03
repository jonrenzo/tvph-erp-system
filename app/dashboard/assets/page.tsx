import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Plus, Package, ChevronRight, HardDrive, Car, Armchair, Wrench, Antenna } from "lucide-react";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { StatusSelect } from "@/components/ui/status-select";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { q: null, status: null } }],
};

export default function AssetsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Asset Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track equipment, vehicles, and company assets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/assets/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Add Asset
          </Link>
        </div>
      </div>

      <Suspense fallback={<AssetsSkeleton />}>
        <AssetsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function AssetsContent({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<any>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || "";
  const statusFilter = searchParams?.status || "all";

  let query = supabase
    .from("assets")
    .select("*, asset_categories(name), profiles!assets_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,asset_tag.ilike.%${q}%,serial_number.ilike.%${q}%`);
  }
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: assets, error } = await query;

  // Stats
  let totalValue = 0;
  let inUse = 0;
  let inRepair = 0;
  
  assets?.forEach((asset: any) => {
    totalValue += Number(asset.purchase_cost || 0);
    if (asset.status === 'in_use') inUse++;
    if (asset.status === 'in_repair') inRepair++;
  });

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total Assets" value={assets?.length || 0} />
        <StatCard title="In Use" value={inUse} />
        <StatCard title="In Repair" value={inRepair} />
        <StatCard title="Total Purchase Value" value={`₱${totalValue.toLocaleString()}`} />
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
          <SearchInput placeholder="Search assets..." paramName="q" />

          <StatusSelect
            paramName="status"
            options={[
              { value: "all", label: "All Statuses" },
              { value: "in_use", label: "In Use" },
              { value: "available", label: "Available" },
              { value: "in_storage", label: "In Storage" },
              { value: "in_repair", label: "In Repair" },
              { value: "disposed", label: "Disposed" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Asset Info</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Assigned To</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-red-500">
                    Failed to load assets.
                  </td>
                </tr>
              ) : assets?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <Package className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-900 dark:text-white">
                        No assets found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                assets?.map((asset: any) => (
                  <tr
                    key={asset.id}
                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {asset.name}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-mono">
                          {asset.asset_tag} {asset.serial_number ? `• SN: ${asset.serial_number}` : ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        {getCategoryIcon(asset.asset_categories?.name)}
                        <span className="text-sm font-medium">{asset.asset_categories?.name || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {asset.profiles?.full_name || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          asset.status === "in_use"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50"
                            : asset.status === "available" || asset.status === "in_storage"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                              : asset.status === "in_repair"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {asset.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/assets/${asset.id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-6 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function getCategoryIcon(name: string) {
  if (!name) return <Package className="h-4 w-4 shrink-0" />;
  const n = name.toLowerCase();
  if (n.includes('it') || n.includes('computer')) return <HardDrive className="h-4 w-4 shrink-0" />;
  if (n.includes('vehicle')) return <Car className="h-4 w-4 shrink-0" />;
  if (n.includes('furniture')) return <Armchair className="h-4 w-4 shrink-0" />;
  if (n.includes('tool')) return <Wrench className="h-4 w-4 shrink-0" />;
  if (n.includes('telecom')) return <Antenna className="h-4 w-4 shrink-0" />;
  return <Package className="h-4 w-4 shrink-0" />;
}

function AssetsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-96" />
    </div>
  );
}
