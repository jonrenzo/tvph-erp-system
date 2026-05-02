import { createClient } from '@/utils/supabase/server';
import { Settings, Building2, Users, CreditCard, ShieldCheck } from 'lucide-react';
import { SettingsTabs } from '@/components/dashboard/settings/settings-tabs';

export default async function SettingsPage() {
  const supabase = await createClient();

  // Fetch current system settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 1)
    .single();

  // Fetch all users for team management
  const { data: team } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');

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

      <SettingsTabs initialSettings={settings} team={team || []} />
    </div>
  );
}
