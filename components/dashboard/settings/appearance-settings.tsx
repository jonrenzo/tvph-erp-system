"use client"

import { useTheme } from "next-themes";
import { useAccent, AccentColor } from "@/components/accent-provider";
import { Sun, Moon, Monitor, Sparkles, Check } from "lucide-react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();

  const baseThemes = [
    {
      id: "system",
      name: "System Preference",
      description: "Match your system's light or dark mode setting automatically.",
      icon: Monitor,
      previewClass: "bg-gradient-to-r from-slate-100 to-slate-900 border-slate-200 dark:border-slate-800",
    },
    {
      id: "light",
      name: "Light Mode",
      description: "Clean, crisp light backgrounds with dark typography.",
      icon: Sun,
      previewClass: "bg-slate-50 border-slate-200 text-slate-900",
    },
    {
      id: "dark",
      name: "Dark Mode",
      description: "Classic dark mode with charcoal and deep slate backgrounds.",
      icon: Moon,
      previewClass: "bg-[#0f172a] border-slate-800 text-white",
    },
    {
      id: "midnight",
      name: "Midnight Mode",
      description: "Ultra-deep, high-contrast black and deep navy theme.",
      icon: Sparkles,
      previewClass: "bg-[#030712] border-slate-900 text-white",
    },
  ];

  const accents: { id: AccentColor; name: string; bgClass: string; colorHex: string }[] = [
    { id: "default", name: "Forest Green (Default)", bgClass: "bg-[#0a5c3b]", colorHex: "#0a5c3b" },
    { id: "blue", name: "Royal Blue", bgClass: "bg-[#2563eb]", colorHex: "#2563eb" },
    { id: "rose", name: "Vibrant Rose", bgClass: "bg-[#db2777]", colorHex: "#db2777" },
    { id: "violet", name: "Deep Violet", bgClass: "bg-[#7c3aed]", colorHex: "#7c3aed" },
    { id: "orange", name: "Sunset Orange", bgClass: "bg-[#ea580c]", colorHex: "#ea580c" },
  ];

  return (
    <div className="p-8 space-y-10">
      {/* Base Theme Section */}
      <div className="space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight text-lg">Appearance Theme</h3>
          <p className="text-xs text-slate-500 mt-0.5">Customize the primary background interface of the ERP application.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {baseThemes.map((t) => {
            const isSelected = theme === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-start text-left p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40"
                }`}
              >
                {/* Visual Indicator of the background */}
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 group-hover:scale-110 transition-transform ${t.previewClass}`} />

                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    isSelected ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      {t.name}
                      {isSelected && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                          Active
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[85%] leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Color Section */}
      <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight text-lg">Accent Theme Color</h3>
          <p className="text-xs text-slate-500 mt-0.5">Select a brand color that will highlight buttons, active links, tabs, and critical metric rings.</p>
        </div>

        <div className="flex flex-wrap gap-4">
          {accents.map((acc) => {
            const isSelected = accent === acc.id;
            return (
              <button
                key={acc.id}
                onClick={() => setAccent(acc.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm font-bold text-slate-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-white shadow-inner ${acc.bgClass}`}>
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </span>
                <span className="text-sm font-semibold">{acc.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
