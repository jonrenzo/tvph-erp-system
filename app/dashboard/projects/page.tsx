import { createClient } from "@/utils/supabase/server";
import { FolderGit2, Clock, ExternalLink, Building2, Plus, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CustomerFilter } from "./customer-filter";
import { Pagination } from "@/components/ui/pagination";
import { LIST_PAGE_SIZE, parsePage, pageRange } from "@/components/ui/pagination-utils";
import { ImportExportButtons } from "@/components/dashboard/import-export-buttons";
import { importProjects } from "./actions";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { page: null, account_id: null } }],
};

export default function ProjectsPage(props: {
  searchParams?: Promise<{ page?: string; account_id?: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-primary" />
            Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage all projects and link vendors to them.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            title="Projects"
            exportBaseUrl="/api/export/projects"
            importAction={importProjects}
          />
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95 whitespace-nowrap"
          >
            <Plus className="h-5 w-5" /> New Project
          </Link>
        </div>
      </div>

      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function ProjectsContent({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ page?: string; account_id?: string }>;
}) {
  const supabase = await createClient();
  const searchParams = await searchParamsPromise;
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, LIST_PAGE_SIZE);
  const accountFilter = searchParams?.account_id || null;

  const [{ data: projects, count }, { data: accounts }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `id, name, status, description, created_at,
        account_id,
        crm_accounts(id, company_name),
        project_vendors(vendors(id, name)),
        purchase_orders(id)`,
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to)
      .then((res) => {
        if (accountFilter) {
          return {
            ...res,
            data: (res.data || []).filter((p: any) => p.account_id === accountFilter),
          };
        }
        return res;
      }),
    supabase
      .from("crm_accounts")
      .select("id, company_name")
      .is("deleted_at", null)
      .order("company_name"),
  ]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "completed":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "on_hold":
        return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  if (!projects || projects.length === 0) {
    return (
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-sm max-w-2xl mx-auto mt-12">
        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <FolderGit2 className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
          No projects found
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-8">
          You haven't created any projects yet. Go to a vendor's profile to
          create your first project and start tracking purchase orders.
        </p>
        <Link
          href="/dashboard/vendors"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-sm hover:shadow-primary/25 active:scale-95"
        >
          <Building2 className="h-5 w-5" />
          Browse Vendors
        </Link>
      </div>
    );
  }

  return (
    <>
    <CustomerFilter accounts={accounts} accountFilter={accountFilter} />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project: any) => {
        const linkedVendors = (project.project_vendors || [])
          .map((pv: any) => pv.vendors?.name)
          .filter(Boolean);
        const clientName = project.crm_accounts?.company_name;

        return (
        <div
          key={project.id}
          className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
        >
          <div className="p-5 flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-1">
                {project.name}
              </h3>
              <span
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}
              >
                {project.status?.replace("_", " ")}
              </span>
            </div>

            {/* Client row */}
            <p className="text-sm font-medium mb-1.5 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
              {clientName ? (
                <Link href={`/dashboard/crm/${project.crm_accounts.id}`} className="hover:text-primary transition-colors truncate">
                  {clientName}
                </Link>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">No client</span>
              )}
            </p>

            {/* Vendors row */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-start gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {linkedVendors.length === 0
                ? "No vendors linked"
                : linkedVendors.length <= 2
                ? linkedVendors.join(", ")
                : `${linkedVendors[0]} +${linkedVendors.length - 1} more`}
            </p>

            {project.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                {project.description}
              </p>
            )}

            <div className="flex flex-col gap-2 mt-auto text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Created {new Date(project.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5 text-primary">
                <FolderGit2 className="h-3.5 w-3.5" />
                {project.purchase_orders?.length || 0} Connected PO
                {(project.purchase_orders?.length || 0) === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 p-4 flex items-center justify-end">
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-medium transition-all w-full justify-center"
            >
              <ExternalLink className="h-4 w-4" /> View Details
            </Link>
          </div>
        </div>
        );
      })}
    </div>
    {(count ?? 0) > LIST_PAGE_SIZE && (
      <div className="mt-6 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <Pagination page={page} totalCount={count ?? 0} pageSize={LIST_PAGE_SIZE} />
      </div>
    )}
    </>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl h-64 animate-pulse shadow-sm"
        />
      ))}
    </div>
  );
}
