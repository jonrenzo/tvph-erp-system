"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, Bell, LogOut, User, ChevronDown } from "lucide-react";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  userEmail: string;
  onSidebarToggle: () => void;
}

export function Header({ userEmail, onSidebarToggle }: HeaderProps) {
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
    <header className="relative z-50 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#071F15]/80 px-6 backdrop-blur-md">
      {/* Left Section */}
      <div className="flex flex-1 items-center gap-4">
        <button
          onClick={onSidebarToggle}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-[#0a0a0a]/50 px-3 py-1.5 md:flex">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="search"
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <button className="relative text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white ml-2">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="relative ml-2" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden flex-col items-start text-xs sm:flex">
              <span className="font-medium text-slate-900 dark:text-white">
                Super Admin
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] p-1 shadow-xl z-50">
              <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                Logged in as: <br />
                <span className="text-slate-900 dark:text-white truncate block">
                  {userEmail}
                </span>
              </div>
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
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
