"use client";

import { useState } from "react";
import { Wrench, Loader2, Plus, Calendar, DollarSign, AlignLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { logMaintenance } from "@/app/dashboard/assets/actions";

export function MaintenanceLog({ assetId, logs }: { assetId: string, logs: any[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    maintenance_type: "repair",
    description: "",
    cost: "",
    performed_date: new Date().toISOString().split('T')[0],
    performed_by: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
      };

      await logMaintenance(assetId, payload);
      setIsOpen(false);
      setFormData({
        maintenance_type: "repair",
        description: "",
        cost: "",
        performed_date: new Date().toISOString().split('T')[0],
        performed_by: "",
      });
      router.refresh();
    } catch (error) {
      alert("Failed to log maintenance");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-900 dark:text-white">Maintenance History</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {isOpen ? "Cancel" : <><Plus className="h-4 w-4" /> Log Maintenance</>}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Type</label>
              <select
                required
                value={formData.maintenance_type}
                onChange={e => setFormData({...formData, maintenance_type: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-sm"
              >
                <option value="repair">Repair</option>
                <option value="preventive">Preventive</option>
                <option value="inspection">Inspection</option>
                <option value="upgrade">Upgrade</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Date</label>
              <input
                required
                type="date"
                value={formData.performed_date}
                onChange={e => setFormData({...formData, performed_date: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Cost (₱)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.cost}
                onChange={e => setFormData({...formData, cost: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Performed By (Technician/Vendor)</label>
              <input
                type="text"
                placeholder="Name or company"
                value={formData.performed_by}
                onChange={e => setFormData({...formData, performed_by: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-sm"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Description</label>
            <textarea
              required
              rows={2}
              placeholder="What was done?"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-sm resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-70"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Record
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm border border-slate-200 dark:border-slate-800 rounded-xl border-dashed">
            No maintenance records found.
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#071F15] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    log.maintenance_type === 'repair' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                    log.maintenance_type === 'preventive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {log.maintenance_type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(log.performed_date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{log.description}</p>
                {log.performed_by && (
                  <p className="text-xs text-slate-500 mt-1">By: {log.performed_by}</p>
                )}
              </div>
              {Number(log.cost) > 0 && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500 mb-0.5">Cost</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    ₱{Number(log.cost).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
