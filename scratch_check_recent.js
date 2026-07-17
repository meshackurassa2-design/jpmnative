const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tgfuufsgkelgjjktbugg.supabase.co';
const supabaseKey = 'sb_publishable_BfvqG2R0d19EpcX8Xeu9nQ_93liMI2h';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, image_urls, content')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(JSON.stringify(data, null, 2));
}

check();
