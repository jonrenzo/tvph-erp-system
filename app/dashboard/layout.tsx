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

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', data.user.id)
    .single();

  return (
    <DashboardShell 
      userEmail={data.user.email || 'Admin'} 
      userName={profile?.full_name || 'User'}
      avatarUrl={profile?.avatar_url}
    >
      {children}
    </DashboardShell>
  )
}
