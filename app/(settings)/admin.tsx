import { useTheme } from '../../lib/theme'
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export default function AdminShopsScreen() {
  const { colors, isDark } = useTheme()
  const { user } = useAuth()
  const supabase = createClient()
  
  const [shops, setShops] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mainSection, setMainSection] = useState<'shops' | 'disputes'>('shops')
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'terminated'>('pending')

  useEffect(() => {
    checkAdmin()
  }, [user])

  const checkAdmin = async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (data?.is_admin) {
      setIsAdmin(true)
      fetchShops()
      fetchReports()
    } else {
      setLoading(false)
    }
  }

  const fetchShops = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shops')
      .select('id, name, owner_id, status, created_at, category, city')
      .order('created_at', { ascending: false })
    
    if (data) {
      setShops(data)
      const hasPending = data.some(s => s.status === 'pending')
      if (!hasPending && data.some(s => s.status === 'active')) {
        setActiveTab('active')
      }
    }
    setLoading(false)
  }

  const fetchReports = async () => {
    const { data } = await supabase
      .from('problem_reports')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setReports(data)
  }

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    const { error } = await supabase.from('problem_reports').update({ status: newStatus }).eq('id', reportId)
    if (!error) {
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r))
      Alert.alert('Status Updated', `Report marked as ${newStatus}.`)
    }
  }

  const updateShopStatus = async (shopId: string, newStatus: string) => {
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to change this shop's status to ${newStatus.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: newStatus === 'terminated' ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase.from('shops').update({ status: newStatus }).eq('id', shopId)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setShops(prev => prev.map(s => s.id === shopId ? { ...s, status: newStatus } : s))
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="shield-half" size={64} color="#ef4444" />
        <Text style={[styles.errorText, { color: colors.text }]}>Access Denied</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const filteredShops = shops.filter(s => s.status === activeTab)

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.shopName, { color: colors.text }]}>{item.name}</Text>
        <Text style={styles.category}>{item.category} • {item.city}</Text>
      </View>
      
      <View style={styles.cardActions}>
        {activeTab === 'pending' && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => updateShopStatus(item.id, 'active')}>
              <Text style={styles.actionText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => updateShopStatus(item.id, 'terminated')}>
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        
        {activeTab === 'active' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => updateShopStatus(item.id, 'terminated')}>
            <Text style={styles.actionText}>Terminate</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'terminated' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]} onPress={() => updateShopStatus(item.id, 'active')}>
            <Text style={styles.actionText}>Reinstate</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  const renderReportItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderWidth: 1, borderColor: item.status === 'pending' ? '#ef4444' : colors.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ backgroundColor: item.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: item.status === 'pending' ? '#ef4444' : '#10b981', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
            {item.target_type} • {item.status}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.textDim }}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
        {item.reason}
      </Text>
      
      <Text style={{ fontSize: 14, color: '#3b82f6', fontWeight: '700', marginBottom: 6 }}>
        Target: {item.shop_name || item.target_name || `ID: ${item.target_id}`}
      </Text>

      {item.details ? (
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 12, fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
          "{item.details}"
        </Text>
      ) : null}

      {/* Contact Info & Full Metadata Section */}
      <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', padding: 12, borderRadius: 10, marginBottom: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>Reporter Phone:</Text>
          <TouchableOpacity onPress={() => item.reporter_phone ? Linking.openURL(`tel:${item.reporter_phone}`) : Alert.alert('Missing', 'No phone attached by reporter.')}>
            <Text style={{ color: item.reporter_phone ? '#3b82f6' : colors.textDim, fontWeight: '800', fontSize: 13 }}>
              {item.reporter_phone || 'Not Attached'} {item.reporter_phone ? '📞' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>Seller/Shop Phone:</Text>
          <TouchableOpacity onPress={() => item.seller_phone ? Linking.openURL(`tel:${item.seller_phone}`) : Alert.alert('Missing', 'No contact phone linked by seller yet.')}>
            <Text style={{ color: item.seller_phone ? '#3b82f6' : colors.textDim, fontWeight: '800', fontSize: 13 }}>
              {item.seller_phone || 'Not Linked'} {item.seller_phone ? '📞' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {item.target_metadata ? (
          <View style={{ marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
            <Text style={{ fontSize: 11, color: colors.textDim }}>
              {item.target_metadata.city ? `City: ${item.target_metadata.city} • ` : ''}
              {item.target_metadata.category ? `Cat: ${item.target_metadata.category} • ` : ''}
              {item.target_metadata.tra_tin ? `TIN: ${item.target_metadata.tra_tin}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        {item.reporter_phone ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={() => Linking.openURL(`tel:${item.reporter_phone}`)}>
            <Text style={styles.actionText}>Call Reporter</Text>
          </TouchableOpacity>
        ) : null}
        {item.seller_phone ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]} onPress={() => Linking.openURL(`tel:${item.seller_phone}`)}>
            <Text style={styles.actionText}>Call Seller</Text>
          </TouchableOpacity>
        ) : null}
        {item.status !== 'resolved' ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => updateReportStatus(item.id, 'resolved')}>
            <Text style={styles.actionText}>Resolve</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={[styles.adsBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.85}
        onPress={() => router.push('/(settings)/ads')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: 10, borderRadius: 12 }}>
              <Ionicons name="stats-chart" size={22} color="#3b82f6" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Direct Ads & Live Analytics</Text>
              <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 2 }}>View live impressions, clicks & CTR for all ads</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </View>
      </TouchableOpacity>

      {/* Top Main Section Switcher */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: mainSection === 'shops' ? colors.primary : 'transparent' }}
          onPress={() => setMainSection('shops')}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: mainSection === 'shops' ? '#fff' : colors.text }}>
            Shop Management ({shops.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: mainSection === 'disputes' ? '#ef4444' : 'transparent' }}
          onPress={() => setMainSection('disputes')}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: mainSection === 'disputes' ? '#fff' : colors.text }}>
            Disputes & Reports ({reports.filter(r => r.status === 'pending').length})
          </Text>
        </TouchableOpacity>
      </View>

      {mainSection === 'shops' ? (
        <>
          <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {(['pending', 'active', 'terminated'] as const).map(tab => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tab, activeTab === tab && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textDim }]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {' '}
                  ({shops.filter(s => s.status === tab).length})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredShops}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: colors.textDim }}>No {activeTab} shops found.</Text>
              </View>
            )}
          />
        </>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          renderItem={renderReportItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text style={{ color: colors.textDim, marginTop: 12, fontWeight: '600' }}>No pending reports or disputes.</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 24 },
  backBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  adsBanner: { margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },

  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },

  listContent: { padding: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardHeader: { marginBottom: 12 },
  shopName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  category: { fontSize: 14, color: '#71717a' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 }
})
