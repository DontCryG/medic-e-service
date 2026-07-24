const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: existing } = await supabase.from('app_settings').select('*').eq('setting_key', 'maintenance_mode');
  if (!existing || existing.length === 0) {
    const { data, error } = await supabase.from('app_settings').insert([
      { setting_key: 'maintenance_mode', setting_value: 'false' }
    ]);
    console.log('Inserted maintenance_mode:', data);
    if (error) console.error(error);
  } else {
    console.log('maintenance_mode already exists');
  }
}
run();
