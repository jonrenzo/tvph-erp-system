'use server'

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';

type ActionState = { error?: string; success?: string } | null;

type CustomerContactInput = {
  id?: string;
  full_name?: string;
  job_title?: string;
  email?: string;
  phone?: string;
  fax?: string;
  notes?: string;
  is_primary?: boolean;
};

const COMMERCIAL_ROLES = new Set(['admin', 'commercial_manager']);
const CUSTOMER_STATUSES = new Set(['pending', 'active', 'inactive']);

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

function normalizeCustomerContacts(rawContacts: CustomerContactInput[]) {
  const normalized = rawContacts
    .map((contact) => ({
      id: contact.id || undefined,
      full_name: (contact.full_name || '').trim(),
      job_title: (contact.job_title || '').trim(),
      email: (contact.email || '').trim(),
      phone: (contact.phone || '').trim(),
      fax: (contact.fax || '').trim(),
      notes: (contact.notes || '').trim(),
      is_primary: Boolean(contact.is_primary),
    }))
    .filter(
      (contact) =>
        contact.full_name ||
        contact.email ||
        contact.phone ||
        contact.fax ||
        contact.job_title ||
        contact.notes,
    );

  if (normalized.length === 0) {
    return normalized;
  }

  let primaryFound = false;
  const withPrimary = normalized.map((contact, index) => {
    if (contact.is_primary && !primaryFound) {
      primaryFound = true;
      return contact;
    }
    return { ...contact, is_primary: false };
  });

  if (!primaryFound) {
    withPrimary[0] = { ...withPrimary[0], is_primary: true };
  }

  return withPrimary;
}

function parseCustomerContacts(formData: FormData) {
  let contacts: CustomerContactInput[] = [];
  const rawJson = (formData.get('customer_contacts') as string) || '[]';

  try {
    contacts = JSON.parse(rawJson);
  } catch (_error) {
    contacts = [];
  }

  // Backward-compatible fallback if contact JSON is missing.
  if (contacts.length === 0) {
    const full_name = (formData.get('contact_person') as string)?.trim() || '';
    const job_title = (formData.get('job_title') as string)?.trim() || '';
    const email = (formData.get('contact_email') as string)?.trim() || '';
    const phone = (formData.get('contact_phone') as string)?.trim() || '';
    const fax = (formData.get('contact_fax') as string)?.trim() || '';
    if (full_name || email || phone || fax || job_title) {
      contacts = [{ full_name, job_title, email, phone, fax, is_primary: true }];
    }
  }

  return normalizeCustomerContacts(contacts);
}

export async function createCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const company_name = (formData.get('company_name') as string)?.trim();
  const registered_address = (formData.get('registered_address') as string)?.trim() || null;
  const tin = (formData.get('tin') as string)?.trim() || null;
  const statusRaw = ((formData.get('status') as string) || 'pending').trim().toLowerCase();
  const status = CUSTOMER_STATUSES.has(statusRaw) ? statusRaw : 'pending';
  const notes = (formData.get('notes') as string)?.trim() || null;
  const contacts = parseCustomerContacts(formData);

  if (!company_name) {
    return { error: 'Customer name is required.' };
  }
  if (contacts.length === 0) {
    return { error: 'At least one customer contact is required.' };
  }

  const company_type =
    status === 'active' ? 'active_customer' : status === 'inactive' ? 'inactive_customer' : 'prospect';

  const { data: account, error: accountError } = await supabase
    .from('crm_accounts')
    .insert({
      company_name,
      registered_address,
      tin,
      status,
      company_type,
      notes,
      created_by: user.id,
    })
    .select('id, company_name')
    .single();

  if (accountError || !account) {
    return { error: accountError?.message || 'Failed to create customer account.' };
  }

  const contactRows = contacts.map((contact) => ({
    account_id: account.id,
    full_name: contact.full_name,
    job_title: contact.job_title || null,
    email: contact.email || null,
    phone: contact.phone || null,
    fax: contact.fax || null,
    notes: contact.notes || null,
    is_primary: contact.is_primary,
    created_by: user.id,
  }));

  const { error: contactError } = await supabase.from('crm_contacts').insert(contactRows);

  if (contactError) {
    await supabase.from('crm_accounts').update({ deleted_at: new Date().toISOString() }).eq('id', account.id);
    return { error: contactError.message || 'Failed to create customer contacts.' };
  }

  await recordAuditLog({
    entity_type: 'crm_account',
    entity_id: account.id,
    action: 'CREATE',
    changes: { after: { company_name, status, tin } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'crm',
    title: 'Customer Added',
    message: `${company_name} was added to customers.`,
    link: `/dashboard/crm/${account.id}`,
    created_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath('/dashboard/crm/new');
  redirect(`/dashboard/crm/${account.id}`);
}

export async function updateCustomerProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'Customer ID is required.' };

  const company_name = (formData.get('company_name') as string)?.trim();
  const registered_address = (formData.get('registered_address') as string)?.trim() || null;
  const tin = (formData.get('tin') as string)?.trim() || null;
  const statusRaw = ((formData.get('status') as string) || 'pending').trim().toLowerCase();
  const status = CUSTOMER_STATUSES.has(statusRaw) ? statusRaw : 'pending';
  const notes = (formData.get('notes') as string)?.trim() || null;
  const contacts = parseCustomerContacts(formData);

  if (!company_name) {
    return { error: 'Customer name is required.' };
  }
  if (contacts.length === 0) {
    return { error: 'At least one customer contact is required.' };
  }

  const company_type =
    status === 'active' ? 'active_customer' : status === 'inactive' ? 'inactive_customer' : 'prospect';

  const { error: accountError } = await supabase
    .from('crm_accounts')
    .update({
      company_name,
      registered_address,
      tin,
      status,
      company_type,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (accountError) {
    return { error: accountError.message || 'Failed to update customer profile.' };
  }

  const { data: existingContacts } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('account_id', id);

  const existingIds = new Set((existingContacts || []).map((contact) => contact.id));
  const keptIds = new Set<string>();

  for (const contact of contacts) {
    const payload = {
      account_id: id,
      full_name: contact.full_name,
      job_title: contact.job_title || null,
      email: contact.email || null,
      phone: contact.phone || null,
      fax: contact.fax || null,
      notes: contact.notes || null,
      is_primary: contact.is_primary,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (contact.id && existingIds.has(contact.id)) {
      keptIds.add(contact.id);
      const { error: updateContactError } = await supabase.from('crm_contacts').update(payload).eq('id', contact.id);
      if (updateContactError) {
        return { error: updateContactError.message || 'Failed to update customer contacts.' };
      }
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('crm_contacts')
      .insert({ ...payload, created_by: user.id })
      .select('id')
      .single();

    if (insertError) {
      return { error: insertError.message || 'Failed to update customer contacts.' };
    }

    if (inserted?.id) {
      keptIds.add(inserted.id);
    }
  }

  for (const existingId of existingIds) {
    if (!keptIds.has(existingId)) {
      const { error: archiveContactError } = await supabase
        .from('crm_contacts')
        .update({
          is_primary: false,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);
      if (archiveContactError) {
        return { error: archiveContactError.message || 'Failed to update removed contacts.' };
      }
    }
  }

  await recordAuditLog({
    entity_type: 'crm_account',
    entity_id: id,
    action: 'UPDATE',
    changes: { after: { company_name, status, tin } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath(`/dashboard/crm/${id}`);
  return { success: 'Customer profile updated.' };
}

export async function updateCustomerStatus(customerId: string, status: string) {
  const { supabase, user, error: roleError } = await requireCommercialRole();
  if (roleError || !user) return { error: roleError || 'Unauthorized' };

  const statusValue = status.trim().toLowerCase();
  if (!CUSTOMER_STATUSES.has(statusValue)) {
    return { error: 'Invalid customer status.' };
  }

  const company_type =
    statusValue === 'active' ? 'active_customer' : statusValue === 'inactive' ? 'inactive_customer' : 'prospect';

  const { error } = await supabase
    .from('crm_accounts')
    .update({
      status: statusValue,
      company_type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'crm_account',
    entity_id: customerId,
    action: 'UPDATE',
    changes: { after: { status: statusValue } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath(`/dashboard/crm/${customerId}`);
  return { success: true };
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
    link: `/dashboard/crm/projects/${opportunity.id}`,
    created_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  revalidatePath('/dashboard/crm/projects/new');
  revalidatePath(`/dashboard/crm/${account_id}`);
  redirect(`/dashboard/crm/projects/${opportunity.id}`);
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
  revalidatePath(`/dashboard/crm/projects/${opportunityId}`);
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
  revalidatePath(`/dashboard/crm/projects/${opportunityId}`);
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

  revalidatePath(`/dashboard/crm/projects/${opportunity_id}`);
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
  revalidatePath(`/dashboard/crm/projects/${opportunityId}`);
  revalidatePath('/dashboard/projects');
  redirect(`/dashboard/projects/${project.id}`);
}

export async function uploadCustomerDocument(customerId: string, docType: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const fileExt = file.name.split('.').pop();
  const fileName = `${docType}_${Date.now()}.${fileExt}`;
  const filePath = `customers/${customerId}/${docType}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('crm-documents')
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('crm-documents')
    .getPublicUrl(filePath);

  const { error: dbError } = await supabase
    .from('crm_documents')
    .upsert({
      account_id: customerId,
      doc_type: docType,
      file_url: publicUrl,
      file_name: file.name,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'account_id,doc_type' });

  if (dbError) return { error: dbError.message };

  await recordAuditLog({
    entity_type: 'crm_document',
    entity_id: customerId,
    action: 'UPDATE',
    changes: { after: { doc_type: docType, status: 'submitted' } },
    performed_by: user.id
  });

  await createNotification({
    type: 'crm',
    title: 'Customer Document Added',
    message: `A document was uploaded for a customer.`,
    link: `/dashboard/crm/${customerId}`,
    created_by: user.id
  });

  revalidatePath(`/dashboard/crm/${customerId}`);
  return { success: true };
}

export async function approveCustomerDocument(customerId: string, docType: string, expiryDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Only admins can approve documents.' };
  }

  if (!expiryDate) {
    return { error: 'An expiry date is required when approving a document.' };
  }

  const { error } = await supabase
    .from('crm_documents')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      expiry_date: expiryDate,
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('account_id', customerId)
    .eq('doc_type', docType)
    .is('archived_at', null);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'crm_document',
    entity_id: customerId,
    action: 'UPDATE',
    changes: { after: { doc_type: docType, status: 'approved', expiry_date: expiryDate } },
    performed_by: user.id
  });

  revalidatePath(`/dashboard/crm/${customerId}`);
  return { success: true };
}
