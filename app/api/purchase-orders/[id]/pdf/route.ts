import { NextRequest } from 'next/server'
import { fetchPoData } from '@/lib/pdf/fetchPoData'
import { createPoDocument } from '@/lib/pdf/generator'
import { getCurrentProfile } from '@/lib/auth/permissions'

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
  } catch (error: any) {
    console.error('PO PDF generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
