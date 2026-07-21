import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('salary_adjustments').select('*').limit(1);
  console.log('salary_adjustments schema:', Object.keys(data[0] || {}));

  const { data: qlData } = await supabase.from('queue_manager_logs').select('*').limit(1);
  console.log('queue_manager_logs schema:', Object.keys(qlData[0] || {}));

  const { data: qData } = await supabase.from('queue_logs').select('*').limit(1);
  if(qData) console.log('queue_logs schema:', Object.keys(qData[0] || {}));
}
run();
