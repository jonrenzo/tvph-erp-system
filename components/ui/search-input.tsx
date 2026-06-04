"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useDebounce } from "use-debounce";

interface SearchInputProps {
  placeholder?: string;
  paramName?: string;
  className?: string;
}

export function SearchInput({ 
  placeholder = "Search...", 
  paramName = "q",
  className = "w-full pl-9 pr-4 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialValue = searchParams.get(paramName) || "";
  const [text, setText] = useState(initialValue);
  const [debouncedValue] = useDebounce(text, 300);

  // Sync with URL parameter changes (e.g. going back)
  useEffect(() => {
    setText(searchParams.get(paramName) || "");
  }, [searchParams, paramName]);

  useEffect(() => {
    // Prevent running on mount if nothing changed
    if (debouncedValue === initialValue) return;

    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (debouncedValue) {
        params.set(paramName, debouncedValue);
      } else {
        params.delete(paramName);
      }
      // Changing the search resets pagination to the first page.
      params.delete("page");

      // Update URL without scrolling to top or full reload
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [debouncedValue, pathname, router, searchParams, paramName, initialValue]);

  return (
    <div className="relative flex-1 w-full max-w-md">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${isPending ? "text-primary animate-pulse" : "text-slate-400"}`} />
      <input
        type="text"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={className}
      />
    </div>
  );
}
