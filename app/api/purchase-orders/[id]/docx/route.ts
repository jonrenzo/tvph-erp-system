import { NextRequest } from 'next/server'
import { resolvePoDocx } from '@/lib/docx/resolvePoDocx'
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
    const { buffer, filename } = await resolvePoDocx(id)

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
