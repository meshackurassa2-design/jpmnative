// app/(settings)/marketplace-admin.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, ScrollView
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'

export default function MarketplaceAdmin() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  
  const [shops, setShops] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'active' | 'vouchers'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [voucherAmount, setVoucherAmount] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const [shopsRes, vouchersRes] = await Promise.all([
      supabase.from('shops').select('*, profiles:owner_id(username, full_name)').order('created_at', { ascending: false }),
      supabase.from('vouchers').select('*').order('created_at', { ascending: false })
    ])
    
    if (shopsRes.data) setShops(shopsRes.data)
    if (vouchersRes.data) setVouchers(vouchersRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const approve = async (id: string) => {
    setActionLoading(id)
    await supabase.from('shops').update({ status: 'active', rejection_reason: null }).eq('id', id)
    setShops(prev => prev.map(s => s.id === id ? { ...s, status: 'active' } : s))
    setActionLoading(null)
  }

  const reject = async (id: string) => {
    setActionLoading(id)
    await supabase.from('shops').update({ status: 'rejected', rejection_reason: 'Does not meet marketplace requirements.' }).eq('id', id)
    setShops(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s))
    setActionLoading(null)
  }

  const generateVoucher = async () => {
    const amt = parseInt(voucherAmount)
    if (isNaN(amt) || amt <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid TSH amount.')
    
    setActionLoading('voucher')
    try {
      const code = `DAPAZ-${Math.floor(Math.random() * 90000) + 10000}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
      const { data, error } = await supabase.from('vouchers').insert({ code, amount_tsh: amt }).select().single()
      if (error) throw error
      
      setVouchers([data, ...vouchers])
      setVoucherAmount('')
      Alert.alert('Success', `Voucher Generated!\n\nCode: ${code}\nAmount: ${amt} TSH`)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredShops = shops.filter(s => s.status === filter)

  const renderShop = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>by @{item.profiles?.username || 'user'}</Text>
      </View>
      <Text style={styles.cardDesc}>{item.description}</Text>
      <Text style={styles.cardMeta}>Applied: {new Date(item.created_at).toLocaleDateString()}</Text>

      {filter === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => approve(item.id)} disabled={actionLoading === item.id}>
            {actionLoading === item.id ? <ActivityIndicator size="small" color="#16a34a" /> : <Text style={styles.btnApproveText}>Approve</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => reject(item.id)} disabled={actionLoading === item.id}>
            {actionLoading === item.id ? <ActivityIndicator size="small" color="#dc2626" /> : <Text style={styles.btnRejectText}>Reject</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  const renderVoucher = ({ item }: { item: any }) => (
    <View style={[styles.card, item.is_redeemed ? styles.cardRedeemed : null]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { letterSpacing: 1 }]}>{item.code}</Text>
        <Text style={[styles.cardMeta, { color: item.is_redeemed ? '#dc2626' : '#16a34a', fontWeight: 'bold' }]}>
          {item.is_redeemed ? 'Redeemed' : 'Active'}
        </Text>
      </View>
      <Text style={styles.voucherAmount}>{item.amount_tsh.toLocaleString()} TSH</Text>
      <Text style={styles.cardMeta}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
      {item.is_redeemed && (
        <Text style={styles.cardMeta}>Redeemed by: {item.redeemed_by}</Text>
      )}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, filter === 'pending' && styles.tabActive]} onPress={() => setFilter('pending')}>
          <Text style={[styles.tabText, filter === 'pending' && styles.tabTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filter === 'active' && styles.tabActive]} onPress={() => setFilter('active')}>
          <Text style={[styles.tabText, filter === 'active' && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filter === 'vouchers' && styles.tabActive]} onPress={() => setFilter('vouchers')}>
          <Text style={[styles.tabText, filter === 'vouchers' && styles.tabTextActive]}>Vouchers</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>
      ) : filter === 'vouchers' ? (
        <FlatList
          data={vouchers}
          keyExtractor={item => item.id}
          renderItem={renderVoucher}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.generatorBox}>
              <Text style={styles.generatorTitle}>Generate Airtel Money Voucher</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Amount in TSH (e.g. 5000)"
                keyboardType="numeric"
                value={voucherAmount}
                onChangeText={setVoucherAmount}
                placeholderTextColor={colors.textDim}
              />
              <TouchableOpacity style={styles.generateBtn} onPress={generateVoucher} disabled={actionLoading === 'voucher'}>
                {actionLoading === 'voucher' ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generate Code</Text>}
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredShops}
          keyExtractor={item => item.id}
          renderItem={renderShop}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color={colors.textDim} />
              <Text style={styles.emptyText}>No shops found.</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: colors.text },
  list: { padding: 16, gap: 16 },
  
  card: { backgroundColor: colors.background, borderRadius: 12, padding: 16, elevation: 2 },
  cardRedeemed: { opacity: 0.7, backgroundColor: '#f9fafb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardDesc: { fontSize: 14, color: '#3f3f46', marginBottom: 12, lineHeight: 20 },
  cardMeta: { fontSize: 12, color: colors.textDim },
  
  voucherAmount: { fontSize: 24, fontWeight: '900', color: '#c026d3', marginBottom: 8 },

  generatorBox: { backgroundColor: colors.background, padding: 20, borderRadius: 16, marginBottom: 20 },
  generatorTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: colors.text },
  input: { backgroundColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  generateBtn: { backgroundColor: '#c026d3', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  btnApprove: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  btnApproveText: { color: '#16a34a', fontWeight: '700' },
  btnReject: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  btnRejectText: { color: '#dc2626', fontWeight: '700' },
  
  empty: { flex: 1, alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText: { color: colors.textDim, fontSize: 16 },
})
