import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, User, Calendar, MapPin, Hash, DollarSign, TrendingDown } from "lucide-react";
import { MaintenanceLog } from "@/components/dashboard/assets/maintenance-log";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { id: "00000000-0000-0000-0000-000000000000" } }],
};

export default function AssetDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500">Loading asset details...</div>}>
        <AssetDetailContent paramsPromise={props.params} />
      </Suspense>
    </div>
  );
}

async function AssetDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const id = params.id;
  const supabase = await createClient();

  const [{ data: asset }, { data: logs }] = await Promise.all([
    supabase.from("assets").select("*, asset_categories(name), profiles!assets_assigned_to_fkey(full_name, department)").eq("id", id).single(),
    supabase.from("asset_maintenance_logs").select("*").eq("asset_id", id).order("performed_date", { ascending: false }),
  ]);

  if (!asset) return notFound();

  // Depreciation Calculation (Straight Line)
  let currentBookValue = Number(asset.purchase_cost || 0);
  let accumulatedDepreciation = 0;
  
  if (asset.purchase_date && asset.purchase_cost && asset.useful_life_years) {
    const cost = Number(asset.purchase_cost);
    const salvage = Number(asset.salvage_value || 0);
    const lifeYears = Number(asset.useful_life_years);
    
    const purchaseDate = new Date(asset.purchase_date);
    const now = new Date();
    
    // Calculate months elapsed
    let monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12;
    monthsElapsed -= purchaseDate.getMonth();
    monthsElapsed += now.getMonth();
    
    if (monthsElapsed > 0) {
      const depreciableBase = cost - salvage;
      const monthlyDepreciation = depreciableBase / (lifeYears * 12);
      accumulatedDepreciation = Math.min(monthlyDepreciation * monthsElapsed, depreciableBase);
      currentBookValue = cost - accumulatedDepreciation;
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/assets"
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
                {asset.name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">
                {asset.asset_tag} • {asset.asset_categories?.name}
              </p>
            </div>
          </div>
        </div>
        <div>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
            asset.status === "in_use"
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50"
              : asset.status === "available" || asset.status === "in_storage"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                : asset.status === "in_repair"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                  : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          }`}>
            {asset.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Specifications</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500 flex items-center gap-2"><Hash className="h-4 w-4" /> Serial Number</span>
                <span className="font-medium font-mono text-slate-900 dark:text-white">{asset.serial_number || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500">Manufacturer</span>
                <span className="font-medium text-slate-900 dark:text-white">{asset.manufacturer || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500 flex items-center gap-2"><Calendar className="h-4 w-4" /> Purchase Date</span>
                <span className="font-medium text-slate-900 dark:text-white">{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</span>
                <span className="font-medium text-slate-900 dark:text-white">{asset.location || "Main Office"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Assignment</h3>
            {asset.profiles ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {asset.profiles.full_name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{asset.profiles.full_name}</div>
                  <div className="text-xs text-slate-500">{asset.profiles.department || "No department"}</div>
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-500 text-sm">
                Not currently assigned to any employee.
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {asset.purchase_cost && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-emerald-500" /> Depreciation (Straight Line)
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 mb-1">Purchase Cost</div>
                  <div className="font-bold text-lg text-slate-900 dark:text-white">₱{Number(asset.purchase_cost).toLocaleString()}</div>
                </div>
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  <div className="text-xs text-rose-500 mb-1">Accumulated</div>
                  <div className="font-bold text-lg text-rose-700 dark:text-rose-400">₱{accumulatedDepreciation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="text-xs text-emerald-500 mb-1">Current Book Value</div>
                  <div className="font-bold text-lg text-emerald-700 dark:text-emerald-400">₱{currentBookValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 px-1">
                <span>Useful Life: {asset.useful_life_years} years</span>
                <span>Salvage Value: ₱{Number(asset.salvage_value || 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <MaintenanceLog assetId={asset.id} logs={logs || []} />
          </div>
        </div>
      </div>
    </>
  );
}
