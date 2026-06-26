'use client'

import React, { useState, useRef } from 'react'
import { DocxEditor as EigenpalEditor, type DocxEditorRef } from '@eigenpal/docx-editor-react'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface DocxEditorProps {
  initialBuffer: ArrayBuffer
  poId: string
}

export function DocxEditor({ initialBuffer, poId }: DocxEditorProps) {
  const router = useRouter()
  const editorRef = useRef<DocxEditorRef>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (!editorRef.current) throw new Error("Editor not ready")
      
      // Request the latest edited buffer from the editor
      const editedBuffer = await editorRef.current.save()

      const response = await fetch(`/api/purchase-orders/${poId}/save-docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: editedBuffer,
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
    <div className="relative z-[var(--z-editor)] flex flex-col h-[calc(100vh-6rem)] w-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#0a0a0a]">
      {/* Custom Toolbar / Header */}
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
      
      {/* The Eigenpal Editor Instance */}
      <div className="flex-1 w-full relative overflow-hidden bg-slate-100 dark:bg-black">
        <EigenpalEditor 
          ref={editorRef}
          documentBuffer={initialBuffer}
        />
      </div>
    </div>
  )
}
