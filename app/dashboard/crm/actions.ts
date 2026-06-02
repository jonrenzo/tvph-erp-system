'use server'

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
import { parseFile, buildColumnMap } from '@/utils/import-export';

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
  const notes = (formData.get('notes') as string)?.trim() || null;

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

  const { data: logicalDocs } = await supabase
    .from('crm_documents')
    .select('id, version_number')
    .eq('account_id', customerId)
    .eq('doc_type', docType)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const logicalDoc = logicalDocs?.[0] || null;

  if (!logicalDoc) {
    const { data: newDoc, error: insertError } = await supabase
      .from('crm_documents')
      .insert({
        account_id: customerId,
        doc_type: docType,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        uploaded_by: user.id,
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError || !newDoc) return { error: insertError?.message || 'Failed to create document' };

    const { data: version, error: versionError } = await supabase
      .from('crm_document_versions')
      .insert({
        document_id: newDoc.id,
        version_number: 1,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
        notes
      })
      .select('id')
      .single();

    if (versionError) return { error: versionError.message };

    await supabase
      .from('crm_documents')
      .update({
        current_version_id: version.id,
        file_url: publicUrl,
        file_name: file.name,
        version_number: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', newDoc.id);
  } else {
    const nextVersion = (logicalDoc.version_number || 0) + 1;

    const { data: version, error: versionError } = await supabase
      .from('crm_document_versions')
      .insert({
        document_id: logicalDoc.id,
        version_number: nextVersion,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
        notes
      })
      .select('id')
      .single();

    if (versionError) return { error: versionError.message };

    const { error: updateError } = await supabase
      .from('crm_documents')
      .update({
        current_version_id: version.id,
        file_url: publicUrl,
        file_name: file.name,
        version_number: nextVersion,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        uploaded_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', logicalDoc.id);

    if (updateError) return { error: updateError.message };
  }

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

export async function uploadDocumentVersion(documentId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };
  const notes = (formData.get('notes') as string)?.trim() || null;

  const { data: doc } = await supabase
    .from('crm_documents')
    .select('id, account_id, version_number, doc_type, label')
    .eq('id', documentId)
    .single();

  if (!doc) return { error: 'Document not found' };

  const docType = doc.doc_type === 'custom' ? 'custom' : doc.doc_type;
  const labelSlug = doc.label
    ? doc.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '').slice(0, 40)
    : docType;
  const fileExt = file.name.split('.').pop();
  const fileName = `${labelSlug}_${Date.now()}.${fileExt}`;
  const filePath = `customers/${doc.account_id}/${docType}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('crm-documents')
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('crm-documents')
    .getPublicUrl(filePath);

  const nextVersion = (doc.version_number || 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from('crm_document_versions')
    .insert({
      document_id: doc.id,
      version_number: nextVersion,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.id,
      notes
    })
    .select('id')
    .single();

  if (versionError) return { error: versionError.message };

  const { error: updateError } = await supabase
    .from('crm_documents')
    .update({
      current_version_id: version.id,
      file_url: publicUrl,
      file_name: file.name,
      version_number: nextVersion,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', doc.id);

  if (updateError) return { error: updateError.message };

  await recordAuditLog({
    entity_type: 'crm_document',
    entity_id: doc.id,
    action: 'UPDATE',
    changes: { after: { status: 'submitted', version: nextVersion } },
    performed_by: user.id
  });

  await createNotification({
    type: 'crm',
    title: 'Document Updated',
    message: doc.label
      ? `A new version of "${doc.label}" was uploaded.`
      : `A new document version was uploaded.`,
    link: `/dashboard/crm/${doc.account_id}`,
    created_by: user.id
  });

  revalidatePath(`/dashboard/crm/${doc.account_id}`);
  return { success: true };
}

export async function getDocumentVersions(documentId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('crm_documents')
    .select('id, current_version_id')
    .eq('id', documentId)
    .single();

  if (!doc) return { versions: [] };

  const { data: versions, error } = await supabase
    .from('crm_document_versions')
    .select(`
      id,
      version_number,
      file_name,
      file_size,
      file_type,
      notes,
      created_at,
      uploaded_by,
      profiles!uploaded_by(full_name, email)
    `)
    .eq('document_id', documentId)
    .order('version_number', { ascending: false });

  if (error) return { error: error.message };

  return {
    versions: (versions || []).map(v => ({
      ...v,
      is_current: v.id === doc.current_version_id
    }))
  };
}

export async function getVersionSignedUrl(versionId: string) {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from('crm_document_versions')
    .select('file_url')
    .eq('id', versionId)
    .single();

  if (!version) return { error: 'Version not found' };

  const path = version.file_url.split('/public/crm-documents/')[1];
  if (!path) return { url: version.file_url };

  const { data } = await supabase.storage
    .from('crm-documents')
    .createSignedUrl(path, 3600);

  return { url: data?.signedUrl || version.file_url };
}

export async function rollbackDocumentVersion(documentId: string, versionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Only admins can rollback documents.' };
  }

  const { data: version } = await supabase
    .from('crm_document_versions')
    .select('file_url, file_name')
    .eq('id', versionId)
    .eq('document_id', documentId)
    .single();

  if (!version) return { error: 'Version not found' };

  const { error } = await supabase
    .from('crm_documents')
    .update({
      current_version_id: versionId,
      file_url: version.file_url,
      file_name: version.file_name,
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'crm_document',
    entity_id: documentId,
    action: 'UPDATE',
    changes: { after: { action: 'rollback', version_id: versionId } },
    performed_by: user.id
  });

  revalidatePath('/dashboard/crm', 'layout');
  return { success: true };
}

export async function approveCustomerDocumentById(documentId: string, expiryDate: string) {
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

  const { data: doc } = await supabase
    .from('crm_documents')
    .select('account_id, label')
    .eq('id', documentId)
    .single();

  if (!doc) return { error: 'Document not found.' };

  const { error } = await supabase
    .from('crm_documents')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      expiry_date: expiryDate,
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId)
    .is('archived_at', null);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'crm_document',
    entity_id: documentId,
    action: 'UPDATE',
    changes: { after: { status: 'approved', expiry_date: expiryDate } },
    performed_by: user.id
  });

  await createNotification({
    type: 'crm',
    title: 'Customer Document Approved',
    message: doc.label
      ? `Custom document "${doc.label}" was approved.`
      : `A customer document was approved.`,
    link: `/dashboard/crm/${doc.account_id}`,
    created_by: user.id
  });

  revalidatePath('/dashboard/crm', 'layout');
  return { success: true };
}

export async function uploadCustomCustomerDocument(customerId: string, label: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };
  const notes = (formData.get('notes') as string)?.trim() || null;

  const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '').slice(0, 40);
  const fileExt = file.name.split('.').pop();
  const fileName = `${labelSlug}_${Date.now()}.${fileExt}`;
  const filePath = `customers/${customerId}/custom/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('crm-documents')
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('crm-documents')
    .getPublicUrl(filePath);

  const { data: newDoc, error: insertError } = await supabase
    .from('crm_documents')
    .insert({
      account_id: customerId,
      doc_type: 'custom',
      label: label.trim(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (insertError || !newDoc) return { error: insertError?.message || 'Failed to create document' };

  const { data: version, error: versionError } = await supabase
    .from('crm_document_versions')
    .insert({
      document_id: newDoc.id,
      version_number: 1,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.id,
      notes
    })
    .select('id')
    .single();

  if (versionError) return { error: versionError.message };

  await supabase
    .from('crm_documents')
    .update({
      current_version_id: version.id,
      file_url: publicUrl,
      file_name: file.name,
      version_number: 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', newDoc.id);

  await recordAuditLog({
    entity_type: 'crm_document',
    entity_id: customerId,
    action: 'UPDATE',
    changes: { after: { doc_type: 'custom', label: label.trim(), status: 'submitted' } },
    performed_by: user.id
  });

  await createNotification({
    type: 'crm',
    title: 'Customer Document Added',
    message: `A custom document "${label.trim()}" was uploaded for a customer.`,
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

const VALID_CRM_ACCOUNT_FIELDS = new Set([
  "company_name", "registered_address", "tin", "status",
  "company_type", "primary_site_location", "industry_note", "notes",
]);

export async function importCustomers(formData: FormData) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const supabase = createServiceRoleClient();

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const buffer = await file.arrayBuffer();
  let rows: Record<string, string>[];
  try {
    rows = parseFile(buffer);
  } catch {
    return { error: 'Failed to parse file. Please ensure it is a valid CSV or Excel file.' };
  }

  if (rows.length === 0) {
    return { error: 'The file appears to be empty.' };
  }

  const fileHeaders = Object.keys(rows[0]);
  const customMappingStr = formData.get("columnMapping") as string | null;
  const columnMap = customMappingStr ? JSON.parse(customMappingStr) as Record<string, string> : buildColumnMap(fileHeaders);
  const unmappedColumns = fileHeaders.filter((h) => !columnMap[h]);

  let created = 0;
  let updated = 0;
  let contactsCreated = 0;
  const errors: { row: number; reason: string }[] = [];

  const accountContactMap = new Map<string, { row: Record<string, string>; rowIndex: number }[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const companyNameRaw = row['Company Name'] || row['company_name'] || row['Company'] || '';
    const tinRaw = row['TIN'] || row['tin'] || '';
    const companyName = String(companyNameRaw).trim().toLowerCase();
    const tin = String(tinRaw).trim().toLowerCase();
    const key = companyName || tin || `row_${i}`;
    const existing = accountContactMap.get(key) || [];
    existing.push({ row, rowIndex: i });
    accountContactMap.set(key, existing);
  }

  for (const [, contactRows] of accountContactMap) {
    try {
      const firstRow = contactRows[0].row;
      const accountData: Record<string, any> = {};
      for (const [fileCol, dbField] of Object.entries(columnMap)) {
        if (VALID_CRM_ACCOUNT_FIELDS.has(dbField)) {
          const val = firstRow[fileCol];
          accountData[dbField] = val !== undefined && val !== null ? String(val).trim() : null;
        }
      }

      const companyName = accountData.company_name;
      if (!companyName) {
        for (const cr of contactRows) {
          errors.push({ row: cr.rowIndex + 2, reason: 'Missing company name.' });
        }
        continue;
      }

      const validStatuses = ['pending', 'active', 'inactive'];
      if (accountData.status && !validStatuses.includes(accountData.status.toLowerCase())) {
        accountData.status = 'pending';
      }
      const effectiveStatus = accountData.status || 'pending';
      accountData.company_type =
        effectiveStatus === 'active' ? 'active_customer'
        : effectiveStatus === 'inactive' ? 'inactive_customer'
        : 'prospect';

      const { data: existingAccount } = await supabase
        .from('crm_accounts')
        .select('id')
        .or(`company_name.ilike.${companyName.replace(/'/g, "''")}${accountData.tin ? `,tin.ilike.${accountData.tin.replace(/'/g, "''")}` : ''}`)
        .is('deleted_at', null)
        .maybeSingle();

      let accountId: string;

      if (existingAccount) {
        accountId = existingAccount.id;
        const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(accountData)) {
          if (k !== 'company_name') updateFields[k] = v;
        }
        const { error: updateErr } = await supabase
          .from('crm_accounts')
          .update(updateFields)
          .eq('id', accountId);
        if (updateErr) {
          for (const cr of contactRows) errors.push({ row: cr.rowIndex + 2, reason: updateErr.message });
          continue;
        }
        updated++;
      } else {
        const { data: newAccount, error: insertErr } = await supabase
          .from('crm_accounts')
          .insert({ ...accountData, status: effectiveStatus, created_by: user.id })
          .select('id')
          .single();
        if (insertErr || !newAccount) {
          for (const cr of contactRows) errors.push({ row: cr.rowIndex + 2, reason: insertErr?.message || 'Failed to create account' });
          continue;
        }
        accountId = newAccount.id;
        created++;
      }

      let firstContact = true;
      for (const cr of contactRows) {
        try {
          const contactData: Record<string, any> = {};
          for (const [fileCol, dbField] of Object.entries(columnMap)) {
            if (['full_name', 'job_title', 'email', 'phone', 'fax'].includes(dbField)) {
              contactData[dbField] = cr.row[fileCol]?.trim() || null;
            }
          }

          if (!contactData.full_name && !contactData.email && !contactData.phone) {
            errors.push({ row: cr.rowIndex + 2, reason: 'Contact has no name, email, or phone.' });
            continue;
          }

          if (contactData.email) {
            const { data: existingContact } = await supabase
              .from('crm_contacts')
              .select('id')
              .eq('account_id', accountId)
              .eq('email', contactData.email)
              .is('deleted_at', null)
              .maybeSingle();

            if (existingContact) {
              const { error: updateContactErr } = await supabase
                .from('crm_contacts')
                .update({ ...contactData, is_primary: firstContact, updated_at: new Date().toISOString(), deleted_at: null })
                .eq('id', existingContact.id);
              if (updateContactErr) {
                errors.push({ row: cr.rowIndex + 2, reason: updateContactErr.message });
              }
              contactsCreated++;
              firstContact = false;
              continue;
            }
          }

          const { error: insertContactErr } = await supabase
            .from('crm_contacts')
            .insert({ ...contactData, account_id: accountId, is_primary: firstContact, created_by: user.id });
          if (insertContactErr) {
            errors.push({ row: cr.rowIndex + 2, reason: insertContactErr.message });
          } else {
            contactsCreated++;
          }
          firstContact = false;
        } catch (err: any) {
          errors.push({ row: cr.rowIndex + 2, reason: err.message || 'Unexpected error' });
        }
      }
    } catch (err: any) {
      for (const cr of contactRows) {
        errors.push({ row: cr.rowIndex + 2, reason: err.message || 'Unexpected error' });
      }
    }
  }

  await recordAuditLog({
    entity_type: 'crm_account',
    entity_id: 'bulk',
    action: 'CREATE',
    changes: { after: { import_summary: { accounts_created: created, accounts_updated: updated, contacts_created: contactsCreated, errors: errors.length } } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/crm');
  return { created, updated, contactsCreated, errors, columnMapping: columnMap, unmappedColumns, totalRows: rows.length };
}
