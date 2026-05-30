import { NextRequest } from 'next/server';
import { generatePurchaseOrderDocx } from '@/lib/docx/generator';
import { createClient } from '@/utils/supabase/server';
import PizZip from 'pizzip';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: po } = await supabase.from('purchase_orders').select('id').limit(1).single();
    
    if (!po) return new Response('No PO found', { status: 404 });
    
    const buffer = await generatePurchaseOrderDocx(po.id);
    
    const zip = new PizZip(buffer);
    const xml = zip.file("word/document.xml")!.asText();
    const stripped = xml.replace(/<[^>]+>/g, "");
    const remainingTags = stripped.match(/\{[^{}]+\}/g);
    
    if (remainingTags && remainingTags.length > 0) {
      return new Response('FAILED! Remaining tags found: ' + JSON.stringify(remainingTags));
    }
    
    return new Response('SUCCESS! No placeholder tags remain.', { status: 200 });
  } catch (err: any) {
    return new Response(err.stack, { status: 500 });
  }
}
