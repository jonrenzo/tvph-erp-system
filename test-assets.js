const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('assets').select('*, asset_categories(name), profiles(full_name)');
  console.log('Error 1:', error);

  const { data: d2, error: e2 } = await supabase.from('assets').select('*, asset_categories(name), profiles!assets_assigned_to_fkey(full_name, department)');
  console.log('Error 2:', e2);
}
test();
