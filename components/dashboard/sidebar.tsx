"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Package,
  BarChart3,
  FileText,
  ReceiptText,
  HandCoins,
  Lock,
  AlertCircle,
  Settings,
  Building2,
  ChevronDown,
  FileBarChart,
  Settings2,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/roles";

type ModuleItem = {
  id: string;
  label: string;
  icon?: React.ElementType;
  href?: string;
  roles?: string[];
  subModules?: SubModuleItem[];
};

type SubModuleItem = {
  id: string;
  label: string;
  href: string;
  roles?: string[];
};

const MODULE_CONFIG: ModuleItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "vendor",
    label: "Vendors",
    icon: Building2,
    roles: ["superadmin", "admin", "operations", "finance"],
    subModules: [
      { id: "vendor-list", label: "All Vendors", href: "/dashboard/vendors", roles: ["superadmin", "admin", "operations"] },
      { id: "purchase-requests", label: "Purchase Requests", href: "/dashboard/purchase-requests", roles: ["superadmin", "admin", "operations", "finance"] },
      { id: "purchase-orders", label: "Purchase Orders", href: "/dashboard/purchase-orders", roles: ["superadmin", "admin", "operations", "finance"] },
      { id: "vendor-contracts", label: "Contracts", href: "/dashboard/vendors/contracts", roles: ["superadmin", "admin", "operations"] },
      { id: "vendor-performance", label: "Performance", href: "/dashboard/vendors/performance", roles: ["superadmin", "admin", "operations"] },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    roles: ["superadmin", "admin", "operations", "finance"],
    subModules: [
      { id: "crm-customers", label: "All Customers", href: "/dashboard/crm", roles: ["superadmin", "admin", "operations"] },
      { id: "crm-new-customer", label: "Add Customer", href: "/dashboard/crm/new", roles: ["superadmin", "admin", "operations"] },
      { id: "crm-new-project", label: "New Customer Project", href: "/dashboard/crm/projects/new", roles: ["superadmin", "admin", "operations"] },
      { id: "client-pos", label: "Client POs", href: "/dashboard/client-pos", roles: ["superadmin", "admin", "operations"] },
      { id: "client-invoices", label: "Client Billing", href: "/dashboard/client-invoices", roles: ["superadmin", "admin", "finance"] },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderOpen,
    roles: ["superadmin", "admin", "operations", "finance"],
    subModules: [
      { id: "projects-list", label: "All Projects", href: "/dashboard/projects", roles: ["superadmin", "admin", "operations", "finance"] },
      { id: "project-status", label: "Project Status", href: "/dashboard/project-status", roles: ["superadmin", "admin", "operations", "finance"] },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    icon: Package,
    subModules: [
      { id: "assets-list", label: "Asset Registry", href: "/dashboard/assets" },
      { id: "assets-add", label: "Add Asset", href: "/dashboard/assets/new", roles: ["superadmin", "admin", "operations"] },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: BarChart3,
    roles: ["superadmin", "admin", "finance"],
    subModules: [
      { id: "accounting-dash", label: "Financial Dashboard", href: "/dashboard/accounting", roles: ["superadmin", "admin", "finance"] },
      { id: "accounting-ap", label: "AP Aging", href: "/dashboard/accounting/ap-aging", roles: ["superadmin", "admin", "finance"] },
      { id: "accounting-tax", label: "Tax Summary", href: "/dashboard/accounting/tax", roles: ["superadmin", "admin", "finance"] },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: ReceiptText,
    href: "/dashboard/invoices",
    roles: ["superadmin", "admin", "finance"],
  },
  {
    id: "payment-requests",
    label: "Payment Requests",
    icon: HandCoins,
    href: "/dashboard/payment-requests",
    roles: ["superadmin", "admin", "finance"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
    href: "/dashboard/reports",
    roles: ["superadmin", "admin", "finance"],
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    subModules: [
      { id: "hr-directory", label: "Employee Directory", href: "/dashboard/hr" },
      { id: "hr-add", label: "Add Employee", href: "/dashboard/hr/new", roles: ["superadmin", "admin"] },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    href: "/dashboard/documents",
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: Lock,
    href: "/dashboard/compliance",
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    icon: AlertCircle,
    href: "/dashboard/audit-logs",
    roles: ["superadmin"],
  },
  {
    id: "system",
    label: "System",
    icon: Settings2,
    href: "/dashboard/system",
    roles: ["superadmin"],
  },
];

function canSee(roles: string[] | undefined, userRole: string) {
  return !roles || roles.includes(userRole);
}

function visibleSubModules(subModules: SubModuleItem[], userRole: string) {
  return subModules.filter((s) => canSee(s.roles, userRole));
}

interface SidebarProps {
  userEmail: string;
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  scrollTargetRef: React.RefObject<HTMLElement | null>;
}

function SidebarItem({
  config,
  pathname,
  isCollapsed,
  userRole,
  isOpen,
  onToggle,
}: {
  config: ModuleItem;
  pathname: string;
  isCollapsed: boolean;
  userRole: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const filteredSubs = config.subModules
    ? visibleSubModules(config.subModules, userRole)
    : undefined;

  const hasSubModules = !!filteredSubs && filteredSubs.length > 0;
  const isSubActive = hasSubModules && filteredSubs!.some((sub) => pathname.startsWith(sub.href));
  const isActive = !config.subModules && pathname === config.href;

  const Icon = config.icon!;

  if (config.subModules && !hasSubModules) return null;

  if (!config.subModules) {
    return (
      <Link
        href={config.href!}
        title={isCollapsed ? config.label : undefined}
        className={`flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
          isCollapsed ? "justify-center px-0" : "gap-3 px-3"
        } ${
          isActive
            ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="truncate">{config.label}</span>}
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => { if (!isCollapsed) onToggle(); }}
        title={isCollapsed ? config.label : undefined}
        className={`flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors ${
          isCollapsed ? "justify-center px-0" : "justify-between gap-3 px-3"
        } ${
          isSubActive
            ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <Icon className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span className="truncate">{config.label}</span>}
        </div>
        {!isCollapsed && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && !isCollapsed && (
        <div className="ml-9 space-y-1 pt-1">
          {filteredSubs!.map((sub) => {
            const isSubItemActive = pathname === sub.href;
            return (
              <Link
                key={sub.id}
                href={sub.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isSubItemActive
                    ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userEmail, userRole, isOpen, onClose, isCollapsed, scrollTargetRef }: SidebarProps) {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const visibleModules = MODULE_CONFIG.filter((m) => canSee(m.roles, userRole));

  const getActiveId = () => {
    for (const m of visibleModules) {
      if (m.subModules && visibleSubModules(m.subModules, userRole).some((s) => pathname.startsWith(s.href))) return m.id;
    }
    return null;
  };

  const [openId, setOpenId] = useState<string | null>(getActiveId());

  useEffect(() => {
    const active = getActiveId();
    if (active) setOpenId(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (isCollapsed) setOpenId(null);
    else {
      const active = getActiveId();
      if (active) setOpenId(active);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  useEffect(() => {
    const aside = asideRef.current;
    const main = scrollTargetRef?.current;
    const nav = navRef.current;
    if (!aside || !main || !nav) return;

    const onWheel = (e: WheelEvent) => {
      const atTop = nav.scrollTop <= 0;
      const atBottom = nav.scrollTop + nav.clientHeight >= nav.scrollHeight;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        main.scrollBy(0, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY);
      }
    };

    aside.addEventListener("wheel", onWheel, { passive: true });
    return () => aside.removeEventListener("wheel", onWheel);
  }, [scrollTargetRef]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-sidebar-backdrop)] bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        ref={asideRef}
        className={`fixed inset-y-0 left-0 z-[var(--z-sidebar)] flex flex-col bg-slate-50 dark:bg-[#071F15] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 lg:static ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "w-[72px]" : "w-64"}`}
      >
        {/* Logo */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-all ${
            isCollapsed ? "justify-center px-0" : "px-6 gap-2"
          }`}
        >
          <Link href="/dashboard">
            <Image
              src="/logo.svg"
              alt="TelcoVantage Logo"
              width={isCollapsed ? 28 : 25}
              height={isCollapsed ? 28 : 25}
              priority
              draggable={false}
              className="select-none invert dark:invert-0 shrink-0 transition-all"
            />
          </Link>
          {!isCollapsed && (
            <span className="font-plus-jakarta font-bold text-slate-900 dark:text-white text-base tracking-[-0.06em] whitespace-nowrap">
              TelcoVantage Philippines
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <div ref={navRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-6 space-y-1">
          {visibleModules.map((config) => (
            <SidebarItem
              key={config.id}
              config={config}
              pathname={pathname}
              isCollapsed={isCollapsed}
              userRole={userRole}
              isOpen={openId === config.id}
              onToggle={() => setOpenId((prev) => (prev === config.id ? null : config.id))}
            />
          ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3">
          <Link
            href="/dashboard/settings"
            title={isCollapsed ? "Settings" : undefined}
            className={`flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
              isCollapsed ? "justify-center px-0" : "gap-3 px-3"
            } ${
              pathname === "/dashboard/settings"
                ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
        </div>

        {/* Footer */}
        <div
          className={`border-t border-slate-200 dark:border-slate-800 transition-all ${
            isCollapsed ? "hidden" : "block p-4"
          }`}
        >
          <div className="text-xs text-slate-500 overflow-hidden">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-0.5 whitespace-nowrap">
              {ROLE_LABELS[userRole as keyof typeof ROLE_LABELS] || userRole}
            </p>
            <p className="truncate" title={userEmail}>
              {userEmail}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
