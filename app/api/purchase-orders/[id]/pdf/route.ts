import { NextRequest } from 'next/server'
import { renderPoDocument } from '@/lib/pdf/renderPoDocument'
import { getCurrentProfile } from '@/lib/auth/permissions'
import { getStorageProvider } from '@/lib/storage'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: authError } = await getCurrentProfile()
    if (authError) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params

    const { createServiceRoleClient } = await import('@/utils/supabase/service')

    const supabase = createServiceRoleClient()
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('signed_doc_status, po_number')
      .eq('id', id)
      .single()

    if (po?.signed_doc_status === 'approved') {
      const { data: signature } = await supabase
        .from('po_signatures')
        .select('signed_file_url')
        .eq('po_id', id)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (signature?.signed_file_url) {
        const marker = '/object/public/po-artifacts/'
        let path: string | null = null
        if (signature.signed_file_url.includes(marker)) path = signature.signed_file_url.split(marker)[1] || null
        else if (signature.signed_file_url.includes('sharepoint.com') || signature.signed_file_url.includes('graph.microsoft.com')) path = null
        else path = signature.signed_file_url
        if (path) {
          const poStorage = getStorageProvider(supabase as any, 'po-artifacts')
          const { data: file, error: downloadError } = await poStorage.download(path)
          if (!downloadError && file) {
            const buffer = Buffer.from(await file.arrayBuffer())
            return new Response(buffer as unknown as BodyInit, {
              status: 200,
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="signed-po-${id}.pdf"`,
                'Content-Length': String(buffer.byteLength),
                'Cache-Control': 'no-store',
              },
            })
          }
        }
      }
    }

    // Imported/legacy POs store the real document as their issued_pdf artifact;
    // serve it instead of regenerating an empty skeleton.
    const { data: artifact } = await supabase
      .from('purchase_order_artifacts')
      .select('storage_path')
      .eq('po_id', id)
      .eq('artifact_type', 'issued_pdf')
      .maybeSingle()

    if (artifact?.storage_path) {
      const poStorage2 = getStorageProvider(supabase as any, 'po-artifacts')
      const { data: file, error: downloadError } = await poStorage2.download(artifact.storage_path)
      if (!downloadError && file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        return new Response(buffer as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${po?.po_number || id}.pdf"`,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'no-store',
          },
        })
      }
    }

    const { buffer, filename } = await renderPoDocument(id)

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('PO PDF generation error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate PDF' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
