import { Suspense } from 'react';
import { NewClientInvoiceForm } from './form';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { client_po_id: null, account_id: null } }],
};

export default function NewClientInvoicePage(props: {
  searchParams?: Promise<{ client_po_id?: string; account_id?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <NewClientInvoiceForm searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}
