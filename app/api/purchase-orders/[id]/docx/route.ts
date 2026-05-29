import { NextRequest } from 'next/server'
import { generatePurchaseOrderDocx } from '@/lib/docx/generator'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    
    let buffer: Buffer
    const supabase = await createClient()

    // Check if an edited version exists
    const { data: artifact } = await supabase
      .from('purchase_order_artifacts')
      .select('storage_path')
      .eq('po_id', id)
      .eq('artifact_type', 'docx')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (artifact?.storage_path) {
      // Download from storage
      const { data: fileData, error } = await supabase.storage
        .from('po-artifacts')
        .download(artifact.storage_path)
      
      if (error || !fileData) {
        throw new Error('Failed to download stored DOCX')
      }
      buffer = Buffer.from(await fileData.arrayBuffer())
    } else {
      // Generate fresh
      buffer = await generatePurchaseOrderDocx(id)
    }

    const filename = `PO_${id.split('-')[0].toUpperCase()}.docx`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (error: any) {
    console.error('PO DOCX generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate DOCX' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
