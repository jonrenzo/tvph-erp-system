import { NewClientInvoiceForm } from './form';

export default async function NewClientInvoicePage(props: {
  searchParams?: Promise<{ account_id?: string }>;
}) {
  const sp = await props.searchParams;
  return <NewClientInvoiceForm initialAccountId={sp?.account_id} />;
}
