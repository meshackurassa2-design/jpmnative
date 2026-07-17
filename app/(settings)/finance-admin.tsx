// app/(settings)/finance-admin.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Dimensions, Platform, TextInput, ImageBackground
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { BlurView } from 'expo-blur'

const { width } = Dimensions.get('window')

export default function FinanceAdmin() {
  const { colors } = useTheme();
  const isDark = colors.background === '#000000';
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const supabase = createClient()
  
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'admob' | 'withdrawals'>('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [admobTotal, setAdmobTotal] = useState('')
  const [adminCut, setAdminCut] = useState('40')
  const [isDistributing, setIsDistributing] = useState(false)
  const [isSyncingAdmob, setIsSyncingAdmob] = useState(false)
  
  const [stats, setStats] = useState({
    totalSales: 0,
    netProfit: 0,
    shopDebt: 0,
    pendingPayouts: 0,
    voucherRevenue: 0
  })

  const fetchData = async () => {
    setLoading(true)
    const { data: wData } = await supabase
      .from('wallet_transactions')
      .select('*, profiles:profile_id(username, full_name)')
      .eq('type', 'WITHDRAWAL')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      
    if (wData) setWithdrawals(wData)
    
    if (activeTab === 'overview') {
      await fetchOverviewStats()
    }
    setLoading(false)
  }

  const fetchOverviewStats = async () => {
    const { data: ordersData } = await supabase.from('orders').select('total_amount').eq('status', 'PAID')
    const totalSales = ordersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0

    const { data: itemsData } = await supabase.from('order_items').select('price, quantity, commission_rate')
    const netProfit = itemsData?.reduce((sum, item) => sum + (item.price * item.quantity * (item.commission_rate || 0.05)), 0) || 0

    const { data: profilesData } = await supabase.from('profiles').select('wallet_balance').lt('wallet_balance', 0)
    const shopDebt = profilesData?.reduce((sum, p) => sum + Math.abs(p.wallet_balance || 0), 0) || 0

    const pendingPayouts = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0)

    const { data: voucherData } = await supabase.from('vouchers').select('coin_value').eq('is_used', true)
    const voucherRevenue = voucherData?.reduce((sum, v) => sum + (v.coin_value || 0), 0) || 0

    setStats({ totalSales, netProfit, shopDebt, pendingPayouts, voucherRevenue })
  }

  useEffect(() => { 
    fetchData() 
  }, [activeTab])

  const approveWithdrawal = async (id: string) => {
    Alert.alert(
      'Approve Withdrawal',
      'Are you sure you have sent the money? This marks the transaction as completed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          setActionLoading(id)
          const { error } = await supabase.rpc('approve_withdrawal', { p_transaction_id: id })
          if (error) Alert.alert('Error', error.message)
          else setWithdrawals(prev => prev.filter(w => w.id !== id))
          setActionLoading(null)
        }}
      ]
    )
  }

  const rejectWithdrawal = async (id: string, amount: number) => {
    Alert.alert(
      'Reject & Refund',
      `Reject and refund ${amount.toLocaleString()} TSH?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
          setActionLoading(id)
          const { error } = await supabase.rpc('reject_withdrawal', { p_transaction_id: id })
          if (error) Alert.alert('Error', error.message)
          else setWithdrawals(prev => prev.filter(w => w.id !== id))
          setActionLoading(null)
        }}
      ]
    )
  }

  const handleDistributeAdmob = async () => {
    if (!admobTotal || isNaN(Number(admobTotal)) || Number(admobTotal) <= 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid total AdMob revenue amount.');
    }
    Alert.alert(
      'Distribute Revenue',
      `You are about to distribute $${Number(admobTotal).toFixed(2)} to creators, taking a ${adminCut}% profit cut. This cannot be undone. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Distribute', style: 'destructive', onPress: async () => {
          setIsDistributing(true)
          const { data, error } = await supabase.rpc('distribute_admob_revenue', {
            p_total_revenue: Number(admobTotal),
            p_admin_cut_percentage: Number(adminCut)
          })
          setIsDistributing(false)
          
          if (error) {
            Alert.alert('Error', error.message)
          } else if (data && data.success) {
            setAdmobTotal('')
            Alert.alert(
              'Success!', 
              `Distributed $${(data.creator_pool).toFixed(2)} to ${data.creators_paid} creators for ${data.total_unpaid_views} views.\nAvg RPM: $${(data.rpm).toFixed(2)}`
            )
          } else {
            Alert.alert('Notice', data?.message || 'Something went wrong.')
          }
        }}
      ]
    )
  }

  const handleSyncAdmob = async () => {
    setIsSyncingAdmob(true)
    try {
      const { data, error } = await supabase.functions.invoke('automate-admob-payouts')
      if (error) throw error;
      
      if (data && data.success) {
        setAdmobTotal(data.admob_revenue.toString())
        Alert.alert('Data Synced', `Successfully pulled real-time earnings from Google AdMob API: $${data.admob_revenue}`)
      } else {
        throw new Error(data?.error || 'Failed to sync from Google.')
      }
    } catch (e: any) {
      Alert.alert('Sync Error', e.message)
    } finally {
      setIsSyncingAdmob(false)
    }
  }

  const renderWithdrawal = ({ item }: { item: any }) => (
    <View style={styles.glassCard}>
      <View style={styles.cardHeader}>
        <View style={styles.amountBadge}>
          <Text style={styles.cardTitle}>{Number(item.amount).toLocaleString()} TSH</Text>
        </View>
        <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      
      <View style={styles.detailsBox}>
        <View style={styles.detailRow}>
          <Ionicons name="person-circle-outline" size={20} color={colors.textDim} />
          <Text style={styles.detailText}>{item.profiles?.full_name || `@${item.profiles?.username}`}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={20} color={colors.textDim} />
          <Text style={styles.detailTextHighlight}>{item.description}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => rejectWithdrawal(item.id, Number(item.amount))} disabled={actionLoading === item.id}>
          {actionLoading === item.id ? <ActivityIndicator size="small" color="#f87171" /> : (
            <Text style={styles.btnRejectText}>Reject & Refund</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => approveWithdrawal(item.id)} disabled={actionLoading === item.id}>
          {actionLoading === item.id ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={styles.btnApproveText}>Mark as Sent</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance Admin</Text>
        <Text style={styles.headerSub}>Revenue & Payout Overview</Text>
      </View>

      <View style={styles.segmentWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentContainer}>
          <TouchableOpacity 
            style={[styles.segmentBtn, activeTab === 'overview' && styles.segmentBtnActive]} 
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.segmentText, activeTab === 'overview' && styles.segmentTextActive]}>Overview</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.segmentBtn, activeTab === 'admob' && styles.segmentBtnActive]} 
            onPress={() => setActiveTab('admob')}
          >
            <Text style={[styles.segmentText, activeTab === 'admob' && styles.segmentTextActive]}>AdMob Sync</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.segmentBtn, activeTab === 'withdrawals' && styles.segmentBtnActive]} 
            onPress={() => setActiveTab('withdrawals')}
          >
            <Text style={[styles.segmentText, activeTab === 'withdrawals' && styles.segmentTextActive]}>Payouts</Text>
            {withdrawals.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{withdrawals.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading && withdrawals.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : activeTab === 'withdrawals' ? (
        <FlatList
          data={withdrawals}
          keyExtractor={item => item.id}
          renderItem={renderWithdrawal}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="checkmark-done-circle" size={56} color="#10b981" />
              </View>
              <Text style={styles.emptyText}>All Caught Up</Text>
              <Text style={styles.emptySub}>No pending payout requests at the moment.</Text>
            </View>
          }
        />
      ) : activeTab === 'admob' ? (
        <ScrollView contentContainerStyle={styles.overviewContainer} showsVerticalScrollIndicator={false}>
          
          {/* ADMOB PREMIUM HERO CARD */}
          <View style={styles.premiumCard}>
            <View style={styles.cardHeader}>
              <View style={styles.userRow}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.primary }]}>
                  <Ionicons name="logo-google" size={24} color="#fff" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Google AdMob API</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <View style={styles.liveIndicator} />
                    <Text style={[styles.cardSub, { marginTop: 0, color: '#10b981' }]}>Live Connection active</Text>
                  </View>
                </View>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.inputLabel}>Pulled Revenue (USD)</Text>
              <TouchableOpacity onPress={handleSyncAdmob} disabled={isSyncingAdmob} style={styles.syncBtn}>
                {isSyncingAdmob ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="cloud-download" size={16} color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 12 }}>SYNC DATA</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.currencyInputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
                value={admobTotal}
                onChangeText={setAdmobTotal}
              />
            </View>
            
            <Text style={[styles.inputLabel, { marginTop: 24 }]}>Platform Cut (%)</Text>
            <View style={styles.currencyInputWrapper}>
              <Text style={styles.currencySymbol}>%</Text>
              <TextInput
                style={styles.currencyInput}
                placeholder="40"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
                value={adminCut}
                onChangeText={setAdminCut}
              />
            </View>
            
            <View style={styles.infoBox}>
              <Ionicons name="stats-chart" size={24} color={colors.primary} />
              <Text style={[styles.infoText, { flex: 1, marginLeft: 12 }]}>
                This system pulls real Google AdMob earnings and dynamically calculates RPM. It will disburse funds to creators based on their valid impressions.
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.btn, styles.distributeBtn]} 
              onPress={handleDistributeAdmob} 
              disabled={isDistributing}
            >
              {isDistributing ? <ActivityIndicator size="small" color="#fff" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={styles.btnApproveText}>DISTRIBUTE REVENUE</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.overviewContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.gridContainer}>
            {/* Main Highlight: Net Profit */}
            <View style={[styles.premiumCard, styles.gridItemLarge]}>
               <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                 <View>
                   <Text style={styles.statLabel}>Total Net Profit</Text>
                   <Text style={styles.statValue}>{stats.netProfit.toLocaleString()}</Text>
                 </View>
                 <View style={[styles.iconWrapper, { width: 56, height: 56, borderRadius: 16 }]}>
                   <Ionicons name="trending-up" size={28} color={colors.primary} />
                 </View>
               </View>
               <Text style={styles.statCurrency}>TANZANIAN SHILLINGS (TSH)</Text>
            </View>

            {/* Total Sales */}
            <View style={[styles.premiumCard, styles.gridItem]}>
              <View style={styles.iconWrapper}>
                <Ionicons name="cart" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statLabel}>Gross Sales</Text>
              <Text style={styles.statValue}>{stats.totalSales.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Vouchers */}
            <View style={[styles.premiumCard, styles.gridItem]}>
              <View style={styles.iconWrapper}>
                <Ionicons name="ticket" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statLabel}>Voucher Revenue</Text>
              <Text style={styles.statValue}>{stats.voucherRevenue.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Shop Debt */}
            <View style={[styles.premiumCard, styles.gridItem]}>
              <View style={styles.iconWrapper}>
                <Ionicons name="warning" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statLabel}>Shop Debt Owed</Text>
              <Text style={styles.statValue}>{stats.shopDebt.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Pending Payouts */}
            <View style={[styles.premiumCard, styles.gridItem]}>
              <View style={styles.iconWrapper}>
                <Ionicons name="time" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statLabel}>Pending Payouts</Text>
              <Text style={styles.statValue}>{stats.pendingPayouts.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textDim, marginTop: 4 },

  segmentWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  segmentContainer: { flexDirection: 'row', gap: 8 },
  segmentBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  segmentBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  segmentTextActive: { color: colors.background },
  
  badge: { marginLeft: 6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  list: { padding: 20, gap: 12, paddingBottom: 60 },
  
  glassCard: { 
    backgroundColor: colors.card,
    borderRadius: 16, padding: 16, 
    borderWidth: 1, borderColor: colors.border,
  },
  
  premiumCard: {
    backgroundColor: colors.card,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountBadge: { },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  timeText: { fontSize: 12, color: colors.textDim },
  
  detailsBox: { gap: 8, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: colors.textDim },
  detailTextHighlight: { fontSize: 14, color: colors.text, fontWeight: '500' },
  
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 16 },

  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnApprove: { backgroundColor: colors.primary },
  btnApproveText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnReject: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444' },
  btnRejectText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  emptySub: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  overviewContainer: { padding: 20, paddingBottom: 60 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  
  gridItem: { width: (width - 52) / 2, padding: 16 },
  gridItemLarge: { width: '100%', paddingVertical: 20, paddingHorizontal: 20 },
  
  iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statLabel: { fontSize: 12, color: colors.textDim, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  statCurrency: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardSub: { fontSize: 13, color: colors.textDim, marginTop: 4 },
  
  liveIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 },
  
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textDim, marginBottom: 8 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  
  currencyInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  currencySymbol: { fontSize: 18, color: colors.textDim, marginRight: 8 },
  currencyInput: { flex: 1, paddingVertical: 16, fontSize: 20, color: colors.text },
  
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 12, marginTop: 24, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  infoText: { fontSize: 14, lineHeight: 20, color: colors.text },
  
  distributeBtn: { backgroundColor: colors.primary, marginTop: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center' }
})
