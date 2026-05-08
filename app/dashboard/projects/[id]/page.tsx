import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { ProjectDetailContent } from '@/components/dashboard/projects/project-detail-content';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const [{ data: project }, { data: pos }] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        *,
        vendors (
          id,
          name
        )
      `)
      .eq('id', params.id)
      .single(),
    supabase
      .from('purchase_orders')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
  ]);

  if (!project) notFound();

  return <ProjectDetailContent project={project} pos={pos || []} />;
}
