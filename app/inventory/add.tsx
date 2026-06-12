// app/inventory/add.tsx — Add / Edit Inventory Product
import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList,
  Platform, KeyboardAvoidingView, Switch
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { useUI } from '../../lib/ui'
import DateTimePicker from '@react-native-community/datetimepicker'

const PRODUCT_CATEGORIES = [
  'Food & Beverages', 'Dairy', 'Meat & Poultry', 'Fruits & Vegetables',
  'Snacks', 'Cleaning Products', 'Health & Medicine', 'Beauty & Cosmetics',
  'Electronics', 'Clothing', 'Stationery', 'Building Materials', 'Fuel',
  'Household', 'Other'
]

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'carton', 'packet', 'bundle', 'pair', 'dozen', 'metre']

export default function AddInventoryScreen() {
  const { colors } = useTheme()
  const s = useMemo(() => getStyles(colors), [colors])
  const { user } = useAuth()
  const supabase = createClient()
  const { showToast } = useUI()
  const params = useLocalSearchParams<{ item?: string; shopId?: string }>()

  const isEdit = !!params.item
  const existingItem = params.item ? JSON.parse(params.item) : null
  const shopId = existingItem?.shop_id || params.shopId

  // Form state
  const [name, setName] = useState(existingItem?.name || '')
  const [category, setCategory] = useState(existingItem?.category || '')
  const [quantity, setQuantity] = useState(String(existingItem?.quantity ?? ''))
  const [unit, setUnit] = useState(existingItem?.unit || 'pcs')
  const [minStock, setMinStock] = useState(String(existingItem?.min_stock ?? '5'))
  const [costPrice, setCostPrice] = useState(existingItem?.cost_price != null ? String(existingItem.cost_price) : '')
  const [sellingPrice, setSellingPrice] = useState(existingItem?.selling_price != null ? String(existingItem.selling_price) : '')
  const [barcode, setBarcode] = useState(existingItem?.barcode || '')
  const [notes, setNotes] = useState(existingItem?.notes || '')
  const [expiryDate, setExpiryDate] = useState<Date | null>(
    existingItem?.expiry_date ? new Date(existingItem.expiry_date) : null
  )
  const [isFlashSale, setIsFlashSale] = useState(existingItem?.is_flash_sale || false)
  const [isMysteryBox, setIsMysteryBox] = useState(existingItem?.is_mystery_box || false)

  const [loading, setLoading] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Barcode scanner state
  const [scanning, setScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Product name is required', 'error')
      return
    }
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty < 0) {
      showToast('Please enter a valid quantity', 'error')
      return
    }

    setLoading(true)
    const payload = {
      shop_id: shopId,
      name: name.trim(),
      category: category || null,
      quantity: qty,
      unit,
      min_stock: parseInt(minStock) || 5,
      cost_price: costPrice ? parseFloat(costPrice) : null,
      selling_price: sellingPrice ? parseFloat(sellingPrice) : null,
      expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : null,
      barcode: barcode.trim() || null,
      notes: notes.trim() || null,
      is_flash_sale: isFlashSale,
      is_mystery_box: isMysteryBox,
    }

    try {
      if (isEdit) {
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
      }
      router.back()
    } catch (e: any) {
      showToast(e.message || 'Failed to save product', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleScanBarcode = async () => {
    try {
      const { Camera } = await import('expo-camera')
      const { status } = await Camera.requestCameraPermissionsAsync()
      if (status === 'granted') {
        setScanning(true)
      } else {
        showToast('Camera permission is required to scan barcodes', 'error')
      }
    } catch {
      showToast('Barcode scanner not available on this device', 'error')
    }
  }

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Barcode Scanner Modal
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <BarcodeScannerView
          onScanned={(code: string) => {
            setBarcode(code)
            setScanning(false)
            showToast('Barcode scanned!', 'success')
          }}
          onClose={() => setScanning(false)}
        />
      </View>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'Edit Product' : 'Add Product'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading} style={s.saveBtn}>
            {loading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={s.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Product Name */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="cube-outline" size={16} color={colors.textDim} />
              <Text style={s.sectionTitle}>Product Info</Text>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.label}>Product Name *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Dettol Soap 100g"
                placeholderTextColor={colors.textDim}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Category</Text>
              <TouchableOpacity style={s.input} onPress={() => setShowCategoryPicker(true)}>
                <Text style={{ color: category ? colors.text : colors.textDim, fontSize: 15 }}>
                  {category || 'Select category'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textDim} style={s.chevron} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stock */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="stats-chart-outline" size={16} color={colors.textDim} />
              <Text style={s.sectionTitle}>Stock Levels</Text>
            </View>
            <View style={s.row}>
              <View style={[s.inputGroup, { flex: 2 }]}>
                <Text style={s.label}>Current Quantity *</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
              <View style={[s.inputGroup, { flex: 1.5 }]}>
                <Text style={s.label}>Unit</Text>
                <TouchableOpacity style={s.input} onPress={() => setShowUnitPicker(true)}>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{unit}</Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textDim} style={s.chevron} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>
                Min Stock Alert Threshold
                <Text style={{ color: colors.textDim, fontWeight: '400' }}> (alert when ≤ this)</Text>
              </Text>
              <TextInput
                style={s.input}
                placeholder="5"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                value={minStock}
                onChangeText={setMinStock}
              />
            </View>
          </View>

          {/* Pricing */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="cash-outline" size={16} color={colors.textDim} />
              <Text style={s.sectionTitle}>Pricing</Text>
            </View>
            <View style={s.row}>
              <View style={[s.inputGroup, { flex: 1 }]}>
                <Text style={s.label}>Cost Price (TZS)</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  value={costPrice}
                  onChangeText={setCostPrice}
                />
              </View>
              <View style={[s.inputGroup, { flex: 1 }]}>
                <Text style={s.label}>Selling Price (TZS)</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                />
              </View>
            </View>
            {costPrice && sellingPrice && parseFloat(sellingPrice) > parseFloat(costPrice) && (
              <View style={s.profitBadge}>
                <Ionicons name="trending-up" size={14} color="#16a34a" />
                <Text style={s.profitText}>
                  Margin: TZS {(parseFloat(sellingPrice) - parseFloat(costPrice)).toLocaleString()}
                  {' '}({Math.round(((parseFloat(sellingPrice) - parseFloat(costPrice)) / parseFloat(costPrice)) * 100)}%)
                </Text>
              </View>
            )}
          </View>

          {/* Expiry */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
              <Text style={s.sectionTitle}>Expiry Date</Text>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.label}>Expiry Date (optional)</Text>
              <TouchableOpacity
                style={s.input}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: expiryDate ? colors.text : colors.textDim, fontSize: 15 }}>
                  {expiryDate ? formatDate(expiryDate) : 'No expiry date'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, position: 'absolute', right: 12, top: 14 }}>
                  {expiryDate && (
                    <TouchableOpacity onPress={() => setExpiryDate(null)}>
                      <Ionicons name="close-circle" size={18} color={colors.textDim} />
                    </TouchableOpacity>
                  )}
                  <Ionicons name="calendar-outline" size={18} color={colors.textDim} />
                </View>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(Platform.OS === 'ios')
                    if (date) setExpiryDate(date)
                  }}
                />
              )}
            </View>
          </View>

          {/* Barcode */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="barcode-outline" size={16} color={colors.textDim} />
              <Text style={s.sectionTitle}>Barcode</Text>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.label}>Barcode (optional)</Text>
              <View style={s.barcodeRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Scan or type barcode"
                  placeholderTextColor={colors.textDim}
                  value={barcode}
                  onChangeText={setBarcode}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={s.scanBtn} onPress={handleScanBarcode}>
                  <Ionicons name="scan-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="document-text-outline" size={16} color={colors.textDim} />
              <Text style={s.sectionTitle}>Notes</Text>
            </View>
            <View style={s.inputGroup}>
              <TextInput
                style={[s.input, s.textarea]}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.textDim}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Premium Features */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="sparkles-outline" size={16} color="#ec4899" />
              <Text style={s.sectionTitle}>Premium Features</Text>
            </View>
            
            <View style={s.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={s.label}>Flash Sale</Text>
                  <Text style={{ fontSize: 12, color: colors.textDim }}>Highlight as a limited time offer</Text>
                </View>
                <Switch value={isFlashSale} onValueChange={setIsFlashSale} trackColor={{ true: '#ec4899' }} />
              </View>
            </View>
            
            <View style={[s.inputGroup, { marginTop: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={s.label}>Mystery Box</Text>
                  <Text style={{ fontSize: 12, color: colors.textDim }}>Sell as a surprise package</Text>
                </View>
                <Switch value={isMysteryBox} onValueChange={setIsMysteryBox} trackColor={{ true: '#8b5cf6' }} />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={s.saveFullBtn} onPress={handleSave} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveFullBtnText}>{isEdit ? 'Update Product' : 'Add to Inventory'}</Text>
            }
          </TouchableOpacity>

          {isEdit && (
            <TouchableOpacity
              style={s.deleteFullBtn}
              onPress={() => {
                Alert.alert('Delete Product', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                      await supabase.from('shop_inventory').delete().eq('id', existingItem.id)
                      showToast('Product deleted', 'success')
                      router.back()
                    }
                  }
                ])
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={s.deleteFullBtnText}>Delete Product</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} animationType="slide" transparent onRequestClose={() => setShowCategoryPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PRODUCT_CATEGORIES}
              keyExtractor={i => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerOption}
                  onPress={() => { setCategory(item); setShowCategoryPicker(false) }}
                >
                  <Text style={[s.pickerOptionText, category === item && { color: colors.primary, fontWeight: '700' }]}>{item}</Text>
                  {category === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Unit Picker Modal */}
      <Modal visible={showUnitPicker} animationType="slide" transparent onRequestClose={() => setShowUnitPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Unit</Text>
              <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={UNITS}
              keyExtractor={i => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerOption}
                  onPress={() => { setUnit(item); setShowUnitPicker(false) }}
                >
                  <Text style={[s.pickerOptionText, unit === item && { color: colors.primary, fontWeight: '700' }]}>{item}</Text>
                  {unit === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// Lazy barcode scanner component
function BarcodeScannerView({ onScanned, onClose }: { onScanned: (code: string) => void; onClose: () => void }) {
  const [CameraView, setCameraView] = useState<any>(null)
  const [scanned, setScanned] = useState(false)
  const { colors } = useTheme()

  useEffect(() => {
    import('expo-camera').then(m => {
      setCameraView(() => m.CameraView)
    })
  }, [])

  if (!CameraView) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanned ? undefined : ({ data }: { data: string }) => {
          setScanned(true)
          onScanned(data)
        }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'code128', 'code39', 'qr'] }}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <View style={{ width: 260, height: 160, borderWidth: 2, borderColor: '#fff', borderRadius: 12, backgroundColor: 'transparent' }} />
        <Text style={{ color: '#fff', marginTop: 20, fontSize: 14 }}>Point camera at barcode</Text>
      </View>
      <TouchableOpacity
        style={{ position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 10 }}
        onPress={onClose}
      >
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 60, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  saveBtn: { width: 60, alignItems: 'flex-end' },
  saveBtnText: { color: colors.primary, fontSize: 16, fontWeight: '700' },

  scroll: { padding: 20 },
  section: {
    marginBottom: 24,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textDim, letterSpacing: 0.5 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 7 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border,
    fontSize: 15, color: colors.text,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  textarea: { height: 80, alignItems: 'flex-start', paddingTop: 12 },
  chevron: { position: 'absolute', right: 12, top: 14 },
  row: { flexDirection: 'row', gap: 12 },

  // Profit badge
  profitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#dcfce7', borderRadius: 8, padding: 8, marginTop: 4,
  },
  profitText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },

  // Barcode
  barcodeRow: { flexDirection: 'row', gap: 10 },
  scanBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    width: 52, alignItems: 'center', justifyContent: 'center',
  },

  // Save / Delete Buttons
  saveFullBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  saveFullBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  deleteFullBtn: {
    borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    flexDirection: 'row', gap: 8,
    borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fee2e2',
  },
  deleteFullBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },

  // Pickers
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  pickerOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerOptionText: { fontSize: 15, color: colors.text },
})
