import { redirect } from "next/navigation";

export default async function SendPaymentRequestPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Invoice-driven workflow: redirect to Record Invoice
  redirect(`/dashboard/invoices/new?poId=${params.id}`);
}
