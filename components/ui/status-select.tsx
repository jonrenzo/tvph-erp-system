"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Option {
  value: string;
  label: string;
}

interface StatusSelectProps {
  paramName?: string;
  options: Option[];
}

export function StatusSelect({ paramName = "status", options }: StatusSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentValue = searchParams.get(paramName) || "all";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value && value !== "all") {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      // Changing the filter resets pagination to the first page.
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="relative">
      <select
        className={`px-4 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none pr-10 ${isPending ? "opacity-70" : ""}`}
        value={currentValue}
        onChange={handleChange}
        disabled={isPending}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
