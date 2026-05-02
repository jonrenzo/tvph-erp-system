"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Package,
  BarChart3,
  FileText,
  Lock,
  AlertCircle,
  Settings,
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const MODULE_CONFIG = [
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
    subModules: [
      { id: "vendor-list", label: "All Vendors", href: "/dashboard/vendors" },
      {
        id: "purchase-orders",
        label: "Purchase Orders",
        href: "/dashboard/purchase-orders",
      },
      {
        id: "vendor-contracts",
        label: "Contracts",
        href: "/dashboard/vendors/contracts",
      },
      {
        id: "vendor-performance",
        label: "Performance",
        href: "/dashboard/vendors/performance",
      },
    ],
  },
  { id: "crm", label: "CRM", icon: Users, href: "/dashboard/crm" },
  {
    id: "projects",
    label: "Projects",
    icon: FolderOpen,
    href: "/dashboard/projects",
  },
  { id: "assets", label: "Assets", icon: Package, href: "/dashboard/assets" },
  {
    id: "accounting",
    label: "Accounting",
    icon: BarChart3,
    href: "/dashboard/accounting",
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: FileText,
    href: "/dashboard/invoices",
  },
  { id: "hr", label: "HR", icon: Users, href: "/dashboard/hr" },
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
  },
];

interface SidebarProps {
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
}

function SidebarItem({
  config,
  pathname,
  isCollapsed,
}: {
  config: any;
  pathname: string;
  isCollapsed: boolean;
}) {
  const hasSubModules = !!config.subModules;
  const isSubActive =
    hasSubModules &&
    config.subModules.some((sub: any) => pathname.startsWith(sub.href));
  const isActive = !hasSubModules && pathname === config.href;

  const [isOpen, setIsOpen] = useState(isSubActive);

  useEffect(() => {
    if (isSubActive && !isCollapsed) setIsOpen(true);
  }, [isSubActive, isCollapsed]);

  const Icon = config.icon;

  const handleParentClick = () => {
    if (!isCollapsed) {
      setIsOpen(!isOpen);
    }
  };

  if (!hasSubModules) {
    return (
      <Link
        href={config.href}
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
        onClick={handleParentClick}
        title={isCollapsed ? config.label : undefined}
        className={`flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors ${
          isCollapsed ? "justify-center px-0" : "justify-between gap-3 px-3"
        } ${
          isSubActive
            ? "text-primary dark:text-primary-light"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span className="truncate">{config.label}</span>}
        </div>
        {!isCollapsed && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {isOpen && !isCollapsed && (
        <div className="ml-9 space-y-1 pt-1">
          {config.subModules.map((sub: any) => {
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

export function Sidebar({
  userEmail,
  isOpen,
  onClose,
  isCollapsed,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-50 dark:bg-[#071F15] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 lg:static ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "w-[72px]" : "w-64"}`}
      >
        {/* Logo */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-all ${
            isCollapsed ? "justify-center px-0" : "px-6 gap-2"
          }`}
        >
          <Image
            src="/logo.svg"
            alt="TelcoVantage Logo"
            width={isCollapsed ? 28 : 25}
            height={isCollapsed ? 28 : 25}
            priority
            draggable={false}
            className="select-none invert dark:invert-0 shrink-0 transition-all"
          />
          {!isCollapsed && (
            <span className="font-plus-jakarta font-bold text-slate-900 dark:text-white text-base tracking-[-0.06em] whitespace-nowrap">
              TelcoVantage Philippines
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-6 space-y-1">
          {MODULE_CONFIG.map((config) => (
            <SidebarItem
              key={config.id}
              config={config}
              pathname={pathname}
              isCollapsed={isCollapsed}
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

        {/* Footer Info */}
        <div
          className={`border-t border-slate-200 dark:border-slate-800 transition-all ${
            isCollapsed ? "hidden" : "block p-4"
          }`}
        >
          <div className="text-xs text-slate-500 overflow-hidden">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-0.5 whitespace-nowrap">
              Admin
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
