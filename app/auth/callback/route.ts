import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // called from Server Component — safe to ignore
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { session } = data;
      const { user } = session;

      if (user.app_metadata?.provider === "azure") {
        // provider_token comes from exchangeCodeForSession; fall back to
        // getSession() in case SSR/PKCE didn't include it in the return value
        let providerToken = session.provider_token ?? null;
        if (!providerToken) {
          const { data: sessionData } = await supabase.auth.getSession();
          providerToken = sessionData.session?.provider_token ?? null;
        }

        await syncMicrosoftProfile(
          user.id,
          user.email ?? "",
          (user.user_metadata ?? {}) as Record<string, string>,
          providerToken
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}

async function syncMicrosoftProfile(
  userId: string,
  email: string,
  meta: Record<string, string>,
  providerToken: string | null
) {
  const service = createServiceRoleClient();

  const fullName = meta?.full_name ?? meta?.name ?? email;

  // Fetch profile photo from Microsoft Graph (requires User.Read scope)
  let avatarUrl: string | null = null;
  if (providerToken) {
    try {
      const photoRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/photo/$value",
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
      if (photoRes.ok) {
        const photoBuffer = await photoRes.arrayBuffer();
        const storagePath = `${userId}-ms.jpg`;
        const { error: uploadError } = await service.storage
          .from("avatars")
          .upload(storagePath, photoBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (!uploadError) {
          const { data: urlData } = service.storage
            .from("avatars")
            .getPublicUrl(storagePath);
          avatarUrl = urlData?.publicUrl ?? null;
        }
      } else {
        console.error(
          "[MSO sync] Graph photo fetch failed:",
          photoRes.status,
          await photoRes.text()
        );
      }
    } catch (err) {
      console.error("[MSO sync] Graph photo error:", err);
    }
  } else {
    console.warn("[MSO sync] provider_token is null — photo sync skipped");
  }

  // Check whether a profile already exists for this auth user
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    // Profile exists (invited via HR) — update name and photo only
    const updates: Record<string, string> = { full_name: fullName };
    if (avatarUrl) updates.avatar_url = avatarUrl;
    await service.from("profiles").update(updates).eq("id", userId);
  } else {
    // First Microsoft SSO login — create profile with default (read-only) role
    const { error: insertError } = await service.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName,
      role: "viewer",
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    });

    // Ping the admin (Telegram) to assign the real role. Never blocks login.
    if (!insertError) {
      try {
        const { sendNewUserRoleAlert } = await import("@/lib/telegram/notify");
        await sendNewUserRoleAlert({ userId, email, fullName });
      } catch (e) {
        console.error("[MSO sync] role alert failed:", e);
      }
    }
  }
}
