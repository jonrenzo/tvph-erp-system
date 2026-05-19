import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generatePoDocument } from '@/lib/pdf/generate-po';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const editable = searchParams.get('editable') === 'true';

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

  // Fetch line items
  const { data: lineItems } = await supabase
    .from('po_line_items')
    .select('*')
    .eq('po_id', id)
    .order('line_no');

  // Fetch site details
  const { data: siteDetails } = await supabase
    .from('po_site_details')
    .select('*')
    .eq('po_id', id)
    .order('sn');

  const pdfBytes = await generatePoDocument(
    po,
    po.vendors,
    po.projects,
    lineItems || [],
    siteDetails || [],
    { editable }
  );

  const filename = `${po.po_number}${editable ? '_editable' : ''}.pdf`;

  return new Response(pdfBytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
