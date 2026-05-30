import { redirect } from 'next/navigation'
import { DocxEditor } from '@/components/docx/DocxEditor'
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { Suspense } from 'react'

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: '0' } }],
}

function EditorSkeleton() {
  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-4 w-96 bg-muted rounded" />
      <div className="h-[600px] bg-muted rounded" />
    </div>
  )
}

export default function PurchaseOrderEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorContent paramsPromise={params} />
    </Suspense>
  )
}

async function EditorContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>
}) {
  const { id } = await paramsPromise
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('id', id)
    .single()

  if (!po) {
    redirect('/dashboard/purchase-orders')
  }

  const headersList = await headers()
  const cookieHeader = headersList.get('cookie') || ''

  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const host = headersList.get('host') || 'localhost:3000'
  const apiUrl = `${protocol}://${host}/api/purchase-orders/${id}/docx`

  const response = await fetch(apiUrl, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Failed to load document for editing')
  }

  const arrayBuffer = await response.arrayBuffer()

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 space-y-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Document Editor</h1>
        <p className="text-muted-foreground">
          Make manual adjustments to the generated Purchase Order document before finalizing.
        </p>
      </div>

      <DocxEditor initialBuffer={arrayBuffer} poId={id} />
    </div>
  )
}
