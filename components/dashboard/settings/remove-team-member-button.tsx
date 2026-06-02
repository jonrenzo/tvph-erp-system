'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { removeTeamMember } from '@/app/dashboard/settings/actions'

export function RemoveTeamMemberButton({ userId, userName }: { userId: string; userName: string }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeTeamMember(userId)
      if (result.error) {
        setError(result.error)
      } else {
        setShowConfirm(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-red-500 hover:text-red-400 text-xs font-bold"
      >
        Revoke Access
      </button>

      {showConfirm && mounted && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => { setShowConfirm(false); setError(null) }}
        >
          <div
            className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md mx-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Remove Team Member</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-slate-300">{userName}</span>? They will lose all access to the system. This action cannot be undone.
                </p>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </div>
              <button
                onClick={() => { setShowConfirm(false); setError(null) }}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowConfirm(false); setError(null) }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
