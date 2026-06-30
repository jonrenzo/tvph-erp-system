'use client';

import Link from "next/link";

export function CustomerFilter({ accounts, accountFilter }: { accounts: any[] | null; accountFilter: string | null }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <form method="GET" className="flex items-center gap-2">
        <select
          name="account_id"
          defaultValue={accountFilter || ""}
          onChange={(e) => {
            const form = e.target.closest('form') as HTMLFormElement;
            form?.submit();
          }}
          className="px-3 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary transition-all appearance-none"
        >
          <option value="">All Clients</option>
          {(accounts || []).map((a: any) => (
            <option key={a.id} value={a.id}>{a.company_name}</option>
          ))}
        </select>
      </form>
      {accountFilter && (
        <Link href="/dashboard/projects" className="text-xs text-slate-500 hover:text-primary transition-colors">
          Clear filter
        </Link>
      )}
    </div>
  );
}
