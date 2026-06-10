import { createClient } from '@/utils/supabase/server';
import { Settings, Building2, Users, CreditCard, ShieldCheck } from 'lucide-react';
import { SettingsTabs } from '@/components/dashboard/settings/settings-tabs';
import { Suspense } from 'react';

export const unstable_instant = { prefetch: 'static' };

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
          System Control Panel
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure organization defaults, manage team roles, and system preferences.
        </p>
      </div>

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: settings }, { data: emailSettings }, { data: team }, { data: profile }] = await Promise.all([
    supabase.from('system_settings').select('*').eq('id', 1).single(),
    supabase.from('email_settings').select('reminder_days').eq('id', 1).maybeSingle(),
    supabase.from('profiles').select('*').order('full_name'),
    user ? supabase.from('profiles').select('role').eq('id', user.id).single() : Promise.resolve({ data: null }),
  ]);

  return (
    <SettingsTabs
      initialSettings={settings}
      reminderDays={emailSettings?.reminder_days ?? [30, 14, 7, 1]}
      team={team || []}
      userRole={profile?.role || 'user'}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-96 w-full bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
    </div>
  );
}
