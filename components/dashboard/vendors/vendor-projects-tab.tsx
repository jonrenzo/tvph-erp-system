"use client";

import { useState, useActionState, useEffect } from "react";
import { FolderGit2, Plus, Edit2, ExternalLink, ChevronDown, ChevronUp, Clock, AlertCircle } from "lucide-react";
import { createProject, updateProject } from "@/app/dashboard/vendors/actions";
import Link from "next/link";

type Project = {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  contract_url: string;
  status: string;
  created_at: string;
};

type PO = {
  id: string;
  po_number: string;
  issued_date: string;
  amount: number;
  status: string;
  project_id: string | null;
};

export function VendorProjectsTab({ 
  vendorId, 
  projects, 
  pos 
}: { 
  vendorId: string; 
  projects: Project[]; 
  pos: PO[]; 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const [createState, createAction, isCreating] = useActionState(createProject, null);
  const [updateState, updateAction, isUpdating] = useActionState(updateProject, null);

  useEffect(() => {
    if (createState?.success) {
      setIsAdding(false);
    }
    if (updateState?.success) {
      setEditingProject(null);
    }
  }, [createState, updateState]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
      case 'on_hold': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" /> Projects
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage projects and their associated purchase orders for this vendor.
          </p>
        </div>
        {!isAdding && !editingProject && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add Project
          </button>
        )}
      </div>

      {(isAdding || editingProject) && (
        <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-6 shadow-sm ring-1 ring-primary/20">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {isAdding ? "Create New Project" : "Edit Project"}
          </h3>
          <form action={isAdding ? createAction : updateAction} className="space-y-4">
            {(createState?.error || updateState?.error) && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
                {createState?.error || updateState?.error}
              </div>
            )}
            
            <input type="hidden" name="vendor_id" value={vendorId} />
            {editingProject && <input type="hidden" name="id" value={editingProject.id} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Project Name
                </label>
                <input
                  name="name"
                  defaultValue={editingProject?.name || ""}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="e.g. Q3 Marketing Campaign"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={editingProject?.status || "active"}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Contract URL (Optional)
                </label>
                <input
                  name="contract_url"
                  type="url"
                  defaultValue={editingProject?.contract_url || ""}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="https://..."
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingProject?.description || ""}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                  placeholder="Project details..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingProject(null);
                }}
                className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || isUpdating}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {(isCreating || isUpdating) ? "Saving..." : "Save Project"}
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 && !isAdding && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <FolderGit2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No projects yet</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
            Create a project to start tracking related contracts and purchase orders for this vendor.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Create First Project
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(project => {
          const projectPOs = pos.filter(po => po.project_id === project.id);
          
          return (
            <div 
              key={project.id} 
              className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
            >
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-1">
                    {project.name}
                  </h3>
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}>
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                
                {project.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                    {project.description}
                  </p>
                )}
                
                <div className="flex flex-col gap-2 mt-auto text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5 text-primary">
                    <FolderGit2 className="h-3.5 w-3.5" />
                    {projectPOs.length} Connected PO{projectPOs.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 p-4 flex items-center justify-end">
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-medium transition-all w-full justify-center"
                >
                  <ExternalLink className="h-4 w-4" /> View Full Project
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
