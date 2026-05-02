import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
