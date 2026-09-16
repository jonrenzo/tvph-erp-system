import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { SendPaymentRequestPanel } from "@/components/dashboard/purchase-orders/send-payment-request-panel";

export default function SendPaymentRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<SendPaymentRequestSkeleton />}>
      <SendPaymentRequestContent paramsPromise={props.params} />
    </Suspense>
  );
}

function SendPaymentRequestSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="h-64 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

async function SendPaymentRequestContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [{ data: po, error }, { user: currentUser, role: currentRole }] =
    await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          `
          *,
          vendors (
            id, name, contact_person, contact_email
          )
        `,
        )
        .eq("id", params.id)
        .single(),
      getCurrentProfile(supabase),
    ]);

  if (error || !po) notFound();

  const canCreate = hasCapability(currentRole, "payment_request.create");
  if (!canCreate) redirect(`/dashboard/purchase-orders/${params.id}`);

  // active PR check — if pending/approved exists, panel will show blocked state but allow viewing
  const { data: vendorDocs } = await supabase
    .from("vendor_documents")
    .select("*")
    .eq("vendor_id", po.vendor_id)
    .is("archived_at", null)
    .order("doc_type");

  const { data: certs } = await supabase
    .from("po_completion_certificates")
    .select("id, percent_complete, status")
    .eq("po_id", po.id)
    .order("submitted_at", { ascending: false });

  const approvedCerts = (certs || [])
    .filter((c) => c.status === "approved")
    .map((c) => ({
      id: c.id,
      percent_complete: Number(c.percent_complete),
    }));

  const { data: invsForBalance } = await supabase.from("service_invoices").select("id").eq("po_id", po.id).is("deleted_at", null);
  const invoiceIds = (invsForBalance || []).map((i: any) => i.id);
  let totalPaid = 0;
  if (invoiceIds.length > 0) {
    const { data: pays } = await supabase.from("payments").select("amount_paid").in("invoice_id", invoiceIds);
    totalPaid = (pays || []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
  }
  const poRemaining = Math.max(0, Number(po.amount) - Number(po.dp_amount || 0) - totalPaid);

  return (
    <SendPaymentRequestPanel
      poId={po.id}
      poNumber={po.po_number}
      poAmount={Number(po.amount)}
      poDpAmount={Number(po.dp_amount || 0)}
      vendorId={po.vendor_id}
      vendorName={po.vendors?.name || "Unknown Vendor"}
      vendorDocuments={vendorDocs || []}
      approvedCerts={approvedCerts}
      userRole={currentRole || ""}
      poSource={(po as { source?: string }).source || "erp"}
      poRemaining={poRemaining}
    />
  );
}
