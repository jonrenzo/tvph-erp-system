import {
  BarChart3,
  CreditCard,
  ShieldCheck,
  Building2,
  FileText,
} from "lucide-react";
import { GenerateReportButton } from "@/components/dashboard/reports/generate-report-button";

export const unstable_instant = { prefetch: "static" };

const REPORTS = [
  {
    id: "operations",
    title: "Operations Summary",
    description:
      "Command Center snapshot — liabilities, active POs, pending vendors, expiring docs and recent activity.",
    href: "/api/reports/operations",
    icon: BarChart3,
  },
  {
    id: "ap-aging",
    title: "Accounts Payable Aging",
    description:
      "Outstanding payables grouped by vendor and aging bucket (current → 90+ days), with VAT and EWT totals.",
    href: "/api/reports/ap-aging",
    icon: CreditCard,
  },
  {
    id: "compliance",
    title: "Vendor Compliance Status",
    description:
      "Accreditation scoring across every vendor, highlighting missing or expired required documents.",
    href: "/api/reports/compliance",
    icon: ShieldCheck,
  },
  {
    id: "vendor-register",
    title: "Vendor Register",
    description:
      "Master list of all vendors with TIN, contact, payment terms and accreditation status.",
    href: "/api/reports/vendor-register",
    icon: Building2,
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="font-plus-jakarta text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Reports
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Generate formatted PDF reports from live operational data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    {report.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {report.description}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <GenerateReportButton href={report.href} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
