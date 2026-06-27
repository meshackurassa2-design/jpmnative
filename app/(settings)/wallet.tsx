import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Image, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

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

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawDetails, setWithdrawDetails] = useState('')
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
    if (!withdrawDetails.trim()) return Alert.alert('Missing Details', 'Please provide your payment details (e.g. Airtel Money 065XXXXXXX)')

    setWithdrawing(true)
    try {
      const { error } = await supabase.rpc('request_withdrawal', { p_amount: amount, p_details: withdrawDetails.trim() })
      if (error) throw error
      
      Alert.alert('Request Sent', 'Your withdrawal request is being processed. It usually takes 1-3 hours.')
      setIsWithdrawOpen(false)
      setWithdrawAmount('')
      setWithdrawDetails('')
      
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{balance.toLocaleString()} TSH</Text>
          <Text style={styles.balanceSub}>Use TSH to buy products in the Marketplace and generate AI videos.</Text>
          
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setIsTopUpOpen(true)}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3f3f46' }]} onPress={() => setIsWithdrawOpen(true)}>
              <Ionicons name="arrow-down-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Up Instructions */}
        <Text style={styles.sectionTitle}>How to Top Up</Text>
        <View style={styles.topUpCard}>
          <View style={styles.topUpIcon}>
            <Ionicons name="phone-portrait-outline" size={32} color="#fff" />
          </View>
          <View style={styles.topUpInfo}>
            <Text style={styles.topUpTitle}>1. Send Airtel Money</Text>
            <Text style={styles.topUpDesc}>Send the amount you want to top up to the Lipa Number below:</Text>
            
            <View style={styles.lipaBox}>
              <Text style={styles.lipaName}>MESHACK URASSA</Text>
              <Text style={styles.lipaNumber}>651516223</Text>
            </View>
          </View>
        </View>

        <View style={styles.topUpCard}>
          <View style={styles.topUpIcon}>
            <Ionicons name="chatbubbles-outline" size={32} color="#fff" />
          </View>
          <View style={styles.topUpInfo}>
            <Text style={styles.topUpTitle}>2. Message Admin</Text>
            <Text style={styles.topUpDesc}>Send a screenshot or transaction ID to the Admin via WhatsApp to receive your Voucher Code.</Text>
          </View>
        </View>

        <View style={styles.topUpCard}>
          <View style={styles.topUpIcon}>
            <Ionicons name="ticket-outline" size={32} color="#fff" />
          </View>
          <View style={styles.topUpInfo}>
            <Text style={styles.topUpTitle}>3. Redeem Voucher</Text>
            <Text style={styles.topUpDesc}>Tap the button below to enter your Voucher Code and instantly get your TSH.</Text>
            <TouchableOpacity style={styles.redeemBtn} onPress={() => setIsTopUpOpen(true)}>
              <Text style={styles.redeemBtnText}>Redeem Voucher Code</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Redeem Modal */}
      <Modal visible={isTopUpOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem Voucher</Text>
              <TouchableOpacity onPress={() => setIsTopUpOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Voucher Code</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. DAPAZ-10000-XYZ"
                placeholderTextColor={colors.textDim}
                value={voucherCode}
                onChangeText={setVoucherCode}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRedeem} disabled={redeeming}>
              {redeeming ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Redeem Now</Text>}
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
              <TouchableOpacity onPress={() => setIsWithdrawOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount to Withdraw (TSH)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50000"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Details (Mobile Money/Bank)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="e.g. Airtel Money 065XXXXXXX, John Doe"
                placeholderTextColor="#666"
                multiline
                value={withdrawDetails}
                onChangeText={setWithdrawDetails}
              />
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                <Text style={styles.submitBtnText}>{withdrawing ? 'Processing...' : 'Request Withdrawal'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  balanceCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1, borderColor: '#c026d355',
    marginBottom: 32,
    alignItems: 'center'
  },
  balanceLabel: { color: '#a855f7', fontSize: 15, fontWeight: '800', marginBottom: 8, letterSpacing: 1 },
  balanceValue: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1, marginBottom: 12 },
  balanceSub: { color: '#d4d4d8', fontSize: 13, textAlign: 'center', paddingHorizontal: 10 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  
  topUpCard: {
    flexDirection: 'row',
    backgroundColor: '#111118',
    padding: 20, borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1, borderColor: '#27272a'
  },
  topUpIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#ec4899',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  topUpInfo: { flex: 1 },
  topUpTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 6 },
  topUpDesc: { fontSize: 14, color: '#a1a1aa', lineHeight: 20 },
  
  lipaBox: {
    backgroundColor: '#fef2f2',
    padding: 16, borderRadius: 16,
    marginTop: 12, alignItems: 'center',
    borderWidth: 2, borderColor: '#ef4444'
  },
  lipaName: { color: '#ef4444', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  lipaNumber: { color: '#b91c1c', fontSize: 28, fontWeight: '900', letterSpacing: 2 },

  redeemBtn: {
    backgroundColor: '#c026d3',
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 12, alignItems: 'center',
    marginTop: 12,
  },
  redeemBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  inputGroup: { padding: 20, paddingBottom: 0 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textDim, marginBottom: 8 },
  input: { backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 16 },

  modalFooter: { padding: 20 },
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  actionBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' }
})
