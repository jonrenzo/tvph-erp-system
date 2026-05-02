import { createClient } from '@/utils/supabase/server';
import { User, Mail, Lock, Shield, Save, Camera } from 'lucide-react';

import { ProfileForm } from '@/components/dashboard/profile/profile-form';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single();

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
          Personal Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Update your personal information and security preferences.
        </p>
      </div>

      <ProfileForm profile={profile} userEmail={user?.email || ''} />
    </div>
  );
}
