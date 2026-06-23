"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

interface SearchInputProps {
  placeholder?: string;
  paramName?: string;
  className?: string;
}

export function SearchInput({
  placeholder = "Search...",
  paramName = "q",
  className = "w-full pl-9 pr-4 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all",
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [text, setText] = useState(searchParams.get(paramName) || "");
  const [debouncedValue, setDebouncedValue] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  // Tracks the last value we pushed to the URL so the sync effect below
  // doesn't overwrite the input while the user is still typing.
  const lastPushed = useRef(searchParams.get(paramName) || "");

  // Sync input only when the URL changes externally (back/forward navigation).
  useEffect(() => {
    const urlValue = searchParams.get(paramName) || "";
    if (urlValue !== lastPushed.current) {
      setText(urlValue);
      lastPushed.current = urlValue;
    }
  }, [searchParams, paramName]);

  useEffect(() => {
    if (debouncedValue === lastPushed.current) return;
    lastPushed.current = debouncedValue;

    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (debouncedValue) {
        params.set(paramName, debouncedValue);
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [debouncedValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex-1 w-full max-w-md">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
          isPending ? "text-primary animate-pulse" : "text-slate-400"
        }`}
      />
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
