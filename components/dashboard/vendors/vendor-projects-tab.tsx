"use client";

import { useState, useTransition } from "react";
import { FolderGit2, Plus, ExternalLink, ChevronDown, ChevronUp, Clock, AlertCircle, Unlink, Loader2 } from "lucide-react";
import { linkVendorToProject, removeVendorFromProject } from "@/app/dashboard/projects/actions";
import Link from "next/link";

type Project = {
  id: string;
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
  pos,
  allProjects,
}: { 
  vendorId: string; 
  projects: Project[]; 
  pos: PO[]; 
  allProjects?: { id: string; name: string }[];
}) {
  const [isLinking, setIsLinking] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isPendingLink, startLinkTransition] = useTransition();
  const [isPendingRemove, startRemoveTransition] = useTransition();
  const [removingProjectId, setRemovingProjectId] = useState<string | null>(null);

  const linkedProjectIds = projects.map(p => p.id);
  const availableProjects = (allProjects || []).filter(p => !linkedProjectIds.includes(p.id));

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
      case 'on_hold': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const handleLink = () => {
    if (!selectedProject) return;
    setLinkError(null);
    startLinkTransition(async () => {
      const result = await linkVendorToProject(selectedProject, vendorId);
      if (result.error) {
        setLinkError(result.error);
      } else {
        setIsLinking(false);
        setSelectedProject("");
        window.location.reload();
      }
    });
  };

  const handleRemove = (projectId: string) => {
    setRemoveError(null);
    setRemovingProjectId(projectId);
    startRemoveTransition(async () => {
      const result = await removeVendorFromProject(projectId, vendorId);
      if (result.error) {
        setRemoveError(result.error);
      } else {
        window.location.reload();
      }
      setRemovingProjectId(null);
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" /> Linked Projects
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Projects this vendor is linked to and their associated purchase orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLinking && (
            <button
              onClick={() => setIsLinking(true)}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95"
            >
              <Plus className="h-4 w-4" /> Link to Project
            </button>
          )}
        </div>
      </div>

      {/* Link Form */}
      {isLinking && (
        <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-5 shadow-sm ring-1 ring-primary/20 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Link to an Existing Project</h3>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary"
          >
            <option value="">Select a project...</option>
            {availableProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {availableProjects.length === 0 && (
            <p className="text-xs text-slate-500">No available projects. <Link href="/dashboard/projects/new" className="text-primary hover:underline">Create one first.</Link></p>
          )}
          {linkError && (
            <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{linkError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setIsLinking(false); setLinkError(null); }}
              className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleLink}
              disabled={isPendingLink || !selectedProject}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all"
            >
              {isPendingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Link
            </button>
          </div>
        </div>
      )}

      {removeError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-500 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {removeError}
        </div>
      )}

      {projects.length === 0 && !isLinking && (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <FolderGit2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No projects linked</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
            Link this vendor to an existing project, or create a new one first.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsLinking(true)}
              className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Link to Project
            </button>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <FolderGit2 className="h-4 w-4" /> Create New Project
            </Link>
          </div>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => handleRemove(project.id)}
                      disabled={isPendingRemove && removingProjectId === project.id}
                      className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                      title="Unlink from project"
                    >
                      {isPendingRemove && removingProjectId === project.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                
                {project.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                    {project.description}
                  </p>
                )}
                
                <div className="flex flex-col gap-2 mt-auto text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" />
                      Expires on: Dec 31, 2026
                    </span>
                  </div>
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
