import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generatePoDocument } from '@/lib/pdf/generate-po';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(
      `*,
      vendors (*),
      projects (*)`,
    )
    .eq('id', id)
    .single();

  if (error || !po) {
    return new Response('Purchase order not found', { status: 404 });
  }

  const pdfBytes = await generatePoDocument(
    po,
    po.vendors,
    po.projects,
  );

  const filename = `${po.po_number}.pdf`;

  return new Response(pdfBytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
