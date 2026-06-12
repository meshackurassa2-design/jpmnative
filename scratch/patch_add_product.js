const fs = require('fs');
const path = 'C:/jpm_app/app/inventory/add.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `      if (isEdit) {
        const { error } = await supabase
          .from('shop_inventory')
          .update(payload)
          .eq('id', existingItem.id)
        if (error) throw error
        showToast('Product updated successfully', 'success')
      } else {
        const { error } = await supabase
          .from('shop_inventory')
          .insert(payload)
        if (error) throw error
        showToast('Product added to inventory', 'success')
      }`;

const replacementStr = `      if (isEdit) {
        const { error } = await supabase
          .from('shop_inventory')
          .update(payload)
          .eq('id', existingItem.id)
        if (error) throw error
        
        // Sync with shops.products JSON
        const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
        const prods = shop?.products || []
        const updated = prods.map((p: any) => p.id === existingItem.id ? { ...p, name: payload.name, price: payload.selling_price || 0, description: payload.notes || p.description } : p)
        await supabase.from('shops').update({ products: updated }).eq('id', shopId)

        showToast('Product updated successfully', 'success')
      } else {
        const { data: newInv, error } = await supabase
          .from('shop_inventory')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        
        // Sync with shops.products JSON
        const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
        const prods = shop?.products || []
        const newProduct = {
          id: newInv.id,
          name: newInv.name,
          price: newInv.selling_price || 0,
          description: newInv.notes || '',
          image_urls: []
        }
        await supabase.from('shops').update({ products: [...prods, newProduct] }).eq('id', shopId)

        showToast('Product added to inventory', 'success')
      }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Successfully patched add.tsx.");
} else {
  console.log("Could not find target in add.tsx.");
}
