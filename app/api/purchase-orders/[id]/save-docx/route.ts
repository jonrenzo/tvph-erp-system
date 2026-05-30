import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { fixDocxBorders } from '@/lib/docx/fixBorders'
import { requireCapability } from '@/lib/auth/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Get the authenticated user
    const { user, error: authError } = await requireCapability('po.write', supabase)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: authError === 'Unauthorized' ? 401 : 403 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 2. Read the file buffer from request body
    const arrayBuffer = await request.arrayBuffer()
    const rawBuffer = Buffer.from(arrayBuffer)
    
    if (!rawBuffer || rawBuffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }

    // 2b. Post-process: strip table borders injected by the Eigenpal editor
    const buffer = fixDocxBorders(rawBuffer)

    // 3. Generate checksum and storage path
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex')
    const timestamp = Date.now()
    const storagePath = `purchase_orders/${id}/edited_${timestamp}.docx`

    // 4. Upload to Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('po-artifacts')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    // 5. Delete existing docx artifacts for this PO to keep it clean (optional but good practice)
    const { data: existingArtifacts } = await supabaseAdmin
      .from('purchase_order_artifacts')
      .select('storage_path')
      .eq('po_id', id)
      .eq('artifact_type', 'docx')

    if (existingArtifacts && existingArtifacts.length > 0) {
      const pathsToDelete = existingArtifacts.map(a => a.storage_path)
      await supabaseAdmin.storage.from('po-artifacts').remove(pathsToDelete)
      
      await supabaseAdmin
        .from('purchase_order_artifacts')
        .delete()
        .eq('po_id', id)
        .eq('artifact_type', 'docx')
    }

    // 6. Record in database
    const { error: dbError } = await supabaseAdmin
      .from('purchase_order_artifacts')
      .insert({
        po_id: id,
        artifact_type: 'docx',
        storage_bucket: 'po-artifacts',
        storage_path: storagePath,
        content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_size: buffer.length,
        checksum_sha256: checksumSha256,
        generated_by: user.id,
        is_immutable: false
      })

    if (dbError) {
      throw dbError
    }

    return NextResponse.json({ success: true, path: storagePath })
  } catch (error: any) {
    console.error('PO DOCX save error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save DOCX' },
      { status: 500 }
    )
  }
}
