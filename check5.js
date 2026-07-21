import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('medic_queues').select('*').limit(1);
  console.log('medic_queues', Object.keys(data[0] || {}));
  const { data: slData } = await supabase.from('story_logs').select('*').limit(1);
  if(slData) console.log('story_logs', Object.keys(slData[0] || {}));
}
run();
