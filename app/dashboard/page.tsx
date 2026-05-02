export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="font-plus-jakarta text-3xl font-bold text-slate-900 dark:text-white mb-6">
        Dashboard
      </h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 z-0">
        {[
          { label: "Total Revenue", value: "$45,231.89", change: "+20.1%" },
          { label: "Active Users", value: "+2350", change: "+180.1%" },
          { label: "New Contracts", value: "12,234", change: "+19%" },
          { label: "Active Issues", value: "573", change: "-24%" },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 backdrop-blur-sm shadow-sm dark:shadow-none"
          >
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {stat.label}
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {stat.value}
              </span>
              <span
                className={`text-xs font-medium ${stat.change.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 backdrop-blur-sm min-h-[400px] shadow-sm dark:shadow-none">
        <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="text-slate-500 dark:text-slate-400 text-sm">
          No recent activity to display.
        </div>
      </div>
    </div>
  );
}
