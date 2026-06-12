const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const supabaseUrl = envContent.match(/SUPABASE_URL=(.*)/)[1].trim();
  const supabaseKey = envContent.match(/SUPABASE_ANON_KEY=(.*)/)[1].trim();

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.from('follows').select('*').limit(1);
  console.log("DATA:", data);
  console.log("ERROR:", error);
}

check();
