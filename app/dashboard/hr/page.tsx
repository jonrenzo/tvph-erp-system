import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Plus, Users, ChevronRight, Briefcase } from "lucide-react";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { StatusSelect } from "@/components/ui/status-select";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { q: null, status: null } }],
};

export default function HRDirectoryPage(props: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Employee Directory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your team, roles, and 201 files.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/hr/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Add Employee
          </Link>
        </div>
      </div>

      <Suspense fallback={<DirectorySkeleton />}>
        <DirectoryContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function DirectoryContent({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<any>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || "";
  const statusFilter = searchParams?.status || "all";

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, department, position, employment_status, date_hired, avatar_url")
    .order("full_name", { ascending: true });

  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }
  if (statusFilter !== "all") {
    query = query.eq("employment_status", statusFilter);
  }

  const { data: employees, error } = await query;

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
        <SearchInput placeholder="Search employees..." paramName="q" />

        <StatusSelect
          paramName="status"
          options={[
            { value: "all", label: "All Statuses" },
            { value: "active", label: "Active" },
            { value: "probationary", label: "Probationary" },
            { value: "on_leave", label: "On Leave" },
            { value: "resigned", label: "Resigned" },
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Department</th>
              <th className="px-6 py-4 font-semibold">System Role</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {error ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-red-500">
                  Failed to load employees.
                </td>
              </tr>
            ) : employees?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-base font-medium text-slate-900 dark:text-white">
                      No employees found
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              employees?.map((employee: any) => (
                <tr
                  key={employee.id}
                  className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        {employee.avatar_url ? (
                          <img src={employee.avatar_url} alt={employee.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-500 font-bold">
                            {employee.full_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{employee.full_name}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">
                          {employee.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Briefcase className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium">{employee.department || "-"}</div>
                        <div className="text-xs">{employee.position || "No position set"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs capitalize">
                    {employee.role.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        employee.employment_status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                          : employee.employment_status === "probationary"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50"
                            : employee.employment_status === "on_leave"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                              : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {(employee.employment_status || 'active').replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/hr/${employee.id}`}
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
  );
}

function DirectorySkeleton() {
  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 h-16 bg-slate-50/50 dark:bg-[#0a0a0a]/50" />
      <div className="h-96" />
    </div>
  );
}
