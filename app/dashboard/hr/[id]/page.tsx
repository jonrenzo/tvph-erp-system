import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Mail, Shield, Briefcase, Calendar } from "lucide-react";
import { Employee201Vault } from "@/components/dashboard/hr/employee-201-vault";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { id: "00000000-0000-0000-0000-000000000000" } }],
};

export default function EmployeeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500">Loading employee details...</div>}>
        <EmployeeDetailContent paramsPromise={props.params} />
      </Suspense>
    </div>
  );
}

async function EmployeeDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const id = params.id;
  const supabase = await createClient();

  const [{ data: employee }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("employee_documents").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
  ]);

  if (!employee) return notFound();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hr"
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
              {employee.avatar_url ? (
                <img src={employee.avatar_url} alt={employee.full_name} className="h-full w-full object-cover" />
              ) : (
                employee.full_name.charAt(0)
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
                {employee.full_name}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  employee.employment_status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {employee.employment_status?.replace('_', ' ') || 'Active'}
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {employee.position || "No position set"} • {employee.department || "No department set"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Contact Information</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{employee.phone || "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Government IDs</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500">SSS</span>
                <span className="font-medium font-mono">{employee.sss_number || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500">PhilHealth</span>
                <span className="font-medium font-mono">{employee.philhealth_number || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500">Pag-IBIG</span>
                <span className="font-medium font-mono">{employee.pagibig_number || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">TIN</span>
                <span className="font-medium font-mono">{employee.tin || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">201 File Vault</h2>
            <Employee201Vault employeeId={employee.id} documents={documents || []} />
          </div>
        </div>
      </div>
    </>
  );
}
