"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface SortColumnButtonProps {
  label: string;
  paramName?: string;
  className?: string;
}

export function SortColumnButton({
  label,
  paramName = "sort",
  className = "",
}: SortColumnButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = searchParams.get(paramName) as "asc" | "desc" | null;

  const next = current === "asc" ? "desc" : "asc";

  const handleClick = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set(paramName, next);
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const Icon =
    current === "asc" ? ArrowUp : current === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-white transition-colors ${
        isPending ? "opacity-50" : ""
      } ${className}`}
    >
      {label}
      <Icon
        className={`h-3.5 w-3.5 ${current ? "text-primary" : "text-slate-400"}`}
      />
    </button>
  );
}
