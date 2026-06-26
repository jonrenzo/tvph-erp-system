"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Menu,
  LogOut,
  User,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  History,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { ClockWidget } from "@/components/dashboard/clock";

interface HeaderProps {
  userEmail: string;
  userName?: string;
  avatarUrl?: string;
  onSidebarToggle: () => void;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  onAuditOpen: () => void;
}

export function Header({
  userEmail,
  userName,
  avatarUrl,
  onSidebarToggle,
  isCollapsed,
  onCollapseToggle,
  onAuditOpen,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
      router.push("/login");
    });
  };

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#071F15]/80 px-6 backdrop-blur-md">
      {/* Left Section */}
      <div className="flex flex-1 items-center gap-4">
        <button
          onClick={onSidebarToggle}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <button
          onClick={onCollapseToggle}
          className="hidden lg:flex text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>

        <GlobalSearch />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <ClockWidget />
        <ThemeToggle />

        <button
          onClick={onAuditOpen}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Activity log"
        >
          <History className="h-5 w-5" />
        </button>

        <NotificationBell />

        <div className="relative ml-2" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="hidden flex-col items-start text-xs sm:flex">
              <span className="font-medium text-slate-900 dark:text-white">
                {userName || "User"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-1 shadow-xl z-[var(--z-dropdown)]">
              <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                Logged in as: <br />
                <span className="text-slate-900 dark:text-white truncate block">
                  {userEmail}
                </span>
              </div>
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  router.push("/dashboard/profile");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <User className="h-4 w-4" />
                Profile Settings
              </button>
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {isPending ? "Logging out..." : "Logout"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
