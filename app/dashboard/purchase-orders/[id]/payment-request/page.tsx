import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { SendPaymentRequestPanel } from "@/components/dashboard/purchase-orders/send-payment-request-panel";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { id: "sample-id" } }],
};

export default function SendPaymentRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <SendPaymentRequestContent paramsPromise={props.params} />
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

  return (
    <SendPaymentRequestPanel
      poId={po.id}
      poNumber={po.po_number}
      poAmount={Number(po.amount)}
      vendorId={po.vendor_id}
      vendorName={po.vendors?.name || "Unknown Vendor"}
      vendorDocuments={vendorDocs || []}
      approvedCerts={approvedCerts}
      userRole={currentRole || ""}
    />
  );
}
