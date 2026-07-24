const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('users').select('*').eq('ic_name', 'Miaa Nakhrach');
  console.log('User:', data);
  if (data && data.length > 0) {
      const discordId = data[0].discord_id;
      const { data: sessions } = await supabase.from('duty_sessions').select('*').eq('discord_id', discordId);
      console.log('Sessions:', sessions);
      const { data: adjustments } = await supabase.from('salary_adjustments').select('*').eq('discord_id', discordId);
      console.log('Adjustments:', adjustments);
  }
}
run();
