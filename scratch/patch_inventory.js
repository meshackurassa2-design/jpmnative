const fs = require('fs');
const path = 'C:/jpm_app/app/inventory/index.tsx';
let content = fs.readFileSync(path, 'utf8');

const insertAfterStr = `  const handleDelete = (item: InventoryItem) => {`;
const promoteLogic = `  const handlePromote = async (item: InventoryItem) => {
    Alert.alert(
      '🚀 Promote Product',
      'Boost this product to the top of the Discover feed for 24 hours? This costs 500 Coins.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Promote (500 Coins)',
          onPress: async () => {
            try {
              // Check wallet balance
              const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
              if (!profile || (profile.wallet_balance || 0) < 500) {
                 Alert.alert('Insufficient Balance', 'You need 500 coins to promote a product.')
                 return
              }
              // Deduct coins
              const { error: walletErr } = await supabase.rpc('receive_coins', { p_user_id: user.id, p_amount: -500 })
              if (walletErr) throw walletErr

              // Update shop JSON
              const { data: shopData } = await supabase.from('shops').select('products').eq('id', shopId).single()
              const updatedProducts = (shopData?.products || []).map((p: any) => {
                if (p.id === item.id) {
                   return { ...p, is_promoted: true, promoted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
                }
                return p
              })
              const { error: shopErr } = await supabase.from('shops').update({ products: updatedProducts }).eq('id', shopId)
              if (shopErr) throw shopErr

              Alert.alert('Success', 'Product promoted successfully! 🚀')
            } catch(e: any) {
              Alert.alert('Error', e.message)
            }
          }
        }
      ]
    )
  }

  const handleDelete = (item: InventoryItem) => {`;

content = content.replace(insertAfterStr, promoteLogic);

const buttonTarget = `          <TouchableOpacity
            style={s.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>`;

const buttonReplacement = `          <View style={{ flexDirection: 'row', marginLeft: 'auto', gap: 8 }}>
            <TouchableOpacity
              style={[s.deleteBtn, { backgroundColor: '#3b82f6', borderColor: '#2563eb' }]}
              onPress={() => handlePromote(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="rocket" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>`;

content = content.replace(buttonTarget, buttonReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched inventory index.");
