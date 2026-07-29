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
  const [contentReports, setContentReports] = useState<any[]>([])
  const [verifications, setVerifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mainSection, setMainSection] = useState<'shops' | 'disputes' | 'content' | 'verifications'>('shops')
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
      fetchContentReports()
      fetchVerifications()
    } else {
      setLoading(false)
    }
  }

  const fetchShops = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shops')
      .select('id, name, owner_id, status, created_at, category, city, tin_cert_url, tra_tin')
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

  const fetchContentReports = async () => {
    const { data } = await supabase
      .from('content_reports')
      .select('*, posts(*, profiles(*))')
      .order('created_at', { ascending: false })
    if (data) setContentReports(data)
  }

  const fetchVerifications = async () => {
    const { data } = await supabase
      .from('verification_requests')
      .select('*, profiles(username, full_name, avatar_url)')
      .order('created_at', { ascending: false })
    if (data) setVerifications(data)
  }

  const approveVerification = async (reqId: string, userId: string) => {
    const { error } = await supabase.from('verification_requests').update({ status: 'approved' }).eq('id', reqId)
    if (!error) {
      await supabase.from('profiles').update({ is_verified: true }).eq('id', userId)
      setVerifications(prev => prev.map(v => v.id === reqId ? { ...v, status: 'approved' } : v))
      Alert.alert('Approved', 'User has been verified.')
    }
  }

  const rejectVerification = async (reqId: string) => {
    const { error } = await supabase.from('verification_requests').update({ status: 'rejected' }).eq('id', reqId)
    if (!error) {
      setVerifications(prev => prev.map(v => v.id === reqId ? { ...v, status: 'rejected' } : v))
      Alert.alert('Rejected', 'Verification request rejected.')
    }
  }

  const dismissContentReport = async (reportId: string) => {
    const { error } = await supabase.from('content_reports').update({ status: 'dismissed' }).eq('id', reportId)
    if (!error) {
      setContentReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r))
      Alert.alert('Dismissed', 'Report dismissed successfully.')
    }
  }

  const deleteReportedPost = async (postId: string, reportId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to permanently delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('posts').delete().eq('id', postId)
            if (!error) {
              await supabase.from('content_reports').update({ status: 'resolved' }).eq('id', reportId)
              setContentReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r))
              Alert.alert('Deleted', 'Post deleted and report resolved.')
            } else {
              Alert.alert('Error', error.message)
            }
          }
        }
      ]
    )
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
        {item.tra_tin && <Text style={{ fontSize: 13, color: colors.textDim, marginTop: 2 }}>TIN: {item.tra_tin}</Text>}
        {item.tin_cert_url && (
          <TouchableOpacity style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => Linking.openURL(item.tin_cert_url)}>
            <Ionicons name="document-text-outline" size={16} color="#3b82f6" />
            <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '700' }}>View TIN Certificate</Text>
          </TouchableOpacity>
        )}
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

  const renderContentReportItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderWidth: 1, borderColor: item.status === 'pending' ? '#ef4444' : colors.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ backgroundColor: item.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: item.status === 'pending' ? '#ef4444' : '#10b981', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
            Flagged Post • {item.status}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.textDim }}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '800', color: '#ef4444', marginBottom: 8 }}>
        Reason: {item.reason}
      </Text>
      
      {item.posts ? (
        <View style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
            Posted by: {item.posts.profiles?.full_name || 'Unknown User'} (@{item.posts.profiles?.username || 'unknown'})
          </Text>
          <Text style={{ fontSize: 14, color: colors.text }}>{item.posts.content}</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: colors.textDim, fontStyle: 'italic' }}>Post has already been deleted.</Text>
        </View>
      )}

      {item.status === 'pending' && item.posts && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.border }]} onPress={() => dismissContentReport(item.id)}>
            <Text style={[styles.actionText, { color: colors.text }]}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => deleteReportedPost(item.posts.id, item.id)}>
            <Text style={styles.actionText}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  const renderVerificationItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderWidth: 1, borderColor: item.status === 'pending' ? '#3b82f6' : colors.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ backgroundColor: item.status === 'pending' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: item.status === 'pending' ? '#3b82f6' : '#10b981', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
            {item.status}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.textDim }}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 }}>
        {item.first_name ? `${item.first_name} ${item.last_name}` : item.profiles?.full_name} {item.known_as ? `(${item.known_as})` : ''}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontWeight: '600', marginBottom: 4 }}>
        @{item.profiles?.username}
      </Text>
      {item.category && (
        <Text style={{ fontSize: 14, color: '#8b5cf6', fontWeight: '700', marginBottom: 8 }}>
          Category: {item.category}
        </Text>
      )}

      {item.reason ? (
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 12, fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
          "{item.reason}"
        </Text>
      ) : null}

      <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', padding: 12, borderRadius: 10, marginBottom: 12, gap: 6 }}>
        <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>Documents & Links:</Text>
        {item.document_url ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.document_url)}>
            <Text style={{ color: '#3b82f6', fontWeight: '800', fontSize: 13 }}>📄 View ID Document</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: colors.textDim, fontSize: 13 }}>No document provided</Text>
        )}
        
        {item.links && item.links.length > 0 && item.links.map((link: string, idx: number) => (
          <TouchableOpacity key={idx} onPress={() => Linking.openURL(link.startsWith('http') ? link : `https://${link}`)}>
            <Text style={{ color: '#3b82f6', fontSize: 13, marginTop: 4 }}>🔗 {link}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {item.status === 'pending' && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => approveVerification(item.id, item.user_id)}>
            <Text style={styles.actionText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => rejectVerification(item.id)}>
            <Text style={styles.actionText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
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
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: mainSection === 'shops' ? colors.primary : 'transparent' }}
          onPress={() => setMainSection('shops')}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', textAlign: 'center', color: mainSection === 'shops' ? '#fff' : colors.text }}>
            Shops
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: mainSection === 'disputes' ? '#ef4444' : 'transparent' }}
          onPress={() => setMainSection('disputes')}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', textAlign: 'center', color: mainSection === 'disputes' ? '#fff' : colors.text }}>
            Reports
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: mainSection === 'content' ? '#f59e0b' : 'transparent' }}
          onPress={() => setMainSection('content')}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', textAlign: 'center', color: mainSection === 'content' ? '#fff' : colors.text }}>
            Posts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: mainSection === 'verifications' ? '#3b82f6' : 'transparent' }}
          onPress={() => setMainSection('verifications')}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', textAlign: 'center', color: mainSection === 'verifications' ? '#fff' : colors.text }}>
            Verify ({verifications.filter(v => v.status === 'pending').length})
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
      ) : mainSection === 'disputes' ? (
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
      ) : mainSection === 'content' ? (
        <FlatList
          data={contentReports}
          keyExtractor={item => item.id}
          renderItem={renderContentReportItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text style={{ color: colors.textDim, marginTop: 12, fontWeight: '600' }}>No flagged posts.</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={verifications}
          keyExtractor={item => item.id}
          renderItem={renderVerificationItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text style={{ color: colors.textDim, marginTop: 12, fontWeight: '600' }}>No verification requests.</Text>
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
