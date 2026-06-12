const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('C:/jpm_app/.env', 'utf8');
const extractEnv = (key) => {
  const match = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = extractEnv('SUPABASE_URL');
const supabaseKey = extractEnv('SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncInventory() {
  console.log("Fetching shops...");
  const { data: shops, error: shopErr } = await supabase.from('shops').select('id, products').not('products', 'is', null);
  
  if (shopErr) {
    console.error("Error fetching shops:", shopErr);
    return;
  }

  for (const shop of shops) {
    const products = shop.products || [];
    for (const product of products) {
      if (!product.id) continue;
      
      const { data: existing, error: invErr } = await supabase
        .from('shop_inventory')
        .select('id')
        .eq('id', product.id)
        .maybeSingle();
        
      if (!existing) {
        console.log(`Inserting missing product: ${product.name} (${product.id}) for shop ${shop.id}`);
        // Insert into shop_inventory
        const payload = {
          id: product.id,
          shop_id: shop.id,
          name: product.name || 'Unnamed Product',
          selling_price: product.price || 0,
          notes: product.description || '',
          quantity: 10,
          unit: 'pcs',
          min_stock: 5,
        };
        
        await supabase.from('shop_inventory').insert(payload);
      }
    }
  }
  console.log("Sync complete.");
}

syncInventory();
