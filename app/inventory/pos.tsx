// app/inventory/pos.tsx — Point of Sale / Cashier Mode
import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { useUI } from '../../lib/ui'
import { CameraView, useCameraPermissions } from 'expo-camera'

type CartItem = {
  id: string
  name: string
  selling_price: number | null
  quantity: number
  max_stock: number
}

export default function POSScreen() {
  const { colors } = useTheme()
  const s = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()
  const { showToast } = useUI()
  const params = useLocalSearchParams<{ shopId: string }>()

  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [inventoryMap, setInventoryMap] = useState<Record<string, any>>({})
  
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)

  // Map to prevent rapid double scanning
  const lastScanRef = useRef<number>(0)

  useEffect(() => {
    async function fetchInventory() {
      if (!params.shopId) return
      const { data, error } = await supabase
        .from('shop_inventory')
        .select('*')
        .eq('shop_id', params.shopId)

      if (data) {
        const map: Record<string, any> = {}
        data.forEach(item => {
          if (item.barcode) {
            map[item.barcode] = item
          }
        })
        setInventoryMap(map)
      }
      setLoading(false)
    }
    fetchInventory()
  }, [params.shopId])

  if (!permission) {
    return <View style={s.center}><ActivityIndicator color={colors.text} /></View>
  }

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={{ color: colors.text, marginBottom: 20 }}>We need your permission to use the camera for scanning.</Text>
        <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
          <Text style={s.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    const now = Date.now()
    if (now - lastScanRef.current < 2000) {
      // Ignore rapid consecutive scans
      return
    }
    lastScanRef.current = now

    const product = inventoryMap[data]
    if (product) {
      // Add to cart or increment
      setCart(prev => {
        const existing = prev.find(i => i.id === product.id)
        if (existing) {
          if (existing.quantity >= existing.max_stock) {
            showToast('Not enough stock!', 'error')
            return prev
          }
          return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        } else {
          if (product.quantity <= 0) {
            showToast('Item is out of stock!', 'error')
            return prev
          }
          return [...prev, {
            id: product.id,
            name: product.name,
            selling_price: product.selling_price,
            quantity: 1,
            max_stock: product.quantity
          }]
        }
      })
      // Could play a beep sound here
    } else {
      showToast('Barcode not recognized in inventory', 'error')
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta
        if (newQty > item.max_stock) {
          showToast('Not enough stock!', 'error')
          return item
        }
        return { ...item, quantity: newQty }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const totalAmount = cart.reduce((sum, item) => sum + (item.selling_price || 0) * item.quantity, 0)

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!params.shopId) return

    Alert.alert(
      'Confirm Checkout',
      `Process cash payment of TZS ${totalAmount.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Charge', 
          onPress: async () => {
            setCheckingOut(true)
            try {
              // Deduct stock in DB
              for (const item of cart) {
                const { error } = await supabase.rpc('decrement_inventory', {
                  p_item_id: item.id,
                  p_quantity: item.quantity
                })
                if (error) {
                  // Fallback if RPC doesn't exist
                  await supabase
                    .from('shop_inventory')
                    .update({ quantity: item.max_stock - item.quantity })
                    .eq('id', item.id)
                }
              }
              
              // Optional: Log an order/sale receipt here in a `pos_sales` table 
              // We'll skip for now and just update inventory for the MVP

              showToast('Sale complete!', 'success')
              setCart([])
              
              // Update max_stock locally to reflect deductions
              const newMap = { ...inventoryMap }
              cart.forEach(c => {
                Object.keys(newMap).forEach(key => {
                  if (newMap[key].id === c.id) {
                    newMap[key].quantity -= c.quantity
                  }
                })
              })
              setInventoryMap(newMap)
              
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setCheckingOut(false)
            }
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Scanner Section */}
      <View style={s.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code39", "code128"],
          }}
        />
        
        {/* Overlay UI */}
        <View style={s.overlay}>
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={s.scannerTitle}>
              <Ionicons name="barcode-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.scannerTitleText}>POS Scanner</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          
          <View style={s.targetBox} />
          
          <Text style={s.scanInstructions}>Center barcode in the box</Text>
        </View>
      </View>

      {/* Cart Section */}
      <View style={s.cartArea}>
        <View style={s.cartHeader}>
          <Text style={s.cartTitle}>Current Sale</Text>
          <Text style={s.cartCount}>{cart.length} items</Text>
        </View>
        
        <FlatList
          data={cart}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyCart}>
              <Ionicons name="cart-outline" size={48} color={colors.textDim} />
              <Text style={s.emptyCartText}>Scan items to add to cart</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.cartItemRow}>
              <View style={s.itemInfo}>
                <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.itemPrice}>TZS {item.selling_price?.toLocaleString() || '0'}</Text>
              </View>
              
              <View style={s.qtyControls}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
                  <Ionicons name="remove" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={s.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQuantity(item.id, 1)}>
                  <Ionicons name="add" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={s.itemTotal}>
                <Text style={s.itemTotalText}>
                  TZS {((item.selling_price || 0) * item.quantity).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        />
        
        <View style={s.footer}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>TZS {totalAmount.toLocaleString()}</Text>
          </View>
          <TouchableOpacity 
            style={[s.chargeBtn, cart.length === 0 && s.chargeBtnDisabled]}
            disabled={cart.length === 0 || checkingOut}
            onPress={handleCheckout}
          >
            {checkingOut ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.chargeBtnText}>Charge TZS {totalAmount.toLocaleString()}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionBtn: { backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  permissionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  cameraWrapper: { height: '40%', width: '100%', backgroundColor: '#000', position: 'relative' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'space-between', paddingVertical: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  scannerTitle: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scannerTitleText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  
  targetBox: { 
    width: 250, height: 120, alignSelf: 'center',
    borderWidth: 2, borderColor: '#10b981', borderRadius: 16,
    backgroundColor: 'transparent'
  },
  scanInstructions: { color: '#fff', textAlign: 'center', fontSize: 14, fontWeight: '600', marginBottom: 20 },
  
  cartArea: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: 20 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cartTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  cartCount: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyCartText: { color: colors.textDim, fontSize: 16, marginTop: 12 },
  
  cartItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemInfo: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  itemPrice: { fontSize: 13, color: colors.textDim },
  
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border, borderRadius: 12 },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 24, textAlign: 'center' },
  
  itemTotal: { width: 80, alignItems: 'flex-end' },
  itemTotalText: { fontSize: 15, fontWeight: '800', color: colors.text },
  
  footer: { paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontSize: 18, color: colors.textDim, fontWeight: '700' },
  totalValue: { fontSize: 24, color: colors.text, fontWeight: '900' },
  
  chargeBtn: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  chargeBtnDisabled: { backgroundColor: colors.border },
  chargeBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' }
})
