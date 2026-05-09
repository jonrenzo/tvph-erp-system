import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ProjectDetailContent } from '@/components/dashboard/projects/project-detail-content';
import { Suspense } from 'react';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{
    params: { id: 'sample-project-id' }
  }]
};

export default function ProjectPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      <ProjectDetailLoader paramsPromise={props.params} />
    </Suspense>
  );
}

async function ProjectDetailLoader({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [{ data: project }, { data: pos }, { data: projectVendors }, { data: allVendors }] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('purchase_orders')
      .select('*, vendors(id, name, currency)')
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_vendors')
      .select('vendor_id, vendors(id, name, currency)')
      .eq('project_id', params.id),
    supabase
      .from('vendors')
      .select('id, name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name'),
  ]);

  if (!project) notFound();

  const linkedVendors = (projectVendors || []).map((pv: any) => pv.vendors).filter(Boolean);
  const linkedVendorIds = linkedVendors.map((v: any) => v.id);
  const availableVendors = (allVendors || []).filter((v: any) => !linkedVendorIds.includes(v.id));

  return (
    <ProjectDetailContent 
      project={project} 
      pos={pos || []} 
      linkedVendors={linkedVendors}
      availableVendors={availableVendors}
    />
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-10 w-full border-b border-slate-200 dark:border-slate-800" />
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
