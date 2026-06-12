// app/(settings)/marketplace-admin.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'active' | 'rejected'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchShops = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('shops')
      .select('*, profiles:owner_id(username, full_name)')
      .order('created_at', { ascending: false })
    setShops(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchShops() }, [])

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

  const filtered = shops.filter(s => s.status === filter)

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
          <TouchableOpacity 
            style={[styles.btn, styles.btnApprove]} 
            onPress={() => approve(item.id)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? <ActivityIndicator size="small" color="#16a34a" /> : <Text style={styles.btnApproveText}>Approve</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.btn, styles.btnReject]} 
            onPress={() => reject(item.id)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? <ActivityIndicator size="small" color="#dc2626" /> : <Text style={styles.btnRejectText}>Reject</Text>}
          </TouchableOpacity>
        </View>
      )}

      {filter === 'rejected' && item.rejection_reason && (
        <Text style={styles.rejectedReason}>Reason: {item.rejection_reason}</Text>
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
        <TouchableOpacity style={[styles.tab, filter === 'rejected' && styles.tabActive]} onPress={() => setFilter('rejected')}>
          <Text style={[styles.tabText, filter === 'rejected' && styles.tabTextActive]}>Rejected</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderShop}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color="#d4d4d8" />
              <Text style={styles.emptyText}>No {filter} shops.</Text>
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
  card: { backgroundColor: colors.background, borderRadius: 12, padding: 16, elevation: 2, shadowColor: colors.text, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { height: 2, width: 0 } },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardDesc: { fontSize: 14, color: '#3f3f46', marginBottom: 12, lineHeight: 20 },
  cardMeta: { fontSize: 12, color: colors.textDim },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  btnApprove: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  btnApproveText: { color: '#16a34a', fontWeight: '700' },
  btnReject: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  btnRejectText: { color: '#dc2626', fontWeight: '700' },
  rejectedReason: { marginTop: 12, padding: 10, backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText: { color: colors.textDim, fontSize: 16 },
})


