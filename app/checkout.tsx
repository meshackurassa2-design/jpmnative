// app/checkout.tsx
import { useTheme } from '../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import uuid from 'react-native-uuid'
import { BackButton } from '../components/BackButton'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

const PROVIDERS = [
  { id: 'Mpesa', label: 'M-Pesa' },
  { id: 'Tigo', label: 'Tigo Pesa' },
  { id: 'Airtel', label: 'Airtel Money' },
  { id: 'Halopesa', label: 'HaloPesa' },
]

const MNO_MAP: Record<string, string> = {
  'M-Pesa': 'Mpesa',
  'Tigo Pesa': 'Tigo',
  'Airtel Money': 'Airtel',
  'HaloPesa': 'Halopesa'
}

const TANZANIAN_CITIES = [
  'Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 
  'Kahama', 'Tabora', 'Zanzibar City', 'Kigoma', 'Sumbawanga', 'Kasulu', 'Songea', 
  'Moshi', 'Musoma', 'Shinyanga', 'Iringa', 'Singida', 'Njombe', 'Bukoba', 'Kibaha', 
  'Mtwara', 'Mpanda', 'Tunduma', 'Makambako', 'Babati', 'Handeni', 'Lindi', 'Korogwe'
].sort()

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const { items, cartTotal, clearCart } = useCart()

  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [provider, setProvider] = useState('Mpesa')
  
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<any>(null)
  const [promoError, setPromoError] = useState('')

  const handleApplyPromo = async () => {
    setPromoError('')
    if (!promoCodeInput.trim()) return

    const { data, error } = await supabase
      .from('shop_promos')
      .select('*')
      .eq('code', promoCodeInput.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle()
      
    if (error || !data) {
      setPromoError('Invalid or expired promo code.')
      return
    }

    // Check if any items in cart belong to this shop
    const hasItemsForShop = items.some(i => i.shopId === data.shop_id)
    if (!hasItemsForShop) {
      setPromoError('This promo code is not valid for any items in your cart.')
      return
    }

    setAppliedPromo(data)
    setPromoError('Promo code applied successfully!')
  }

  const deliveryFee = React.useMemo(() => {
    let fee = 0;
    const processedShops = new Set();
    
    items.forEach(item => {
      if (item.settings?.free_delivery) return;
      if (processedShops.has(item.shopId)) return;
      
      const localFee = item.settings?.delivery_fee_local || 5000;
      const mikoaniFee = item.settings?.delivery_fee_mikoani || 15000;
      
      if (city && item.shopCity && city.toLowerCase() === item.shopCity.toLowerCase()) {
        fee += localFee;
      } else if (city) {
        fee += mikoaniFee;
      }
      processedShops.add(item.shopId);
    });
    
    return fee;
  }, [items, city]);

  const discountAmount = React.useMemo(() => {
    if (!appliedPromo) return 0
    let discount = 0
    items.forEach(item => {
      if (item.shopId === appliedPromo.shop_id) {
        // Assume quantity exists, fallback to 1
        const qty = item.quantity || 1
        discount += (item.price * qty) * (appliedPromo.discount_percent / 100)
      }
    })
    return Math.round(discount)
  }, [items, appliedPromo])

  const finalTotal = Math.max(0, cartTotal + deliveryFee - discountAmount);

  const [isProcessing, setIsProcessing] = useState(false)
  const [success, setSuccess] = useState<{ 
    orderId: string, 
    message: string,
    items: any[],
    total: number,
    sellers: Record<string, any>
  } | null>(null)

  const handleCheckout = async () => {
    Alert.alert('Coming Soon', 'Checkout and payment integration is currently being finalized. Please check back later!');
    return;

    if (!name.trim()) return Alert.alert('Error', 'Please enter your full name.')
    if (!email || !email.includes('@')) return Alert.alert('Error', 'Please enter a valid email address.')
    if (!phone || phone.replace(/\D/g, '').length < 9) return Alert.alert('Error', 'Please enter a valid phone number.')
    if (!address.trim()) return Alert.alert('Error', 'Please enter your delivery address.')
    if (!city.trim()) return Alert.alert('Error', 'Please enter your city.')

    setIsProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('checkout-initialize', {
        body: {
          email, name, phone, address, city,
          amount: finalTotal, items, provider, buyerId: user?.id, deliveryFee,
          promoCode: appliedPromo?.code, discountAmount
        }
      })

      if (error) {
        let errMessage = error.message;
        if (error.context) {
          try {
            const errBody = await error.context.json();
            errMessage = errBody.error || errBody.message || errMessage;
          } catch(e) {}
        }
        throw new Error(errMessage || 'Failed to initialize payment.')
      }
      if (!data) throw new Error('No data returned from payment initialization.')



      const sellerIds = Array.from(new Set(items.map(i => i.sellerId).filter(Boolean)))
      let sellersMap: Record<string, any> = {}
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', sellerIds as string[])
        
        if (sellers) {
          sellers.forEach(s => { sellersMap[s.id] = s })
        }
      }

      setSuccess({ 
        orderId: data.orderId, 
        message: data.message || 'A payment prompt has been sent to your phone.',
        items: [...items],
        total: finalTotal,
        deliveryFee,
        discountAmount,
        promoCode: appliedPromo?.code,
        sellers: sellersMap
      })
      clearCart()
      
    } catch (e: any) {
      Alert.alert('Checkout Failed', e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadReceipt = async () => {
    try {
      if (!success) return
      
      let itemsHtml = ''
      success.items.forEach(item => {
        const seller = success.sellers[item.sellerId]
        itemsHtml += `
          <div style="margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 12px;">
            <div style="font-weight: bold; font-size: 16px;">${item.name}</div>
            <div style="color: #666;">Shop: ${item.shopName}</div>
            <div style="display: flex; justify-content: space-between;">
              <span>Qty: ${item.quantity || 1}</span>
              <span style="font-weight: bold;">TZS ${item.price.toLocaleString()}</span>
            </div>
            ${seller ? `<div style="color: #3b82f6; font-size: 14px; margin-top: 4px;">Seller Contact: @${seller.username} (${seller.full_name})</div>` : ''}
          </div>
        `
      })

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          </head>
          <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #22c55e; margin-bottom: 4px;">Payment Initiated</h1>
              <div style="color: #666; font-family: monospace;">Order ID: ${success.orderId}</div>
            </div>
            
            <h3 style="color: #999; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Buyer Details</h3>
            <div style="margin-bottom: 20px;">
              <div>${name}</div>
              <div>${phone}</div>
              <div>${email}</div>
            </div>
            
            <h3 style="color: #999; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Order Items</h3>
            <div style="margin-bottom: 20px;">
              ${itemsHtml}
            </div>
            
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; font-size: 16px;">
              <span>Subtotal</span>
              <span>TZS ${cartTotal.toLocaleString()}</span>
            </div>
            ${(success as any).discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 16px; color: #16a34a;">
              <span>Discount (${(success as any).promoCode})</span>
              <span>- TZS ${(success as any).discountAmount.toLocaleString()}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 16px;">
              <span>Delivery Fee</span>
              <span>TZS ${(success as any).deliveryFee?.toLocaleString() || 0}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 2px solid #333; font-size: 20px; font-weight: bold;">
              <span>Total Paid</span>
              <span>TZS ${success.total.toLocaleString()}</span>
            </div>
            
            <div style="margin-top: 40px; padding: 16px; background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; color: #b91c1c; font-weight: bold;">
              WARNING: To protect yourself from fraud, all payments MUST be completed within the app. Do not send money directly to sellers.
            </div>
          </body>
        </html>
      `

      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Could not generate or share PDF.')
    }
  }

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>Digital Receipt</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.receiptPaper, { backgroundColor: '#0A0A0A', borderColor: '#222222' }]}>
            <View style={styles.receiptHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={[styles.receiptTitle, { color: '#FFFFFF' }]}>Payment Initiated</Text>
              <Text style={[styles.receiptOrder, { color: '#888888' }]}>Order ID: {success.orderId}</Text>
            </View>

            <View style={[styles.receiptDivider, { borderColor: '#333333' }]} />

            <View style={styles.receiptSection}>
              <Text style={[styles.receiptSectionTitle, { color: '#888888' }]}>Buyer Details</Text>
              <Text style={[styles.receiptText, { color: '#DDDDDD' }]}>{name}</Text>
              <Text style={[styles.receiptText, { color: '#DDDDDD' }]}>{phone}</Text>
              <Text style={[styles.receiptText, { color: '#DDDDDD' }]}>{email}</Text>
            </View>

            <View style={[styles.receiptDivider, { borderColor: '#333333' }]} />

            <View style={styles.receiptSection}>
              <Text style={[styles.receiptSectionTitle, { color: '#888888' }]}>Order Items</Text>
              {success.items.map((item, idx) => {
                const seller = success.sellers[item.sellerId]
                return (
                  <View key={idx} style={{ marginBottom: 12 }}>
                    <Text style={[styles.receiptItemName, { color: '#FFFFFF' }]}>{item.name}</Text>
                    <Text style={[styles.receiptText, { color: '#AAAAAA' }]}>Shop: {item.shopName}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[styles.receiptText, { color: '#AAAAAA' }]}>Qty: {item.quantity || 1}</Text>
                      <Text style={[styles.receiptItemPrice, { color: '#FFFFFF' }]}>TZS {item.price.toLocaleString()}</Text>
                    </View>
                    {seller && (
                      <Text style={[styles.receiptSellerContact, { color: '#3b82f6' }]}>
                        Seller Contact: @{seller.username} ({seller.full_name})
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>

            <View style={[styles.receiptDivider, { borderColor: '#333333' }]} />

            <View style={styles.receiptTotalRow}>
              <Text style={[styles.receiptText, { color: '#AAAAAA' }]}>Subtotal</Text>
              <Text style={[styles.receiptItemPrice, { color: '#FFFFFF' }]}>TZS {cartTotal.toLocaleString()}</Text>
            </View>
            {(success as any).discountAmount > 0 && (
              <View style={[styles.receiptTotalRow, { marginTop: 8 }]}>
                <Text style={[styles.receiptText, { color: '#16a34a' }]}>Discount</Text>
                <Text style={[styles.receiptItemPrice, { color: '#16a34a' }]}>- TZS {((success as any).discountAmount).toLocaleString()}</Text>
              </View>
            )}
            <View style={[styles.receiptTotalRow, { marginTop: 8 }]}>
              <Text style={[styles.receiptText, { color: '#AAAAAA' }]}>Delivery Fee</Text>
              <Text style={[styles.receiptItemPrice, { color: '#FFFFFF' }]}>TZS {((success as any).deliveryFee || 0).toLocaleString()}</Text>
            </View>

            <View style={[styles.receiptDivider, { borderColor: '#333333', borderStyle: 'solid', borderWidth: 2 }]} />

            <View style={styles.receiptTotalRow}>
              <Text style={[styles.receiptTotalLabel, { color: '#FFFFFF' }]}>Total Paid</Text>
              <Text style={[styles.receiptTotalValue, { color: '#FFFFFF' }]}>TZS {success.total.toLocaleString()}</Text>
            </View>
          </View>

          <View style={[styles.warningBox, { backgroundColor: '#3f0f0f', borderColor: '#ef4444' }]}>
            <Ionicons name="warning" size={24} color="#f87171" />
            <Text style={[styles.warningText, { color: '#fca5a5' }]}>
              WARNING: To protect yourself from fraud, all payments MUST be completed within the app. Do not send money directly to sellers.
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: '#FFFFFF', marginBottom: 12 }]} 
            onPress={downloadReceipt}
          >
            <Text style={[styles.primaryBtnText, { color: '#000000' }]}>Download PDF Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: '#333333' }]} 
            onPress={() => {
              clearCart()
              router.push('/(tabs)')
            }}
          >
            <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>Return to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Your Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Meshack Urassa"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="john@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.helperText}>Your receipt will be sent to this address.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mobile Payment Provider</Text>
          <View style={styles.providersGrid}>
            {PROVIDERS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerBtn, provider === p.id && styles.providerBtnActive]}
                onPress={() => setProvider(p.id)}
              >
                <Text style={[styles.providerText, provider === p.id && styles.providerTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneInputContainer}>
            <Text style={styles.phonePrefix}>+255</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="712 345 678"
              keyboardType="numeric"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <Text style={styles.helperText}>You'll receive a payment prompt on this number.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Delivery Address (Tanzania)</Text>
          <View style={styles.addressGrid}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Street / Area"
              value={address}
              onChangeText={setAddress}
            />
            <TouchableOpacity 
              style={[styles.input, { flex: 1, justifyContent: 'center' }]} 
              onPress={() => setShowCityPicker(true)}
            >
              <Text style={{ color: city ? colors.text : colors.textDim, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                {city || 'Select City'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Promo Code (Optional)</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. SUMMER20"
              autoCapitalize="characters"
              value={promoCodeInput}
              onChangeText={setPromoCodeInput}
            />
            <TouchableOpacity 
              style={{ backgroundColor: colors.text, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12 }}
              onPress={handleApplyPromo}
            >
              <Text style={{ color: colors.background, fontWeight: '700' }}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoError ? (
            <Text style={{ color: promoError.includes('successfully') ? '#16a34a' : '#ef4444', marginTop: 8, fontSize: 13, fontWeight: '600' }}>
              {promoError}
            </Text>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>TZS {cartTotal.toLocaleString()}</Text>
          </View>
          {appliedPromo && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>Discount ({appliedPromo.code})</Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>- TZS {discountAmount.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>
              {city ? `TZS ${deliveryFee.toLocaleString()}` : 'Select city'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>TZS {finalTotal.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} transparent animationType="slide" onRequestClose={() => setShowCityPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCityPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select Region</Text>
          <FlatList
            data={TANZANIAN_CITIES}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cityItem, city === item && styles.cityItemActive]}
                onPress={() => { setCity(item); setShowCityPicker(false); }}
              >
                <Text style={[styles.cityText, city === item && styles.cityTextActive]}>{item}</Text>
                {city === item && <Ionicons name="checkmark" size={20} color={colors.background} />}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.checkoutBtn} 
          onPress={handleCheckout}
          disabled={isProcessing}
          >
          {isProcessing ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.checkoutBtnText}>Pay TZS {finalTotal.toLocaleString()}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDim, marginBottom: 8 },
  input: {
    backgroundColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontWeight: '600', color: colors.text,
  },
  helperText: { fontSize: 12, color: colors.textDim, fontWeight: '500', marginTop: 6 },
  
  providersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerBtn: {
    flex: 1, minWidth: '45%',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: colors.border,
    alignItems: 'center',
  },
  providerBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  providerText: { fontSize: 14, fontWeight: '700', color: '#52525b' },
  providerTextActive: { color: '#2563eb' },
  
  phoneInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.border, borderRadius: 12,
  },
  phonePrefix: { paddingLeft: 16, fontSize: 16, fontWeight: '700', color: colors.textDim },
  phoneInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16, fontWeight: '600', color: colors.text },
  
  addressGrid: { flexDirection: 'row', gap: 12 },
  
  summaryCard: {
    backgroundColor: colors.background, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border,
    marginTop: 12, marginBottom: 40,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 15, color: colors.textDim, fontWeight: '500' },
  summaryValue: { fontSize: 15, color: colors.text, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  totalLabel: { fontSize: 18, color: colors.text, fontWeight: '800' },
  totalValue: { fontSize: 18, color: colors.text, fontWeight: '900' },

  footer: { padding: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  checkoutBtn: {
    backgroundColor: colors.text, borderRadius: 28, height: 56,
    justifyContent: 'center', alignItems: 'center',
  },
  checkoutBtnText: { color: colors.background, fontSize: 16, fontWeight: '800' },

  successTitle: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 20, marginBottom: 12 },
  successText: { fontSize: 15, color: colors.textDim, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  orderCard: {
    backgroundColor: colors.background, borderRadius: 16, padding: 16,
    width: '100%', alignItems: 'center', marginBottom: 32,
    borderWidth: 1, borderColor: colors.border,
  },
  orderCardLabel: { fontSize: 12, color: colors.textDim, fontWeight: '600', marginBottom: 4 },
  orderCardValue: { fontSize: 16, fontWeight: '900', color: colors.text },
  primaryBtn: {
    backgroundColor: colors.text, borderRadius: 20, width: '100%',
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  receiptPaper: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 24,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  receiptTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 4 },
  receiptOrder: { fontSize: 13, color: colors.textDim },
  receiptDivider: { height: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginVertical: 16 },
  receiptSection: {},
  receiptSectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  receiptText: { fontSize: 14, color: colors.textDim, marginBottom: 2 },
  receiptItemName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  receiptItemPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
  receiptSellerContact: { fontSize: 12, color: '#3b82f6', marginTop: 4, fontWeight: '500' },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptTotalLabel: { fontSize: 18, fontWeight: '800', color: colors.text },
  receiptTotalValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  warningBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1, borderColor: '#fca5a5',
    borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 24,
  },
  warningText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#b91c1c', lineHeight: 18 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16, textAlign: 'center' },
  cityItem: {
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  cityItemActive: { backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 16, borderBottomWidth: 0 },
  cityText: { fontSize: 16, fontWeight: '600', color: colors.textDim },
  cityTextActive: { color: colors.background, fontWeight: '700' }
})
