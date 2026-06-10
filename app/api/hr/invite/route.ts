import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { isAdminOrAbove, isSuperadmin, ROLES } from '@/lib/auth/roles';

export async function POST(req: Request) {
  try {
    const { email, fullName, role, password } = await req.json();

    // 1. Verify that the requester is an admin (or above)
    const supabaseServer = await createServerClient();
    const { data: { user: requester } } = await supabaseServer.auth.getUser();

    if (!requester) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single();

    if (!isAdminOrAbove(profile?.role)) {
      return NextResponse.json({ error: "Only admins can invite team members" }, { status: 403 });
    }

    // Validate the requested role; only a superadmin can mint another superadmin.
    if (!(ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (role === 'superadmin' && !isSuperadmin(profile?.role)) {
      return NextResponse.json({ error: "Only a superadmin can assign the superadmin role" }, { status: 403 });
    }

    // 2. Initialize Admin Client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Create the user directly with password
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: { full_name: fullName, role: role, must_change_password: true },
      email_confirm: true, // Bypass email verification
    });

    if (createError) throw createError;

    if (!authData.user) throw new Error("User creation failed: authData.user is null");

    // 4. Create the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        role: role,
        full_name: fullName,
      });

    if (profileError) console.error("Profile creation error:", profileError);

    // 5. Log the action in Audit Logs
    const { error: logError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        performed_by: requester.id,
        action: 'CREATE',
        entity_type: 'USER_INVITATION',
        entity_id: authData.user.id,
        changes: {
          after: {
            email: email,
            role: role,
            full_name: fullName,
            created_at: new Date().toISOString()
          }
        }
      });

    if (logError) console.error("Audit log error:", logError);

    return NextResponse.json({ success: true, user: authData.user });

  } catch (error: any) {
    console.error("Create User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
