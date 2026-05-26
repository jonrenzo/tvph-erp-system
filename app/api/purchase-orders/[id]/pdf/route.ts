import { NextRequest } from 'next/server'
import { fetchPoData } from '@/lib/pdf/fetchPoData'
import { createPoDocument } from '@/lib/pdf/generator'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const poData = await fetchPoData(id)

    if (!poData) {
      return new Response('Purchase order not found', { status: 404 })
    }

    const buffer = await createPoDocument(poData)
    const filename = `${poData.po_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (error) {
    console.error('PO PDF generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
