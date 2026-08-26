import { Suspense } from 'react';
import { ImportForm } from './form';

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportForm />
    </Suspense>
  );
}
