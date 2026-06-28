// app/(settings)/finance-admin.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Dimensions, Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'

const { width } = Dimensions.get('window')

export default function FinanceAdmin() {
  const { colors } = useTheme();
  const isDark = colors.background === '#000000';
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const supabase = createClient()
  
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'overview'>('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
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

  const renderWithdrawal = ({ item }: { item: any }) => (
    <View style={styles.card}>
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
        <Text style={styles.headerTitle}>Finance HQ</Text>
        <Text style={styles.headerSub}>Manage revenue and payouts securely.</Text>
      </View>

      <View style={styles.segmentContainer}>
        <TouchableOpacity 
          style={[styles.segmentBtn, activeTab === 'overview' && styles.segmentBtnActive]} 
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons name="pie-chart" size={16} color={activeTab === 'overview' ? '#fff' : colors.textDim} />
          <Text style={[styles.segmentText, activeTab === 'overview' && styles.segmentTextActive]}>Overview</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.segmentBtn, activeTab === 'withdrawals' && styles.segmentBtnActive]} 
          onPress={() => setActiveTab('withdrawals')}
        >
          <Ionicons name="cash" size={16} color={activeTab === 'withdrawals' ? '#fff' : colors.textDim} />
          <Text style={[styles.segmentText, activeTab === 'withdrawals' && styles.segmentTextActive]}>Requests ({withdrawals.length})</Text>
        </TouchableOpacity>
      </View>

      {loading && withdrawals.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>
      ) : activeTab === 'withdrawals' ? (
        <FlatList
          data={withdrawals}
          keyExtractor={item => item.id}
          renderItem={renderWithdrawal}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="wallet" size={48} color="#10b981" />
              </View>
              <Text style={styles.emptyText}>Inbox Zero!</Text>
              <Text style={styles.emptySub}>No pending withdrawal requests.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.overviewContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.gridContainer}>
            {/* Net Profit - Main Highlight */}
            <View style={[styles.gridItem, styles.gridItemLarge]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="trending-up" size={24} color="#10b981" />
              </View>
              <Text style={styles.statLabel}>Total Net Profit</Text>
              <Text style={[styles.statValue, { color: '#10b981', fontSize: 32 }]}>{stats.netProfit.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Total Sales */}
            <View style={styles.gridItem}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="cart" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.statLabel}>Gross Sales</Text>
              <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.totalSales.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Shop Debt */}
            <View style={styles.gridItem}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="warning" size={20} color="#ef4444" />
              </View>
              <Text style={styles.statLabel}>Shop Debt (Owed)</Text>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.shopDebt.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Voucher Revenue */}
            <View style={styles.gridItem}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="ticket" size={20} color="#8b5cf6" />
              </View>
              <Text style={styles.statLabel}>Voucher Revenue</Text>
              <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{stats.voucherRevenue.toLocaleString()}</Text>
              <Text style={styles.statCurrency}>TSH</Text>
            </View>

            {/* Pending Payouts */}
            <View style={[styles.gridItem, { width: '100%' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Ionicons name="time" size={24} color="#f59e0b" />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.statLabel}>Pending Payouts</Text>
                    <Text style={[styles.statValue, { color: '#f59e0b', fontSize: 28 }]}>{stats.pendingPayouts.toLocaleString()} <Text style={{ fontSize: 16 }}>TSH</Text></Text>
                  </View>
                </View>
                {stats.pendingPayouts > 0 && (
                  <TouchableOpacity style={styles.payBtn} onPress={() => setActiveTab('withdrawals')}>
                    <Text style={styles.payBtnText}>Pay Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#09090b' : '#f4f4f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  headerSub: { fontSize: 15, color: colors.textDim, marginTop: 4 },

  segmentContainer: { flexDirection: 'row', backgroundColor: isDark ? '#18181b' : '#e4e4e7', marginHorizontal: 24, borderRadius: 16, padding: 4, marginBottom: 8 },
  segmentBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 },
  segmentBtnActive: { backgroundColor: isDark ? '#27272a' : '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.textDim },
  segmentTextActive: { color: colors.text },

  list: { padding: 24, gap: 16 },
  
  card: { backgroundColor: isDark ? '#18181b' : '#ffffff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountBadge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#10b981', letterSpacing: -0.5 },
  timeText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  
  detailsBox: { gap: 12, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  detailTextHighlight: { fontSize: 15, color: colors.text, fontWeight: '800' },
  
  divider: { height: 1, backgroundColor: colors.border, borderStyle: 'dashed', marginBottom: 16 },

  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnApprove: { backgroundColor: '#10b981' },
  btnApproveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnReject: { backgroundColor: isDark ? '#27272a' : '#f4f4f5' },
  btnRejectText: { color: '#f87171', fontWeight: '700', fontSize: 15 },
  
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyText: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  emptySub: { color: colors.textDim, fontSize: 15 },

  overviewContainer: { padding: 24, paddingBottom: 40 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  
  gridItem: { width: '47%', backgroundColor: isDark ? '#18181b' : '#ffffff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  gridItemLarge: { width: '100%', paddingVertical: 24 },
  
  iconWrapper: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statLabel: { fontSize: 13, color: colors.textDim, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  statCurrency: { fontSize: 14, fontWeight: '800', color: colors.textDim, marginTop: 2 },
  
  payBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
