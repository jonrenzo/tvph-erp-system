import { redirect } from 'next/navigation'
import { DocxEditor } from '@/components/docx/DocxEditor'
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

// Force Turbopack rebuild
export default async function PurchaseOrderEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify the PO exists
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('id', id)
    .single()

  if (!po) {
    redirect('/dashboard/purchase-orders')
  }

  // Fetch the DOCX arraybuffer from our internal API route
  // We need to pass cookies so the API route can authenticate
  const headersList = await headers()
  const cookieHeader = headersList.get('cookie') || ''
  
  // Construct the absolute URL
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const host = headersList.get('host') || 'localhost:3000'
  const apiUrl = `${protocol}://${host}/api/purchase-orders/${id}/docx`

  const response = await fetch(apiUrl, {
    headers: {
      cookie: cookieHeader
    },
    // Don't cache this request as the document might have been edited
    cache: 'no-store'
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
