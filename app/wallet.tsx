import { getCdnUrl } from '../lib/cdn';
// app/wallet.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView, Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import Constants from 'expo-constants'

const isExpoGo = Constants.appOwnership === 'expo';

const WITHDRAW_THRESHOLD = 65000;
const REWARD_AMOUNT = 10;

export default function WalletScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()
  
  const [balance, setBalance] = useState<number>(0)
  const [withdrawEmail, setWithdrawEmail] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [toppingUp, setToppingUp] = useState(false)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupPhone, setTopupPhone] = useState('')
  const [voucherCode, setVoucherCode] = useState('')

  useEffect(() => {
    if (user) fetchWallet()
  }, [user])

  const fetchWallet = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', user?.id).single()
    if (data) {
      setBalance(data.wallet_balance || 0)
    }
    
    const { data: wData } = await supabase.from('withdrawals').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
    if (wData) setWithdrawals(wData)
    
    const { data: leadData } = await supabase.from('profiles').select('id, full_name, wallet_balance, avatar_url').order('wallet_balance', { ascending: false }).limit(5)
    if (leadData) setLeaderboard(leadData)
    
    setLoading(false)
  }



  const userIdRef = useRef(user?.id);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);



  const handleWithdraw = async () => {
    if (!withdrawEmail || !withdrawEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid PayPal email address.')
      return
    }
    
    setWithdrawing(true)
    const { error } = await supabase.rpc('request_withdrawal', {
      p_user_id: user?.id,
      p_amount: balance,
      p_email: withdrawEmail
    })
    setWithdrawing(false)
    
    if (!error) {
      Alert.alert('Success! 🎉', 'Your withdrawal request has been submitted and is pending review.')
      setShowWithdraw(false)
      fetchWallet()
    } else {
      Alert.alert('Error', error.message || 'Failed to submit withdrawal request.')
    }
  }

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) {
      Alert.alert('Empty Code', 'Please enter a voucher code.');
      return;
    }
    
    setRedeeming(true);
    const { data, error } = await supabase.rpc('redeem_voucher', {
      p_user_id: user?.id,
      p_code: voucherCode.trim().toUpperCase()
    });
    setRedeeming(false);
    
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Redemption Failed', error.message || 'Invalid or already used voucher.');
    } else if (data) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success! 🎉', `You have successfully redeemed ${data} coins!`);
      setVoucherCode('');
      fetchWallet();
    }
  }

  const formatMpesaPhone = (phone: string): string => {
    // Remove spaces, dashes, plus signs
    let cleaned = phone.replace(/[\s\-\+]/g, '');
    // Convert 0754... → 255754...
    if (cleaned.startsWith('0')) cleaned = '255' + cleaned.slice(1);
    // Already has country code without +
    if (cleaned.startsWith('255') && cleaned.length === 12) return cleaned;
    return cleaned;
  }

  const handleMpesaTopup = async () => {
    if (!topupAmount || !topupPhone) {
      Alert.alert('Missing Fields', 'Please enter both amount and M-Pesa phone number.');
      return;
    }
    
    const formattedPhone = formatMpesaPhone(topupPhone);
    // Accept 12-digit numbers (covers both 255XXXXXXXXX real numbers and 000000000001 sandbox)
    if (formattedPhone.length < 12) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number (e.g. 0754000000).');
      return;
    }

    setToppingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-topup', {
        body: { amount: parseInt(topupAmount), phone_number: formattedPhone }
      });
      
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      
      Alert.alert('Prompt Sent! 📱', 'Check your phone and enter your M-Pesa PIN to complete the top-up. Your Dapaz Coins will update automatically once paid.');
      setTopupAmount('');
      setTopupPhone('');
    } catch (e: any) {
      Alert.alert('Top-up Failed', e.message || 'An error occurred.');
    } finally {
      setToppingUp(false);
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  const progress = Math.min(balance / WITHDRAW_THRESHOLD, 1)

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dapaz Coins</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* Balance Card */}
        <LinearGradient
          colors={['#18181b', '#09090b', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.balanceCard, { borderWidth: 1, borderColor: '#27272a' }]}
        >
          <Text style={styles.balanceLabelPremium}>Available Coins</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.balanceAmountPremium} numberOfLines={1} adjustsFontSizeToFit>{formatNumber(balance)}</Text>
          </View>
        </LinearGradient>

        {/* Redeem Voucher Section */}
        <View style={styles.voucherSection}>
          <Text style={styles.formLabel}>Redeem a Voucher</Text>
          <View style={styles.voucherRow}>
            <TextInput
              style={styles.voucherInput}
              placeholder="e.g. 500-COIN-XYZ"
              placeholderTextColor="#a1a1aa"
              value={voucherCode}
              onChangeText={setVoucherCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={[styles.redeemBtn, redeeming && { opacity: 0.7 }]} 
              onPress={handleRedeemVoucher}
              disabled={redeeming}
            >
              {redeeming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.redeemBtnText}>Redeem</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Native M-Pesa Top-Up */}
        <View style={styles.voucherSection}>
          <Text style={styles.sectionTitle}>📲 Top Up via M-Pesa</Text>
          <Text style={styles.withdrawSub}>Enter your amount and phone number to get an instant M-Pesa PIN prompt on your phone.</Text>
          
          <Text style={styles.formLabel}>Amount (TZS)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5000"
            placeholderTextColor="#a1a1aa"
            keyboardType="numeric"
            value={topupAmount}
            onChangeText={setTopupAmount}
          />

          <Text style={styles.formLabel}>M-Pesa Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0754000000"
            placeholderTextColor="#a1a1aa"
            keyboardType="phone-pad"
            value={topupPhone}
            onChangeText={setTopupPhone}
          />
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: -8, marginBottom: 12 }}>Enter your Vodacom Tanzania number starting with 07...</Text>

          <TouchableOpacity 
            style={[styles.redeemBtn, { backgroundColor: '#e60000', height: 56 }, toppingUp && { opacity: 0.7 }]} 
            onPress={handleMpesaTopup}
            disabled={toppingUp}
          >
            {toppingUp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.redeemBtnText}>Pay with M-Pesa</Text>}
          </TouchableOpacity>
        </View>


        {/* Coin Store Section */}
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.sectionTitle}>🛒 Manual Top-Up</Text>
          <Text style={styles.withdrawSub}>Message the Admin on WhatsApp to buy a voucher code.</Text>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Buy via WhatsApp',
                'Send a message to +255765450573 indicating which package you want to buy.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open WhatsApp', onPress: () => { Alert.alert('Notice', 'In a production build, this would open WhatsApp to +255765450573.') } }
                ]
              )
            }}
            activeOpacity={0.8}
            style={{ marginBottom: 24, borderRadius: 16, overflow: 'hidden', shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
          >
            <LinearGradient
              colors={['#128C7E', '#25D366']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12, marginRight: 14 }}>
                  <Ionicons name="logo-whatsapp" size={28} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 2 }}>Get Vouchers Instantly</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' }}>Chat with our 24/7 Support Team</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {/* Starter Pack */}
            <View style={styles.gridPackageWrapper}>
              <LinearGradient colors={['#27272a', '#18181b']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.gridPackageCard}>
                <Text style={styles.gridPackageTitle}>Starter</Text>
                <Text style={styles.gridPackageCoins}>500 🪙</Text>
                <Text style={styles.gridPackageDesc}>~10 images</Text>
                <View style={styles.gridPackagePriceBtn}>
                  <Text style={styles.packagePriceText}>5,000 Tsh</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Pro Pack */}
            <View style={styles.gridPackageWrapper}>
              <LinearGradient colors={['#27272a', '#18181b']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.gridPackageCard}>
                <Text style={styles.gridPackageTitle}>Pro Pack</Text>
                <Text style={styles.gridPackageCoins}>2,500 🪙</Text>
                <Text style={styles.gridPackageDesc}>~50 images</Text>
                <View style={styles.gridPackagePriceBtn}>
                  <Text style={styles.packagePriceText}>15,000 Tsh</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Business Pack */}
            <View style={styles.gridPackageWrapper}>
              <LinearGradient colors={['#27272a', '#18181b']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.gridPackageCard}>
                <Text style={styles.gridPackageTitle}>Business</Text>
                <Text style={styles.gridPackageCoins}>10,000 🪙</Text>
                <Text style={styles.gridPackageDesc}>~200 images</Text>
                <View style={styles.gridPackagePriceBtn}>
                  <Text style={styles.packagePriceText}>40,000 Tsh</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Unlimited VIP */}
            <View style={styles.gridPackageWrapper}>
              <LinearGradient colors={['#27272a', '#18181b']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.gridPackageCard}>
                <Text style={styles.gridPackageTitle}>👑 VIP</Text>
                <Text style={[styles.gridPackageCoins, { color: '#f59e0b' }]}>Unlimited</Text>
                <Text style={styles.gridPackageDesc}>All features</Text>
                <View style={[styles.gridPackagePriceBtn, { backgroundColor: '#fff' }]}>
                  <Text style={[styles.packagePriceText, { color: '#000' }]}>75,000 Tsh / mo</Text>
                </View>
              </LinearGradient>
            </View>
          </View>
        </View>



        {/* Info Section */}
        <View style={{ marginTop: 30, marginBottom: 40, paddingHorizontal: 4 }}>
          <Text style={styles.sectionTitle}>💡 How to use Dapaz Coins?</Text>
          <View style={styles.infoCard}>
            <Ionicons name="storefront" size={24} color="#f97316" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Open a Shop (2,000 🪙)</Text>
              <Text style={styles.infoDesc}>Start selling your products directly on the marketplace to thousands of local buyers.</Text>
            </View>
          </View>
          
          <View style={styles.infoCard}>
            <Ionicons name="briefcase" size={24} color="#2563eb" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Become a Pro (5,000 🪙)</Text>
              <Text style={styles.infoDesc}>Get verified and listed on our elite Freelance directory to receive direct gigs.</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="sparkles" size={24} color="#8b5cf6" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Dapaz AI Assistant</Text>
              <Text style={styles.infoDesc}>Use coins to generate marketing text, AI images, or get instant support.</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  
  balanceCard: {
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8
  },
  balanceLabelPremium: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coinIcon: { fontSize: 48 },
  balanceAmountPremium: { fontSize: 56, fontWeight: '900', color: '#ffffff' },

  statusTextApproved: { color: '#10b981' },

  withdrawSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  withdrawSub: { fontSize: 14, color: colors.textDim, marginBottom: 20, lineHeight: 20 },
  
  progressTrack: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 6
  },
  progressText: { fontSize: 13, color: colors.textDim, fontWeight: '600', textAlign: 'right', marginBottom: 16 },

  withdrawUnlockBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  withdrawUnlockText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  withdrawForm: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  formLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  voucherSection: { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  voucherRow: { flexDirection: 'row', gap: 12 },
  voucherInput: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, color: colors.text, fontSize: 16, height: 48 },
  redeemBtn: { backgroundColor: '#3b82f6', borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, height: 48 },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 16,
    marginBottom: 16
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  historyAmount: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  historyEmail: { color: colors.textDim, fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPending: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  statusApproved: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextPending: { color: '#f59e0b' },
  statusTextApproved: { color: '#10b981' },
  
  gridActionBtn: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  gridActionText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  gridActionSubText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },

  gridPackageWrapper: { width: '48%', marginBottom: 15 },
  gridPackageCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3f3f46',
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'space-between'
  },
  gridPackageTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  gridPackageCoins: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  gridPackageDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  gridPackagePriceBtn: { backgroundColor: '#3f3f46', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, width: '100%', alignItems: 'center' },
  packagePriceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800'
  },
  
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  infoTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  infoDesc: { fontSize: 13, color: colors.textDim, lineHeight: 18 }
})
