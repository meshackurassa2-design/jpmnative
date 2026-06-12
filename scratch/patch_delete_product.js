const fs = require('fs');
const path = 'C:/jpm_app/app/inventory/index.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `  const handleDelete = (item: InventoryItem) => {
    showActionSheet(\`Delete "\${item.name}"?\`, [
      {
        text: 'Delete',
        style: 'destructive',
        icon: 'trash',
        onPress: async () => {
          const { error } = await supabase.from('shop_inventory').delete().eq('id', item.id)
          if (error) {
            showToast('Failed to delete item', 'error')
          } else {
            setItems(prev => prev.filter(i => i.id !== item.id))
            showToast('Item deleted', 'success')
          }
        }
      },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }`;

const replacementStr = `  const handleDelete = (item: InventoryItem) => {
    showActionSheet(\`Delete "\${item.name}"?\`, [
      {
        text: 'Delete',
        style: 'destructive',
        icon: 'trash',
        onPress: async () => {
          const { error } = await supabase.from('shop_inventory').delete().eq('id', item.id)
          if (error) {
            showToast('Failed to delete item', 'error')
          } else {
            // Delete from JSON
            const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
            if (shop) {
               const prods = shop.products || []
               const updated = prods.filter((p: any) => p.id !== item.id)
               await supabase.from('shops').update({ products: updated }).eq('id', shopId)
            }

            setItems(prev => prev.filter(i => i.id !== item.id))
            showToast('Item deleted', 'success')
          }
        }
      },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Successfully patched inventory delete.");
} else {
  console.log("Could not find target in inventory index.");
}
