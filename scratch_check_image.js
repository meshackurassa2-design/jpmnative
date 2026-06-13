const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tgfuufsgkelgjjktbugg.supabase.co';
const supabaseKey = 'sb_publishable_BfvqG2R0d19EpcX8Xeu9nQ_93liMI2h';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, image_urls, content')
    .not('image_urls', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    console.log(JSON.stringify(data, null, 2));
    const urls = data[0].image_urls;
    if (urls && urls.length > 0) {
      console.log("Checking URL:", urls[0]);
      const res = await fetch(urls[0]);
      console.log("Status:", res.status);
      console.log("Content-Type:", res.headers.get('content-type'));
      const buffer = await res.arrayBuffer();
      console.log("Size:", buffer.byteLength, "bytes");
    }
  } else {
    console.log("No posts found");
  }
}

check();
