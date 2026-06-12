import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

type Payout = {
  id: string
  amount: number
  status: string
  provider: string
  phone_number: string
  created_at: string
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  
  const [shopId, setShopId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isRequesting, setIsRequesting] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [provider, setProvider] = useState('M-PESA')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!user) return
      try {
        // Get shop id
        const { data: shop } = await supabase
          .from('shops')
          .select('id')
          .eq('owner_id', user.id)
          .single()
          
        if (!shop) {
          setLoading(false)
          return
        }
        setShopId(shop.id)

        // Get wallet balance
        const { data: wallet, error: walletErr } = await supabase
          .from('wallets')
          .select('balance')
          .eq('shop_id', shop.id)
          .single()

        if (wallet) {
          setBalance(wallet.balance)
        } else if (walletErr?.code === 'PGRST116') {
          // If no wallet exists yet, initialize it
          await supabase.from('wallets').insert({ shop_id: shop.id, balance: 0 })
          setBalance(0)
        }

        // Get payout history
        const { data: payoutHistory } = await supabase
          .from('payouts')
          .select('*')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: false })
          
        if (payoutHistory) setPayouts(payoutHistory)

      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const handleRequestPayout = async () => {
    if (!shopId) return
    const amount = parseFloat(payoutAmount)
    if (isNaN(amount) || amount <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid amount.')
    if (amount > balance) return Alert.alert('Insufficient Balance', 'You cannot request more than your available balance.')
    if (phoneNumber.length < 9) return Alert.alert('Invalid Phone', 'Please enter a valid phone number.')

    setSubmitting(true)
    try {
      // 1. Insert payout request
      const { error: payoutErr } = await supabase.from('payouts').insert({
        shop_id: shopId,
        amount,
        status: 'PENDING',
        provider,
        phone_number: phoneNumber
      })
      if (payoutErr) throw payoutErr

      // 2. Deduct from wallet balance
      const newBalance = balance - amount
      const { error: walletErr } = await supabase.from('wallets').update({ balance: newBalance }).eq('shop_id', shopId)
      if (walletErr) throw walletErr

      setBalance(newBalance)
      setIsRequesting(false)
      setPayoutAmount('')
      Alert.alert('Success', 'Your payout request has been submitted and is pending approval.')
      
      // Refresh payouts
      const { data } = await supabase.from('payouts').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
      if (data) setPayouts(data)

    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  if (!shopId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textDim }}>You don't have a shop to manage a wallet for.</Text>
      </View>
    )
  }

  const renderPayout = ({ item }: { item: Payout }) => (
    <View style={styles.payoutCard}>
      <View style={styles.payoutIcon}>
        <Ionicons 
          name={item.status === 'APPROVED' ? 'checkmark-circle' : item.status === 'REJECTED' ? 'close-circle' : 'time'} 
          size={24} 
          color={item.status === 'APPROVED' ? '#16a34a' : item.status === 'REJECTED' ? '#dc2626' : '#ea580c'} 
        />
      </View>
      <View style={styles.payoutInfo}>
        <Text style={styles.payoutTitle}>Withdrawal to {item.provider}</Text>
        <Text style={styles.payoutDate}>{new Date(item.created_at).toLocaleDateString()} • {item.status}</Text>
      </View>
      <Text style={[styles.payoutAmount, { color: item.status === 'REJECTED' ? colors.textDim : colors.text }]}>
        - TZS {item.amount.toLocaleString()}
      </Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={payouts}
        keyExtractor={item => item.id}
        renderItem={renderPayout}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>TZS {balance.toLocaleString()}</Text>
              <TouchableOpacity 
                style={[styles.requestBtn, balance <= 0 && { opacity: 0.5 }]} 
                onPress={() => setIsRequesting(true)}
                disabled={balance <= 0}
              >
                <Text style={styles.requestBtnText}>Request Payout</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.background} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Payout History</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cash-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>No payout requests yet.</Text>
          </View>
        }
      />

      {/* Payout Request Modal */}
      <Modal visible={isRequesting} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Payout</Text>
              <TouchableOpacity onPress={() => setIsRequesting(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount to Withdraw (TZS)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                placeholder={`Max: ${balance}`}
                placeholderTextColor={colors.textDim}
                value={payoutAmount}
                onChangeText={setPayoutAmount}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Provider</Text>
              <View style={styles.providerRow}>
                {['M-PESA', 'Tigo Pesa', 'Airtel Money'].map(prov => (
                  <TouchableOpacity 
                    key={prov} 
                    style={[styles.providerChip, provider === prov && styles.providerChipActive]}
                    onPress={() => setProvider(prov)}
                  >
                    <Text style={[styles.providerChipText, provider === prov && styles.providerChipTextActive]}>{prov}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Money Number</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="phone-pad" 
                placeholder="e.g. 0754... or 0713..."
                placeholderTextColor={colors.textDim}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRequestPayout} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
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
  
  listHeader: { padding: 20 },
  balanceCard: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 32,
  },
  balanceLabel: { color: '#a1a1aa', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  balanceValue: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, marginBottom: 24 },
  requestBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16,
  },
  requestBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  
  payoutCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.border,
    marginHorizontal: 20, marginBottom: 12,
    padding: 16, borderRadius: 16,
  },
  payoutIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  payoutInfo: { flex: 1 },
  payoutTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  payoutDate: { fontSize: 13, color: colors.textDim },
  payoutAmount: { fontSize: 16, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.textDim, fontSize: 15, marginTop: 12 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDim, marginBottom: 8 },
  input: {
    backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: colors.text, fontWeight: '600'
  },
  
  providerRow: { flexDirection: 'row', gap: 8 },
  providerChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: colors.border, borderWidth: 1, borderColor: 'transparent'
  },
  providerChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  providerChipText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  providerChipTextActive: { color: '#2563eb' },

  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
})
