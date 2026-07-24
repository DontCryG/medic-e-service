const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('salary_rates').insert([
    { position_name: 'Web Developer', hourly_rate: 0 }
  ]);
  console.log('Inserted:', data);
  if (error) console.error(error);
}
run();
