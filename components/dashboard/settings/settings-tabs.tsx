"use client";

import { useState } from "react";
import { Building2, Users, CreditCard, ShieldCheck, Save, Shield } from "lucide-react";
import { updateOrganizationSettings, updateFinancialSettings, updateUserRole } from "@/app/dashboard/settings/actions";
import { AddUserButton } from "@/components/dashboard/hr/add-user-button";

export function SettingsTabs({ initialSettings, team }: { initialSettings: any, team: any[] }) {
  const [activeTab, setActiveTab] = useState("organization");
  const [isSaving, setIsSaving] = useState(false);

  const tabs = [
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "team", label: "Team Management", icon: Users },
    { id: "financials", label: "Financials", icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-primary text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Organization Tab */}
        {activeTab === "organization" && (
          <form action={async (formData) => {
            setIsSaving(true);
            await updateOrganizationSettings(formData);
            setIsSaving(false);
          }} className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Company Name</label>
                    <input 
                      name="company_name"
                      defaultValue={initialSettings?.company_name}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Business Address</label>
                    <textarea 
                      name="company_address"
                      rows={3}
                      defaultValue={initialSettings?.company_address}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                    ></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Company TIN</label>
                    <input 
                      name="company_tin"
                      defaultValue={initialSettings?.company_tin}
                      placeholder="000-000-000-000"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
               </div>

               <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 bg-slate-50/50 dark:bg-slate-900/20">
                  <div className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                     <Building2 className="h-10 w-10 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white text-center">Company Logo</p>
                  <p className="text-xs text-slate-500 text-center mt-1">Used for PO and Invoice PDF headers.</p>
                  <button type="button" className="mt-4 px-4 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                     Update Logo
                  </button>
               </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800/50">
               <button 
                 type="submit"
                 disabled={isSaving}
                 className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
               >
                 {isSaving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                 Save Organization Profile
               </button>
            </div>
          </form>
        )}

        {/* Team Management Tab */}
        {activeTab === "team" && (
          <div className="p-0">
             <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                   <h3 className="font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Active Team Members</h3>
                   <p className="text-xs text-slate-500 mt-0.5">Control access levels and system roles.</p>
                </div>
                <AddUserButton />
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                   <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/30 dark:bg-slate-800/10 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                         <th className="px-8 py-4 font-semibold">User</th>
                         <th className="px-8 py-4 font-semibold">Role</th>
                         <th className="px-8 py-4 font-semibold">Joined</th>
                         <th className="px-8 py-4 text-right font-semibold">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {team.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                           <td className="px-8 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-primary">
                                    {user.full_name?.charAt(0)}
                                 </div>
                                 <div>
                                    <div className="font-bold text-slate-900 dark:text-white">{user.full_name}</div>
                                    <div className="text-[10px] text-slate-500">{user.email}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-8 py-4">
                              <select 
                                value={user.role}
                                onChange={async (e) => await updateUserRole(user.id, e.target.value)}
                                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-primary"
                              >
                                 <option value="admin">Administrator</option>
                                 <option value="finance">Finance</option>
                                 <option value="procurement">Procurement</option>
                                 <option value="project_manager">Project Manager</option>
                                 <option value="user">Standard User</option>
                              </select>
                           </td>
                           <td className="px-8 py-4 text-slate-500 text-xs">
                              {new Date(user.created_at).toLocaleDateString()}
                           </td>
                           <td className="px-8 py-4 text-right">
                              <button className="text-red-500 hover:underline text-xs font-bold">Revoke Access</button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* Financials Tab */}
        {activeTab === "financials" && (
          <form action={async (formData) => {
            setIsSaving(true);
            await updateFinancialSettings(formData);
            setIsSaving(false);
          }} className="p-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Standard VAT Rate (%)</label>
                      <div className="relative">
                         <input 
                            name="default_vat_rate"
                            type="number"
                            step="0.01"
                            defaultValue={initialSettings?.default_vat_rate}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                         />
                         <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Default Payment Terms</label>
                      <select 
                        name="default_payment_terms"
                        defaultValue={initialSettings?.default_payment_terms}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary appearance-none"
                      >
                         <option value="COD">Cash on Delivery</option>
                         <option value="Net 15">Net 15 Days</option>
                         <option value="Net 30">Net 30 Days</option>
                         <option value="Net 60">Net 60 Days</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reporting Currency</label>
                      <select 
                        name="currency"
                        defaultValue={initialSettings?.currency}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary appearance-none"
                      >
                         <option value="PHP">Philippine Peso (₱)</option>
                         <option value="USD">US Dollar ($)</option>
                      </select>
                   </div>
                   <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl flex gap-3">
                      <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 dark:text-amber-500 leading-relaxed">
                         Changing these defaults will only affect <strong>new</strong> Purchase Orders and Vendors. Existing records will remain unchanged to preserve historical audit integrity.
                      </p>
                   </div>
                </div>
             </div>

             <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800/50">
               <button 
                 type="submit"
                 disabled={isSaving}
                 className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
               >
                 {isSaving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                 Update Financial Rules
               </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
