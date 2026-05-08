"use client";

import { useState } from "react";
import { Check, X, Edit2 } from "lucide-react";
import { assignProjectToPO } from "@/app/dashboard/purchase-orders/actions";

export function POProjectAssigner({
  poId,
  currentProjectId,
  projects,
}: {
  poId: string;
  currentProjectId: string | null;
  projects: { id: string; name: string }[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId || "");
  const [isSaving, setIsSaving] = useState(false);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const handleSave = async () => {
    setIsSaving(true);
    await assignProjectToPO(poId, selectedProjectId || null);
    setIsSaving(false);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={isSaving}
          className="px-3 py-1.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
        >
          <option value="">No Project Linked</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setSelectedProjectId(currentProjectId || "");
            setIsEditing(false);
          }}
          disabled={isSaving}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1 group">
      {currentProject ? (
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {currentProject.name}
        </span>
      ) : (
        <span className="text-slate-400 italic text-sm">Not linked to a project</span>
      )}
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
