"use client";

import { useState, useActionState, useEffect } from "react";
import { FolderGit2, Edit2, ExternalLink, ArrowLeft, Clock, FileText, Building2, Package } from "lucide-react";
import { updateProject } from "@/app/dashboard/vendors/actions";
import Link from "next/link";

type Project = {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  contract_url: string;
  status: string;
  created_at: string;
  vendors?: {
    id: string;
    name: string;
  };
};

type PO = {
  id: string;
  po_number: string;
  issued_date: string;
  amount: number;
  status: string;
  project_id: string | null;
};

export function ProjectDetailContent({ project, pos }: { project: Project; pos: PO[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [updateState, updateAction, isUpdating] = useActionState(updateProject, null);

  useEffect(() => {
    if (updateState?.success) {
      setIsEditing(false);
    }
  }, [updateState]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
      case 'on_hold': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getPOStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
        <Link href="/dashboard/projects" className="hover:text-primary transition-colors flex items-center gap-1.5">
          <FolderGit2 className="h-4 w-4" /> Projects
        </Link>
        <span>/</span>
        {project.vendors && (
          <>
            <Link href={`/dashboard/vendors/${project.vendors.id}`} className="hover:text-primary transition-colors flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> {project.vendors.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{project.name}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
              {project.name}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}>
              {project.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Created on {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 hover:border-primary/50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Edit2 className="h-4 w-4" /> Edit Project
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white dark:bg-[#071F15] border border-primary/30 rounded-2xl p-6 shadow-sm ring-1 ring-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Project Details</h3>
          </div>
          <form action={updateAction} className="space-y-4">
            {updateState?.error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
                {updateState.error}
              </div>
            )}
            
            <input type="hidden" name="vendor_id" value={project.vendor_id} />
            <input type="hidden" name="id" value={project.id} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Project Name</label>
                <input
                  name="name"
                  defaultValue={project.name}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                <select
                  name="status"
                  defaultValue={project.status}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Contract URL</label>
                <input
                  name="contract_url"
                  type="url"
                  defaultValue={project.contract_url}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="https://..."
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
                <textarea
                  name="description"
                  defaultValue={project.description}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {project.description && !isEditing && (
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-wider">Project Description</h3>
          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{project.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Purchase Orders */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Connected POs
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
              {pos.length}
            </span>
          </div>

          <div className="space-y-3">
            {pos.length > 0 ? (
              pos.map(po => (
                <div key={po.id} className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-primary/50 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <Link 
                      href={`/dashboard/purchase-orders/${po.id}`}
                      className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {po.po_number}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getPOStatusColor(po.status)}`}>
                      {po.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      {new Date(po.issued_date).toLocaleDateString()}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ${po.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-50 dark:bg-[#0a0a0a]/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No Purchase Orders</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">This project has no associated POs yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Contract Viewer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Contract Document
            </h2>
            {project.contract_url && (
              <a 
                href={project.contract_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Open in new tab <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-[600px] flex flex-col relative">
            {project.contract_url ? (
              <iframe 
                src={project.contract_url} 
                className="w-full h-full border-0"
                title="Project Contract"
                allow="fullscreen"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/20">
                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Contract Linked</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                  Add a contract URL in the project details to view the document directly in this dashboard.
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 hover:border-primary/50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
                >
                  <Edit2 className="h-4 w-4" /> Add Contract URL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
