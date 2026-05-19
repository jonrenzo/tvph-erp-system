'use server'

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';

type ActionState = { error?: string; success?: string } | null;

const COMMERCIAL_ROLES = new Set(['admin', 'commercial_manager']);

async function requireCommercialRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: 'Unauthorized' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || !COMMERCIAL_ROLES.has(profile.role)) {
    return { supabase, user: profile, error: 'Only Admin or Commercial Manager can modify customer records.' };
  }

  return { supabase, user: profile, error: null };
}

export async function createAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const company_name = (formData.get('company_name') as string)?.trim();
  const company_type = (formData.get('company_type') as string) || 'prospect';
  const primary_site_location = (formData.get('primary_site_location') as string)?.trim() || null;
  const industry_note = (formData.get('industry_note') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!company_name) {
    return { error: 'Company name is required.' };
  }

  const { data: account, error } = await supabase
    .from('crm_accounts')
    .insert({
      company_name,
      company_type,
      primary_site_location,
      industry_note,
      notes,
      created_by: user.id,
    })
    .select('id, company_name')
    .single();

  if (error || !account) {
    return { error: error?.message || 'Failed to create customer account.' };
  }

  await recordAuditLog({
    entity_type: 'crm_account',
    entity_id: account.id,
    action: 'CREATE',
    changes: { after: { company_name, company_type } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'crm',
    title: 'Customer Account Created',
    message: `${company_name} was added to customer accounts.`,
    link: '/dashboard/crm',
    created_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath('/dashboard/crm/new');
  return { success: `Customer created: ${company_name}` };
}

export async function createContact(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const account_id = formData.get('account_id') as string;
  const full_name = (formData.get('full_name') as string)?.trim();
  const job_title = (formData.get('job_title') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const is_primary = (formData.get('is_primary') as string) === 'on';

  if (!account_id) return { error: 'Select a customer account first.' };
  if (!full_name) return { error: 'Contact full name is required.' };

  if (is_primary) {
    await supabase
      .from('crm_contacts')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('account_id', account_id)
      .eq('is_primary', true);
  }

  const { data: contact, error } = await supabase
    .from('crm_contacts')
    .insert({
      account_id,
      full_name,
      job_title,
      email,
      phone,
      notes,
      is_primary,
      created_by: user.id,
    })
    .select('id, full_name')
    .single();

  if (error || !contact) {
    return { error: error?.message || 'Failed to create contact.' };
  }

  await recordAuditLog({
    entity_type: 'crm_contact',
    entity_id: contact.id,
    action: 'CREATE',
    changes: { after: { account_id, full_name, email } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/crm/new');
  revalidatePath('/dashboard/crm');
  return { success: `Contact created: ${full_name}` };
}

export async function createOpportunity(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const account_id = formData.get('account_id') as string;
  const contact_id = (formData.get('contact_id') as string) || null;
  const owner_id = (formData.get('owner_id') as string) || user.id;
  const title = (formData.get('title') as string)?.trim();
  const job_type = formData.get('job_type') as string;
  const stage = (formData.get('stage') as string) || 'prospect';
  const location = (formData.get('location') as string)?.trim() || null;
  const estimated_contract_value_raw = formData.get('estimated_contract_value') as string;
  const estimated_copper_volume_raw = formData.get('estimated_copper_volume') as string;
  const expected_start_date = (formData.get('expected_start_date') as string) || null;
  const expected_close_date = (formData.get('expected_close_date') as string) || null;
  const access_requirements = (formData.get('access_requirements') as string)?.trim() || null;
  const safety_requirements = (formData.get('safety_requirements') as string)?.trim() || null;
  const permit_requirements = (formData.get('permit_requirements') as string)?.trim() || null;
  const next_follow_up_date = (formData.get('next_follow_up_date') as string) || null;
  const source = (formData.get('source') as string)?.trim() || null;

  if (!account_id) return { error: 'Customer account is required.' };
  if (!title) return { error: 'Customer project title is required.' };
  if (!job_type) return { error: 'Job type is required.' };

  const estimated_contract_value = estimated_contract_value_raw
    ? Number(estimated_contract_value_raw)
    : null;
  const estimated_copper_volume = estimated_copper_volume_raw
    ? Number(estimated_copper_volume_raw)
    : null;

  const { data: opportunity, error } = await supabase
    .from('crm_opportunities')
    .insert({
      account_id,
      contact_id,
      owner_id,
      title,
      job_type,
      stage,
      status: 'open',
      location,
      estimated_contract_value,
      estimated_copper_volume,
      expected_start_date,
      expected_close_date,
      access_requirements,
      safety_requirements,
      permit_requirements,
      next_follow_up_date,
      source,
      created_by: user.id,
    })
    .select('id, title')
    .single();

  if (error || !opportunity) {
    return { error: error?.message || 'Failed to create customer project.' };
  }

  await recordAuditLog({
    entity_type: 'crm_opportunity',
    entity_id: opportunity.id,
    action: 'CREATE',
    changes: {
      after: {
        title,
        account_id,
        stage,
        estimated_contract_value,
      },
    },
    performed_by: user.id,
  });

  await createNotification({
    type: 'crm',
    title: 'New Customer Project',
    message: `${title} has been added to customer project tracking.`,
    link: `/dashboard/crm/${opportunity.id}`,
    created_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath('/dashboard/crm/new');
  redirect(`/dashboard/crm/${opportunity.id}`);
}

export async function updateOpportunityStage(opportunityId: string, stage: string) {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  let status: 'open' | 'won' | 'lost' = 'open';
  if (['approved', 'ongoing', 'completed'].includes(stage)) status = 'won';
  if (stage === 'lost_cancelled') status = 'lost';

  const { error } = await supabase
    .from('crm_opportunities')
    .update({
      stage,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opportunityId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'crm_opportunity',
    entity_id: opportunityId,
    action: 'UPDATE',
    changes: { after: { stage, status } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath(`/dashboard/crm/${opportunityId}`);
  return { success: true };
}

export async function markOpportunityAsLost(opportunityId: string, lostReason: string) {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const { error } = await supabase
    .from('crm_opportunities')
    .update({
      stage: 'lost_cancelled',
      status: 'lost',
      lost_reason: lostReason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opportunityId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'crm_opportunity',
    entity_id: opportunityId,
    action: 'UPDATE',
    changes: { after: { stage: 'lost_cancelled', status: 'lost', lost_reason: lostReason || null } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath(`/dashboard/crm/${opportunityId}`);
  return { success: true };
}

export async function addOpportunityActivity(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const opportunity_id = formData.get('opportunity_id') as string;
  const activity_type = (formData.get('activity_type') as string) || 'note';
  const subject = (formData.get('subject') as string)?.trim();
  const details = (formData.get('details') as string)?.trim() || null;
  const due_date = (formData.get('due_date') as string) || null;

  if (!opportunity_id) return { error: 'Missing customer project id.' };
  if (!subject) return { error: 'Activity subject is required.' };

  const { data: activity, error } = await supabase
    .from('crm_activities')
    .insert({
      opportunity_id,
      activity_type,
      subject,
      details,
      due_date,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !activity) return { error: error?.message || 'Failed to add activity.' };

  if (due_date) {
    await supabase
      .from('crm_opportunities')
      .update({
        next_follow_up_date: due_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunity_id);
  }

  await recordAuditLog({
    entity_type: 'crm_activity',
    entity_id: activity.id,
    action: 'CREATE',
    changes: { after: { opportunity_id, activity_type, subject, due_date } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/crm/${opportunity_id}`);
  return { success: 'Activity logged.' };
}

export async function addOpportunityActivityFromForm(formData: FormData) {
  await addOpportunityActivity(null, formData);
}

export async function convertOpportunityToProject(opportunityId: string) {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const { data: opportunity, error: fetchError } = await supabase
    .from('crm_opportunities')
    .select(`
      id,
      title,
      status,
      converted_project_id,
      crm_accounts(company_name)
    `)
    .eq('id', opportunityId)
    .single();

  if (fetchError || !opportunity) return { error: 'Customer project not found.' };
  if (opportunity.converted_project_id) {
    return redirect(`/dashboard/projects/${opportunity.converted_project_id}`);
  }

  const accountName = (opportunity.crm_accounts as { company_name?: string } | null)?.company_name || 'Customer';
  const projectName = `${accountName} - ${opportunity.title}`;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: projectName,
      description: `Started from customer project: ${opportunity.title}`,
      status: 'active',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (projectError || !project) {
    return { error: projectError?.message || 'Failed to create project record.' };
  }

  await supabase
    .from('crm_opportunities')
    .update({
      converted_project_id: project.id,
      stage: 'ongoing',
      status: 'won',
      updated_at: new Date().toISOString(),
    })
    .eq('id', opportunityId);

  await recordAuditLog({
    entity_type: 'crm_opportunity',
    entity_id: opportunityId,
    action: 'UPDATE',
    changes: { after: { converted_project_id: project.id, status: 'won', stage: 'ongoing' } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'crm',
    title: 'Customer Project Started',
    message: `${opportunity.title} now has an active project record.`,
    link: `/dashboard/projects/${project.id}`,
    created_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath(`/dashboard/crm/${opportunityId}`);
  revalidatePath('/dashboard/projects');
  redirect(`/dashboard/projects/${project.id}`);
}
