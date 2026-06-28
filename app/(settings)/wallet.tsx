import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, ScrollView, Platform, Linking, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import * as Clipboard from 'expo-clipboard'
import { CoinIcon } from '../../components/CoinIcon'

const ADMIN_WHATSAPP = '255765450573' // Admin's WhatsApp number without the +

export default function WalletScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)
  const [voucherCode, setVoucherCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [copied, setCopied] = useState(false)

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [providerName, setProviderName] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!user) return
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', user.id)
          .single()
          
        if (profile) {
          setBalance(profile.wallet_balance || 0)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const handleCopy = async () => {
    await Clipboard.setStringAsync('651516223')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    const text = "Hello Admin! I have just sent an Airtel Money payment. I am requesting my Voucher Code."
    Linking.openURL(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp.')
    })
  }

  const handleRedeem = async () => {
    if (!voucherCode.trim()) return Alert.alert('Invalid Code', 'Please enter a voucher code.')
    setRedeeming(true)
    try {
      const { data, error } = await supabase.rpc('redeem_voucher', { p_code: voucherCode.trim() })
      if (error) throw error
      
      Alert.alert('Success', 'Voucher redeemed successfully! Your balance has been updated.')
      setVoucherCode('')
      setIsTopUpOpen(false)
      
      // Refresh balance
      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user?.id).single()
      if (profile) setBalance(profile.wallet_balance || 0)
        
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to redeem voucher.')
    } finally {
      setRedeeming(false)
    }
  }

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount)
    if (isNaN(amount) || amount <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid number.')
    if (amount > balance) return Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available balance.')
    if (!accountName.trim() || !phoneNumber.trim() || !providerName.trim()) {
      return Alert.alert('Missing Details', 'Please fill in your account name, phone number, and network provider.')
    }

    setWithdrawing(true)
    try {
      const combinedDetails = `Network: ${providerName.trim()} | Phone: ${phoneNumber.trim()} | Name: ${accountName.trim()}`
      const { error } = await supabase.rpc('request_withdrawal', { p_amount: amount, p_details: combinedDetails })
      if (error) throw error
      
      Alert.alert('Request Sent', 'Your withdrawal request is being processed. It usually takes 1-3 hours.')
      setIsWithdrawOpen(false)
      setWithdrawAmount('')
      setAccountName('')
      setPhoneNumber('')
      setProviderName('')
      
      // Refresh balance
      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user?.id).single()
      if (profile) setBalance(profile.wallet_balance || 0)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to request withdrawal.')
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Wallet</Text>
        <TouchableOpacity onPress={() => setIsTopUpOpen(true)}>
          <Text style={styles.headerRedeemText}>Redeem</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
        {/* Premium Balance Card */}
        <LinearGradient
          colors={['#0f172a', '#1e1b4b', '#312e81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumCard}
        >
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <View style={styles.balanceRow}>
            <CoinIcon size={44} />
            <Text style={[styles.balanceValue, { marginLeft: 12 }]}>{balance.toLocaleString()}</Text>
          </View>
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setIsTopUpOpen(true)}>
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.actionGradient}>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.actionBtnTextPrimary}>Top Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setIsWithdrawOpen(true)}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.actionGradient}>
              <Ionicons name="arrow-down-circle" size={24} color="#fff" />
              <Text style={styles.actionBtnTextSecondary}>Withdraw</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Add Funds to Wallet</Text>
        <Text style={styles.sectionDesc}>
          Top up your balance by sending Airtel Money. Once verified by the Admin, you will receive a voucher code to redeem instantly.
        </Text>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
            <Text style={styles.stepTitle}>Send Payment</Text>
          </View>
          <Text style={styles.stepText}>Open your Airtel Money app and send the top-up amount to:</Text>
          
          <View style={styles.lipaBox}>
            <View>
              <Text style={styles.lipaLabel}>LIPA NUMBER</Text>
              <Text style={styles.lipaNumber}>651 516 223</Text>
              <Text style={styles.lipaName}>MESHACK URASSA</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
            <Text style={styles.stepTitle}>Contact Admin</Text>
          </View>
          <Text style={styles.stepText}>Send your payment receipt/screenshot to the Admin to verify and receive your Voucher Code.</Text>
          
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.whatsappBtnText}>Message on WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
            <Text style={styles.stepTitle}>Redeem Voucher</Text>
          </View>
          <Text style={styles.stepText}>Once the Admin gives you the code, tap below to instantly credit your wallet.</Text>
          
          <TouchableOpacity style={styles.redeemBtn} onPress={() => setIsTopUpOpen(true)}>
            <Text style={styles.redeemBtnText}>Enter Voucher Code</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Redeem Modal */}
      <Modal visible={isTopUpOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem Code</Text>
              <TouchableOpacity onPress={() => setIsTopUpOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <TextInput 
                style={styles.input} 
                placeholder="Enter 12-digit code"
                placeholderTextColor={colors.textDim}
                value={voucherCode}
                onChangeText={setVoucherCode}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRedeem} disabled={redeeming}>
              {redeeming ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Redeem Funds</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={isWithdrawOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Funds</Text>
              <TouchableOpacity onPress={() => setIsWithdrawOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroupSmall}>
              <Text style={styles.label}>Amount to Withdraw (TSH)</Text>
              <TextInput
                style={styles.inputSmall}
                placeholder="e.g. 50000"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            <View style={styles.inputGroupSmall}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput
                style={styles.inputSmall}
                placeholder="e.g. John Doe"
                placeholderTextColor={colors.textDim}
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>

            <View style={styles.inputGroupSmall}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.inputSmall}
                placeholder="e.g. 065XXXXXXX"
                placeholderTextColor={colors.textDim}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            <View style={styles.inputGroupSmall}>
              <Text style={styles.label}>Network Provider / Bank</Text>
              <TextInput
                style={styles.inputSmall}
                placeholder="e.g. Airtel Money, M-Pesa, CRDB"
                placeholderTextColor={colors.textDim}
                value={providerName}
                onChangeText={setProviderName}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.submitBtn, { marginTop: 16 }]} 
              onPress={handleWithdraw}
              disabled={withdrawing}
            >
              <Text style={styles.submitBtnText}>{withdrawing ? 'Processing...' : 'Request Withdrawal'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, letterSpacing: -0.5 },
  headerRedeemText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  
  premiumCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, fontWeight: '700' },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceValue: { fontSize: 56, color: '#fff', fontWeight: '900', letterSpacing: -1.5 },

  actionButtonsRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  actionBtnPrimary: { flex: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  actionBtnSecondary: { flex: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 8 },
  actionBtnTextPrimary: { color: '#fff', fontSize: 16, fontWeight: '800' },
  actionBtnTextSecondary: { color: '#fff', fontSize: 16, fontWeight: '800' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 32 },

  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 },
  sectionDesc: { fontSize: 14, color: colors.textDim, lineHeight: 22, marginBottom: 24 },

  stepCard: {
    backgroundColor: colors.card || '#18181b',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.text,
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  stepBadgeText: { color: colors.background, fontSize: 12, fontWeight: '700' },
  stepTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  stepText: { fontSize: 14, color: colors.textDim, lineHeight: 22, marginBottom: 16 },

  lipaBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.border, padding: 16, borderRadius: 12
  },
  lipaLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  lipaNumber: { fontSize: 24, fontWeight: '600', color: colors.text, letterSpacing: 1, marginBottom: 4 },
  lipaName: { fontSize: 12, color: colors.textDim },
  copyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },

  whatsappBtn: {
    backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8
  },
  whatsappBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  redeemBtn: {
    backgroundColor: colors.text, paddingVertical: 14, borderRadius: 12, alignItems: 'center'
  },
  redeemBtnText: { color: colors.background, fontSize: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  
  inputGroup: { marginBottom: 24 },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 18, color: colors.text, textAlign: 'center', letterSpacing: 2
  },

  inputGroupSmall: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textDim, marginBottom: 6 },
  inputSmall: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.text
  },

  submitBtn: { backgroundColor: colors.text, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: colors.background, fontSize: 16, fontWeight: '600' }
})
