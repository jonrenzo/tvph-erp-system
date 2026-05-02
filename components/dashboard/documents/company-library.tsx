"use client";

import { 
  ShieldCheck, 
  Users, 
  CreditCard, 
  FileCode,
  ArrowRight 
} from "lucide-react";

interface Document {
  id: string;
  doc_type: string;
  label: string;
  file_url: string;
}

export function CompanyLibrary({ documents, onFolderClick }: { documents: Document[], onFolderClick: (id: string) => void }) {
  const folders = [
    { 
      id: "legal", 
      label: "Legal & Compliance", 
      icon: ShieldCheck, 
      color: "bg-blue-500", 
      count: documents.filter(d => d.doc_type === 'legal').length 
    },
    { 
      id: "hr", 
      label: "HR & Staffing", 
      icon: Users, 
      color: "bg-emerald-500", 
      count: documents.filter(d => d.doc_type === 'hr').length 
    },
    { 
      id: "finance", 
      label: "Financials", 
      icon: CreditCard, 
      color: "bg-amber-500", 
      count: documents.filter(d => d.doc_type === 'finance').length 
    },
    { 
      id: "template", 
      label: "Company Templates", 
      icon: FileCode, 
      color: "bg-indigo-500", 
      count: documents.filter(d => d.doc_type === 'template').length 
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onFolderClick(folder.id)}
          className="group relative bg-white dark:bg-[#071F15] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all text-left overflow-hidden"
        >
          {/* Background Accent */}
          <div className={`absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full ${folder.color} opacity-5 group-hover:scale-150 transition-transform duration-500`} />
          
          <div className="relative z-10 flex flex-col h-full space-y-4">
            <div className={`h-12 w-12 rounded-2xl ${folder.color} bg-opacity-10 flex items-center justify-center text-white`}>
              <div className={`h-12 w-12 rounded-2xl ${folder.color} flex items-center justify-center shadow-lg shadow-primary/20`}>
                 <folder.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-plus-jakarta">{folder.label}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {folder.count} {folder.count === 1 ? 'document' : 'documents'}
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
              <span>View Folder</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
