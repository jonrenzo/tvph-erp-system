"use client";

import React from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";

const CAPABILITY_LABELS: Record<string, { label: string; group: string }> = {
  "vendor.write":         { label: "Create / Edit Vendors",        group: "Vendors" },
  "vendor.status":        { label: "Activate / Deactivate Vendors", group: "Vendors" },
  "vendor.delete":        { label: "Delete Vendors",               group: "Vendors" },
  "document.write":       { label: "Upload Documents",             group: "Documents" },
  "document.approve":     { label: "Approve Documents",            group: "Documents" },
  "po.create":            { label: "Create Purchase Orders",        group: "Purchase Orders" },
  "po.write":             { label: "Edit Purchase Orders",          group: "Purchase Orders" },
  "po.status":            { label: "Update PO Status",             group: "Purchase Orders" },
  "po.delete":            { label: "Delete Purchase Orders",        group: "Purchase Orders" },
  "po.waive_requirements": { label: "Waive PO Requirements",       group: "Purchase Orders" },
  "po.approve_waiver":    { label: "Approve PO Waivers",           group: "Purchase Orders" },
  "invoice.write":        { label: "Create / Edit Invoices",       group: "Invoices" },
  "invoice.pay":          { label: "Record Payments",              group: "Invoices" },
  "client_po.write":      { label: "Create / Edit Client POs",     group: "Client Billing" },
  "client_invoice.write": { label: "Create / Edit Client Invoices", group: "Client Billing" },
  "client_invoice.pay":   { label: "Record Client Payments",       group: "Client Billing" },
  "crm.write":            { label: "Manage Customers (CRM)",       group: "CRM" },
  "project.write":        { label: "Manage Projects",              group: "Projects" },
  "contract.write":       { label: "Manage Contracts",             group: "Projects" },
  "hr.read":              { label: "View HR Records",              group: "HR" },
  "hr.write":             { label: "Manage HR Records",            group: "HR" },
  "asset.read":           { label: "View Assets",                  group: "Assets" },
  "asset.write":          { label: "Manage Assets",                group: "Assets" },
  "accounting.read":      { label: "View Accounting",              group: "Accounting" },
  "accounting.write":     { label: "Manage Accounting",            group: "Accounting" },
  "audit.read":           { label: "View Audit Logs",              group: "Administration" },
  "settings.manage":      { label: "Manage System Settings",       group: "Administration" },
  "user.manage":          { label: "Manage Users",                 group: "Administration" },
  "export.vendor":        { label: "Export Vendor Data",           group: "Exports" },
  "export.financial":     { label: "Export Financial Data",        group: "Exports" },
  "export.crm":           { label: "Export CRM Data",             group: "Exports" },
  "export.project":       { label: "Export Project Data",          group: "Exports" },
};

const CAPABILITY_ROLES: Record<string, string[]> = {
  "vendor.write":          ["admin", "procurement"],
  "vendor.status":         ["admin", "procurement"],
  "vendor.delete":         ["admin"],
  "document.write":        ["admin"],
  "document.approve":      ["admin"],
  "po.create":             ["admin", "procurement"],
  "po.write":              ["admin", "procurement"],
  "po.status":             ["admin", "procurement", "finance"],
  "po.delete":             ["admin"],
  "po.waive_requirements": ["admin"],
  "po.approve_waiver":     ["executive"],
  "invoice.write":         ["admin", "finance"],
  "invoice.pay":           ["admin", "finance"],
  "client_po.write":       ["admin", "commercial_manager"],
  "client_invoice.write":  ["admin", "finance"],
  "client_invoice.pay":    ["admin", "finance"],
  "crm.write":             ["admin", "commercial_manager"],
  "project.write":         ["admin", "project_manager", "procurement"],
  "contract.write":        ["admin", "procurement", "project_manager"],
  "hr.read":               ["admin", "finance", "procurement", "project_manager", "commercial_manager", "user"],
  "hr.write":              ["admin"],
  "asset.read":            ["admin", "finance", "procurement", "project_manager", "commercial_manager", "user"],
  "asset.write":           ["admin", "procurement"],
  "accounting.read":       ["admin", "finance"],
  "accounting.write":      ["admin", "finance"],
  "audit.read":            ["admin"],
  "settings.manage":       ["admin"],
  "user.manage":           ["admin"],
  "export.vendor":         ["admin", "procurement", "finance"],
  "export.financial":      ["admin", "finance"],
  "export.crm":            ["admin", "commercial_manager"],
  "export.project":        ["admin", "project_manager", "commercial_manager"],
};

const ALL_ROLES = [
  { id: "admin",              label: "Admin",               color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  { id: "finance",            label: "Finance",             color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { id: "procurement",        label: "Procurement",         color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { id: "commercial_manager", label: "Commercial Mgr",      color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { id: "project_manager",    label: "Project Mgr",         color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  { id: "executive",          label: "Executive",           color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { id: "user",               label: "Standard User",       color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
];

const GROUPS = Array.from(new Set(Object.values(CAPABILITY_LABELS).map((v) => v.group)));

function has(capability: string, role: string) {
  return (CAPABILITY_ROLES[capability] || []).includes(role);
}

export function RbacView({ userRole }: { userRole: string }) {
  const isAdmin = userRole === "admin";
  const visibleRoles = isAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r.id === userRole);
  const currentRole = ALL_ROLES.find((r) => r.id === userRole);

  const capabilities = Object.keys(CAPABILITY_LABELS);

  if (!isAdmin) {
    // Personal view: list what this role can and can't do
    const granted = capabilities.filter((c) => has(c, userRole));
    const denied  = capabilities.filter((c) => !has(c, userRole));

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold ${currentRole?.color || ''}`}>
            {currentRole?.label}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your role has access to <strong className="text-slate-900 dark:text-white">{granted.length}</strong> of {capabilities.length} system capabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Granted */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">You Have Access ({granted.length})</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {GROUPS.map((group) => {
                const groupItems = granted.filter((c) => CAPABILITY_LABELS[c]?.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <li key={group}>
                    <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-800/20">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{group}</span>
                    </div>
                    {groupItems.map((c) => (
                      <div key={c} className="px-5 py-2.5 flex items-center gap-2.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{CAPABILITY_LABELS[c]?.label}</span>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Denied */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">No Access ({denied.length})</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {GROUPS.map((group) => {
                const groupItems = denied.filter((c) => CAPABILITY_LABELS[c]?.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <li key={group}>
                    <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-800/20">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{group}</span>
                    </div>
                    {groupItems.map((c) => (
                      <div key={c} className="px-5 py-2.5 flex items-center gap-2.5 opacity-50">
                        <ShieldOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-500 dark:text-slate-500">{CAPABILITY_LABELS[c]?.label}</span>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Admin view: full matrix
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500 sticky left-0 bg-white dark:bg-[#071F15] min-w-[220px]">
              Capability
            </th>
            {visibleRoles.map((role) => (
              <th key={role.id} className="px-3 py-4 text-center min-w-[110px]">
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold ${role.color}`}>
                  {role.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => {
            const groupCapabilities = capabilities.filter((c) => CAPABILITY_LABELS[c]?.group === group);
            return (
              <React.Fragment key={group}>
                <tr className="bg-slate-50/80 dark:bg-slate-800/20">
                  <td colSpan={visibleRoles.length + 1} className="px-6 py-2.5 sticky left-0 bg-slate-50/80 dark:bg-slate-800/20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{group}</span>
                  </td>
                </tr>
                {groupCapabilities.map((cap) => (
                  <tr key={cap} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors border-b border-slate-100 dark:border-slate-800/50">
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300 font-medium sticky left-0 bg-white dark:bg-[#071F15] hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors text-xs">
                      {CAPABILITY_LABELS[cap]?.label}
                    </td>
                    {visibleRoles.map((role) => (
                      <td key={role.id} className="px-3 py-3 text-center">
                        {has(cap, role.id) ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
