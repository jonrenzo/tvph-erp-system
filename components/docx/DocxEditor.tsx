'use client'

import React, { useState, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { SuperDocRef } from '@superdoc-dev/react'

if (typeof window !== 'undefined') {
  ;(window as any).__VUE_OPTIONS_API__ = true
  ;(window as any).__VUE_PROD_DEVTOOLS__ = false
  ;(window as any).__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false
}

// Dynamically import SuperDocEditor
const SuperDocEditor = dynamic(
  () => import('@superdoc-dev/react').then((mod) => mod.SuperDocEditor),
  { ssr: false, loading: () => <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div> }
)
import '@superdoc-dev/react/style.css'

interface DocxEditorProps {
  initialBuffer: ArrayBuffer
  poId: string
}

export function DocxEditor({ initialBuffer, poId }: DocxEditorProps) {
  const router = useRouter()
  const editorRef = useRef<SuperDocRef>(null)
  const [isSaving, setIsSaving] = useState(false)

  // SuperDoc requires a string (URL), File, or Blob, not an ArrayBuffer
  const documentBlob = useMemo(() => {
    return new Blob([initialBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    })
  }, [initialBuffer])

  const handleSave = async () => {
    if (!editorRef.current) return
    setIsSaving(true)
    
    try {
      const instance = editorRef.current.getInstance()
      if (!instance) throw new Error("Editor not initialized")

      const blob: Blob = await instance.export({ isFinalDoc: true })
      const bufferToSave = await blob.arrayBuffer()

      const response = await fetch(`/api/purchase-orders/${poId}/save-docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: bufferToSave,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save document')
      }

      toast.success('Document saved successfully')
      router.push(`/dashboard/purchase-orders/${poId}`)
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#0a0a0a]">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071F15]">
        <div className="flex items-center gap-2">
          <button 
            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 text-slate-900 rounded-md dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 dark:text-slate-50"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white ml-4">Edit Purchase Order</h2>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-600/90 shadow rounded-md dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-600/90"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </button>
      </div>
      {/* SuperDoc Toolbar Mount Point */}
      <div id="superdoc-toolbar-container" className="w-full bg-white border-b border-slate-200 dark:bg-[#0a0a0a] dark:border-slate-800 z-10 shrink-0 empty:hidden"></div>
      
      <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-100 dark:bg-black">
        <SuperDocEditor
          ref={editorRef}
          document={documentBlob}
          documentMode="editing"
          contained={true}
          modules={{ comments: false }}
          toolbar="#superdoc-toolbar-container"
          className="w-full h-full shadow-2xl bg-white ring-1 ring-slate-200 dark:ring-slate-800"
        />
      </div>
    </div>
  )
}
