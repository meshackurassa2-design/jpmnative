import { getCdnUrl } from '../../lib/cdn';
// app/inventory/ai-scan.tsx — AI Invoice Scanner
import React, { useState, useMemo, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { useUI } from '../../lib/ui'
import { useAuth } from '../../lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const FREE_SCANS_PER_MONTH = 2
const SCAN_PRICE_TSH = 500

type ParsedItem = {
  id: string
  name: string
  quantity: string
  cost_price: string
  selling_price: string
}

export default function AIScanScreen() {
  const { colors } = useTheme()
  const s = useMemo(() => getStyles(colors), [colors])
  const { showToast } = useUI()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ shopId: string }>()
  const supabase = createClient()

  const [imageUri, setImageUri] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [items, setItems] = useState<ParsedItem[]>([])
  const [usageCount, setUsageCount] = useState(0)
  const [hasPaid, setHasPaid] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  // Load current month's usage on mount
  useEffect(() => {
    if (!user) return
    supabase
      .from('ai_scan_usage')
      .select('scan_count, paid_at')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUsageCount(data.scan_count)
          setHasPaid(!!data.paid_at)
        }
      })
  }, [user])

  const pickImage = async (useCamera = false) => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      }

      let result
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          showToast('Camera permission is required', 'error')
          return
        }
        result = await ImagePicker.launchCameraAsync(options)
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          showToast('Gallery permission is required', 'error')
          return
        }
        result = await ImagePicker.launchImageLibraryAsync(options)
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        setImageUri(result.assets[0].uri)
        setImageBase64(result.assets[0].base64 || null)
        setItems([]) // Clear previous scan
      }
    } catch (e: any) {
      showToast('Error picking image: ' + e.message, 'error')
    }
  }

  // Gate: check usage before running AI scan
  const handleScanPress = async () => {
    if (!imageBase64) return
    if (!user) { showToast('Please log in first', 'error'); return }

    // If already paid this month OR still within free quota → allow
    if (hasPaid || usageCount < FREE_SCANS_PER_MONTH) {
      await processImage()
      return
    }

    // Over the free limit — show paywall
    Alert.alert(
      '🔒 Free Scans Used',
      `You have used your ${FREE_SCANS_PER_MONTH} free AI scans for ${currentMonth}.\n\nPay 500 TSH to unlock unlimited scans for the rest of this month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay 500 TSH',
          onPress: async () => {
            // TODO: integrate real payment (AzamPay / M-Pesa)
            // For now, simulate successful payment
            const { error } = await supabase.rpc('mark_ai_scan_paid', {
              p_user_id: user.id,
              p_month: currentMonth
            })
            if (error) {
              showToast('Payment failed. Try again.', 'error')
              return
            }
            setHasPaid(true)
            showToast('Payment successful! Scanning now...', 'success')
            await processImage()
          }
        }
      ]
    )
  }

  const processImage = async () => {
    if (!imageBase64) return

    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      Alert.alert(
        'API Key Missing',
        'Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file to use the AI Scanner.'
      )
      return
    }

    setLoading(true)
    setLoadingMsg('Analyzing receipt with AI...')

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      // Use flash model for speed and image capabilities
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `
        Analyze this receipt/invoice. Extract all the products listed.
        Return ONLY a JSON array of objects. Do not wrap in markdown tags like \`\`\`json.
        Each object must have exactly these 3 string fields:
        - "name": The name of the product
        - "quantity": The total quantity (just the number, e.g., "10")
        - "cost_price": The unit price or total cost price for that line item (just the number, no currency symbols)
        
        If a field is missing or unreadable, leave it as an empty string "".
        If there are no products, return an empty array [].
      `

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg"
          }
        }
      ])

      const responseText = result.response.text().trim()
      
      // Clean up markdown if the AI mistakenly included it
      let jsonStr = responseText
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7)
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3)
      }

      const parsedData = JSON.parse(jsonStr)

      if (Array.isArray(parsedData)) {
        const formattedItems = parsedData.map((item: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: item.name || '',
          quantity: item.quantity || '',
          cost_price: item.cost_price || '',
          selling_price: ''
        }))
        setItems(formattedItems)
        showToast(`Found ${formattedItems.length} items!`, 'success')

        // Increment monthly usage count in DB (only if not already paid this month)
        if (user && !hasPaid) {
          supabase.rpc('increment_ai_scan_usage', {
            p_user_id: user.id,
            p_month: currentMonth
          }).then(({ data }) => {
            if (data && data[0]) setUsageCount(data[0].scan_count)
          })
          setUsageCount(prev => prev + 1)
        }
      } else {
        throw new Error("Invalid response format from AI")
      }
    } catch (e: any) {
      console.error(e)
      Alert.alert('Analysis Failed', 'Could not extract items from this image. Please try a clearer photo or enter manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateItem = (id: string, field: keyof ParsedItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const handleSaveAll = async () => {
    if (!params.shopId) {
      showToast('Shop ID missing', 'error')
      return
    }

    const validItems = items.filter(i => i.name.trim().length > 0)
    if (validItems.length === 0) {
      showToast('No valid items to save', 'error')
      return
    }

    setLoading(true)
    setLoadingMsg('Saving inventory...')

    try {
      const payload = validItems.map(item => {
        const qty = parseInt(item.quantity) || 0
        const cost = parseFloat(item.cost_price)
        const selling = parseFloat(item.selling_price)
        return {
          shop_id: params.shopId,
          name: item.name.trim(),
          quantity: qty,
          min_stock: 5, // default
          cost_price: isNaN(cost) ? null : cost,
          selling_price: isNaN(selling) ? null : selling,
          unit: 'pcs' // default
        }
      })

      const { error } = await supabase.from('shop_inventory').insert(payload)
      if (error) throw error

      showToast(`Successfully saved ${validItems.length} items!`, 'success')
      router.back()
    } catch (e: any) {
      showToast(e.message || 'Failed to bulk insert', 'error')
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>AI Invoice Scanner</Text>
          {/* Usage badge */}
          <View style={[s.usageBadge, { backgroundColor: hasPaid ? '#10b981' : usageCount >= FREE_SCANS_PER_MONTH ? '#ef4444' : '#f59e0b' }]}>
            <Text style={s.usageBadgeText}>
              {hasPaid ? '✓ Unlocked' : `${FREE_SCANS_PER_MONTH - usageCount}/${FREE_SCANS_PER_MONTH} free`}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Image Selection Area */}
          {!imageUri ? (
            <View style={s.placeholderArea}>
              <View style={s.iconCircle}>
                <Ionicons name="receipt-outline" size={48} color={colors.primary} />
                <View style={s.sparkleBadge}>
                  <Ionicons name="sparkles" size={12} color="#fff" />
                </View>
              </View>
              <Text style={s.title}>Scan a Receipt</Text>
              <Text style={s.subtitle}>Take a photo of your wholesale invoice and AI will automatically extract all your products and prices.</Text>
              
              <View style={s.btnRow}>
                <TouchableOpacity style={s.actionBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={s.actionBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.border }]} onPress={() => pickImage(false)}>
                  <Ionicons name="images" size={20} color={colors.text} />
                  <Text style={[s.actionBtnText, { color: colors.text }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.imagePreviewArea}>
              <Image source={{ uri: getCdnUrl(imageUri) }} style={s.previewImage} resizeMode="contain" />
              <TouchableOpacity style={s.retakeBtn} onPress={() => pickImage(true)}>
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={s.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Process Button */}
          {imageUri && items.length === 0 && !loading && (
            <TouchableOpacity style={s.processBtn} onPress={handleScanPress}>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={s.processBtnText}>Extract Items with AI</Text>
            </TouchableOpacity>
          )}

          {/* Loading State */}
          {loading && (
            <View style={s.loadingArea}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={s.loadingText}>{loadingMsg}</Text>
            </View>
          )}

          {/* Review List */}
          {items.length > 0 && !loading && (
            <View style={s.reviewArea}>
              <Text style={s.reviewTitle}>Review & Edit Items</Text>
              <Text style={s.reviewSubtitle}>Found {items.length} items. Correct any mistakes before saving.</Text>

              {items.map((item, index) => (
                <View key={item.id} style={s.itemCard}>
                  <View style={s.itemHeader}>
                    <Text style={s.itemIndex}>#{index + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={s.inputName}
                    value={item.name}
                    onChangeText={v => handleUpdateItem(item.id, 'name', v)}
                    placeholder="Product Name"
                    placeholderTextColor={colors.textDim}
                  />
                  
                  <View style={s.itemRow}>
                    <View style={s.fieldCol}>
                      <Text style={s.fieldLabel}>Qty</Text>
                      <TextInput
                        style={s.inputSmall}
                        value={item.quantity}
                        onChangeText={v => handleUpdateItem(item.id, 'quantity', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textDim}
                      />
                    </View>
                    <View style={s.fieldCol}>
                      <Text style={s.fieldLabel}>Cost (TZS)</Text>
                      <TextInput
                        style={s.inputSmall}
                        value={item.cost_price}
                        onChangeText={v => handleUpdateItem(item.id, 'cost_price', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textDim}
                      />
                    </View>
                    <View style={s.fieldCol}>
                      <Text style={s.fieldLabel}>Sell (TZS)</Text>
                      <TextInput
                        style={s.inputSmall}
                        value={item.selling_price}
                        onChangeText={v => handleUpdateItem(item.id, 'selling_price', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textDim}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.saveAllBtn} onPress={handleSaveAll}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveAllBtnText}>Save All to Inventory</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  usageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  usageBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  
  scroll: { padding: 20 },

  placeholderArea: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, paddingHorizontal: 20,
    backgroundColor: colors.card, borderRadius: 24,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, position: 'relative'
  },
  sparkleBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#a855f7', width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.card,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, height: 50,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  imagePreviewArea: {
    width: '100%', height: 300, backgroundColor: '#000',
    borderRadius: 20, overflow: 'hidden', position: 'relative',
    marginBottom: 20,
  },
  previewImage: { width: '100%', height: '100%' },
  retakeBtn: {
    position: 'absolute', top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  retakeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  processBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#a855f7', borderRadius: 14, height: 56,
  },
  processBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  loadingArea: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: colors.textDim, marginTop: 16, fontSize: 15, fontWeight: '600' },

  reviewArea: { marginTop: 10 },
  reviewTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  reviewSubtitle: { fontSize: 14, color: colors.textDim, marginBottom: 20 },

  itemCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  itemIndex: { fontSize: 13, fontWeight: '700', color: colors.textDim },
  
  inputName: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 12,
  },
  itemRow: { flexDirection: 'row', gap: 12 },
  fieldCol: { flex: 1 },
  fieldLabel: { fontSize: 12, color: colors.textDim, marginBottom: 6, fontWeight: '600' },
  inputSmall: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 15,
  },

  saveAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#10b981', borderRadius: 14, height: 56, marginTop: 12,
  },
  saveAllBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
