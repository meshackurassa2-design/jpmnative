import { useTheme } from '../lib/theme';
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCart, CartItem } from '../lib/cart'
import uuid from 'react-native-uuid'
import { encryptMessage, getSharedSecret } from '../lib/crypto'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

const TANZANIAN_CITIES = [
  'Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 
  'Kahama', 'Tabora', 'Zanzibar City', 'Kigoma', 'Sumbawanga', 'Kasulu', 'Songea', 
  'Moshi', 'Musoma', 'Shinyanga', 'Iringa', 'Singida', 'Njombe', 'Bukoba', 'Kibaha', 
  'Mtwara', 'Mpanda', 'Tunduma', 'Makambako', 'Babati', 'Handeni', 'Lindi', 'Korogwe'
].sort()

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const { items, cartTotal, clearCart } = useCart()
  const insets = useSafeAreaInsets()
  const topPadding = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 54 : Constants.statusBarHeight)

  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)

  useEffect(() => {
    async function loadWallet() {
      if (!user) return
      const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
      if (data) setWalletBalance(data.wallet_balance || 0)
    }
    loadWallet()
  }, [user])

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

  const finalTotal = Math.max(0, cartTotal + deliveryFee);

  const [isProcessing, setIsProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [paidAmount, setPaidAmount] = useState(0)
  const [orderedItems, setOrderedItems] = useState<CartItem[]>([])

  const handleCheckout = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Please enter your full name.')
    if (!phone) return Alert.alert('Error', 'Please enter a valid phone number.')
    if (!address.trim()) return Alert.alert('Error', 'Please enter your delivery address.')
    if (!city.trim()) return Alert.alert('Error', 'Please enter your city.')

    if (finalTotal > walletBalance) {
      return Alert.alert(
        'Insufficient TSH', 
        `You need TSH ${finalTotal.toLocaleString()} but only have TSH ${walletBalance.toLocaleString()}. Please top up your wallet via Airtel Money.`
      )
    }

    setIsProcessing(true)
    try {
      const p_items = items.map(item => ({
        sellerId: item.sellerId,
        productId: item.id,
        name: item.name,
        price: parseFloat(item.price.replace(/[^\d.]/g, '')) || 0,
        quantity: item.quantity || 1,
        commission: 0.05
      }))

      const { data: orderId, error: checkoutErr } = await supabase.rpc('process_checkout', {
        p_buyer_id: user.id,
        p_buyer_name: name,
        p_buyer_email: user.email || '',
        p_buyer_phone: phone,
        p_buyer_address: address,
        p_buyer_city: city,
        p_total_amount: finalTotal,
        p_items: p_items
      })

      if (checkoutErr) throw checkoutErr

      // 3. Notify sellers via chat
      for (const item of items) {
         if (item.sellerId) {
           try {
             const content = `🛒 New Order!\n\nBuyer Name: ${name}\n\nI just ordered ${item.quantity || 1}x ${item.name} for TSH ${((parseFloat(item.price.replace(/[^\d.]/g, '')) || 0) * (item.quantity || 1)).toLocaleString()}.\n\nDelivery Address: ${address}, ${city}\nPhone: +255${phone}\n\nPlease prepare it for delivery!`;
             const secret = getSharedSecret(user.id, item.sellerId);
             const encrypted = await encryptMessage(content, secret);
             await supabase.from('messages').insert({
               sender_id: user.id,
               receiver_id: item.sellerId,
               content: encrypted,
               is_shop_chat: true,
             } as any);
           } catch (err) {
             console.error('Failed to send order notification', err);
           }
         }
      }

      setPaidAmount(finalTotal)
      setOrderedItems([...items])
      setSuccess(true)
      clearCart()
      
    } catch (e: any) {
      Alert.alert('Checkout Failed', e.message || 'An error occurred during payment.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: topPadding, paddingBottom: insets.bottom || 24 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>Order Complete</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.receiptPaper, { backgroundColor: '#0A0A0A', borderColor: '#222222', alignItems: 'center', width: '100%', marginBottom: 24 }]}>
            <Ionicons name="checkmark-circle" size={80} color="#22c55e" style={{ marginBottom: 20 }} />
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 10 }}>Payment Successful</Text>
            <Text style={{ fontSize: 16, color: '#AAAAAA', textAlign: 'center', marginBottom: 20 }}>
              Your order has been placed. TSH {paidAmount.toLocaleString()} was deducted from your wallet.
            </Text>
            
            <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Order Receipt</Text>
              {orderedItems.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ color: '#aaa', flex: 1, paddingRight: 10 }}>{item.quantity || 1}x {item.name}</Text>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>TSH {((parseFloat(item.price.replace(/[^\d.]/g, '')) || 0) * (item.quantity || 1)).toLocaleString()}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
                 <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Total Paid</Text>
                 <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 16 }}>TSH {paidAmount.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: '#3b82f6', marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} 
            onPress={async () => {
              try {
                const html = `
                  <html>
                    <head>
                      <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #111; }
                        h1 { color: #22c55e; text-align: center; }
                        .header { text-align: center; margin-bottom: 40px; }
                        .item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
                        .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; color: #22c55e; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <h1>Payment Successful</h1>
                        <p>Thank you for your order!</p>
                      </div>
                      <h3>Order Receipt</h3>
                      ${orderedItems.map(item => `
                        <div class="item">
                          <span>${item.quantity || 1}x ${item.name}</span>
                          <span>TSH ${((parseFloat(item.price.replace(/[^\d.]/g, '')) || 0) * (item.quantity || 1)).toLocaleString()}</span>
                        </div>
                      `).join('')}
                      <div class="item total">
                        <span>Total Paid</span>
                        <span>TSH ${paidAmount.toLocaleString()}</span>
                      </div>
                      <p style="text-align: center; margin-top: 40px; color: #888;">Generated by JPM App</p>
                    </body>
                  </html>
                `;
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
              } catch (err) {
                Alert.alert('Error', 'Failed to generate receipt');
              }
            }}
          >
            <Ionicons name="print-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>Print / Download Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: '#c026d3' }]} 
            onPress={() => router.push(orderedItems.length > 0 ? `/shop/${orderedItems[0].shopId}` : '/(tabs)')}
          >
            <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>Continue Shopping</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: insets.bottom || 24 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={styles.walletBox}>
          <Text style={styles.walletLabel}>Your Wallet Balance</Text>
          <Text style={styles.walletValue}>TSH {walletBalance.toLocaleString()}</Text>
          {walletBalance < finalTotal && (
             <TouchableOpacity style={styles.topUpBtn} onPress={() => router.push('/(settings)/wallet')}>
                <Text style={styles.topUpText}>Top Up Wallet</Text>
             </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Delivery Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name (3 Names)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Meshack John Urassa"
            value={name}
            onChangeText={setName}
          />
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

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>TSH {cartTotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>
              {city ? `TSH ${deliveryFee.toLocaleString()}` : 'Select city'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>TSH {finalTotal.toLocaleString()}</Text>
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
          style={[styles.checkoutBtn, walletBalance < finalTotal && { backgroundColor: colors.border }]} 
          onPress={handleCheckout}
          disabled={isProcessing || walletBalance < finalTotal}
          >
          {isProcessing ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.checkoutBtnText, walletBalance < finalTotal && { color: colors.textDim }]}>
               {walletBalance >= finalTotal ? `Pay TSH ${finalTotal.toLocaleString()}` : 'Insufficient Balance'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  walletBox: { backgroundColor: '#1a0a2e', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#c026d355', alignItems: 'center' },
  walletLabel: { color: '#a855f7', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  walletValue: { color: '#fff', fontSize: 32, fontWeight: '900' },
  topUpBtn: { marginTop: 12, backgroundColor: '#c026d3', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  topUpText: { color: '#fff', fontWeight: '800' },

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
