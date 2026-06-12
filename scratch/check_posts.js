const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://tgfuufsgkelgjjktbugg.supabase.co', 'sb_publishable_BfvqG2R0d19EpcX8Xeu9nQ_93liMI2h');

async function test() {
  const { error } = await supabase.from('posts').insert({
    creator_id: "00000000-0000-0000-0000-000000000000",
    this_column_is_fake: true
  });
  console.log(error);
}
test();
