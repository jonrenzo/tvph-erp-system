import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/shell'
import { Suspense } from 'react'

export const unstable_instant = { prefetch: 'static' };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-50 dark:bg-[#020817]" />}>
      <DashboardWithAuth>
        {children}
      </DashboardWithAuth>
    </Suspense>
  )
}

async function DashboardWithAuth({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // During build-time pre-rendering for "Instant Navigation", there is no active session.
  // We rely on middleware.ts to handle the actual authentication redirect for real requests.
  const { data } = await supabase.auth.getUser()
  const user = data?.user;

  let profile = null;
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    profile = profileData;
  }

  return (
    <DashboardShell 
      userEmail={user?.email || 'Admin'} 
      userName={profile?.full_name || 'User'}
      avatarUrl={profile?.avatar_url}
    >
      {children}
    </DashboardShell>
  )
}
