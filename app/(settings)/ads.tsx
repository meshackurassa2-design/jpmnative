import { getCdnUrl } from '../../lib/cdn';
// app/(settings)/ads.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { router, useFocusEffect } from 'expo-router'
import { Skeleton } from '../../components/Skeleton'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [ads, setAds] = useState<any[]>([])
  const [creators, setCreators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ads' | 'create' | 'creators'>('ads')

  // Check admin status on mount
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(!!data?.is_admin))
  }, [user])

  // Ad Form State
  const [adTitle, setAdTitle] = useState('')
  const [adDesc, setAdDesc] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [maxImpressions, setMaxImpressions] = useState('')
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [postingAd, setPostingAd] = useState(false)
  const [editingAdId, setEditingAdId] = useState<string | null>(null)

  const fetchData = async () => {
    if (activeTab === 'create') return
    setLoading(true)
    if (activeTab === 'ads') {
      const { data } = await supabase.from('direct_ads').select('*').order('created_at', { ascending: false })
      setAds(data || [])
    } else if (activeTab === 'creators') {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, settings, updated_at')
      
      if (error) {
        console.error('Error fetching creators:', error)
      }
      
      if (data) {
        const pending = data.filter(p => {
          if (!p.settings) return false;
          // Supabase sometimes returns json as a string if not properly configured as JSONB
          let settingsObj = p.settings;
          if (typeof settingsObj === 'string') {
            try {
              settingsObj = JSON.parse(settingsObj);
            } catch (e) {
              return false;
            }
          }
          return settingsObj.creator_application_status === 'pending';
        })
        setCreators(pending)
      } else {
        setCreators([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    const channel = supabase.channel(`direct_ads_live_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_ads' }, () => {
        if (activeTab === 'ads') fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        if (activeTab === 'creators') fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTab, isAdmin])

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [activeTab, isAdmin])
  )

  // Block access if not admin — these are rendered in the JSX below, NOT as early returns before hooks

  const handleCreatorAction = async (creatorId: string, action: 'approved' | 'declined') => {
    const { data: profileData } = await supabase.from('profiles').select('settings').eq('id', creatorId).single()
    const newSettings = { ...profileData?.settings, creator_application_status: action }
    const updates: any = { settings: newSettings }
    if (action === 'approved') {
      updates.monetization_enabled = true
      updates.is_verified = true
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', creatorId)
    if (!error) {
      Alert.alert('Success', `Creator ${action} successfully!`)
      fetchData()
    } else {
      Alert.alert('Error', error.message)
    }
  }

  const deleteAd = async (id: string) => {
    Alert.alert('Delete Ad', 'Are you sure you want to delete this ad?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          // Remove from UI immediately (optimistic)
          setAds(prev => prev.filter(a => a.id !== id))
          const { error } = await supabase.from('direct_ads').delete().eq('id', id)
          if (error) {
            Alert.alert('Delete Failed', error.message)
            // Restore list from server
            fetchData()
          }
        }
      }
    ])
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    })
    if (!result.canceled) setImage(result.assets[0])
  }

  const startEditingAd = (item: any) => {
    setEditingAdId(item.id);
    setAdTitle(item.title || '');
    setAdDesc(item.description || '');
    setTargetUrl(item.target_url || '');
    setMaxImpressions(item.max_impressions && item.max_impressions > 0 ? String(item.max_impressions) : '');
    if (item.image_url) {
      setImage({ uri: getCdnUrl(item.image_url) } as any);
    } else {
      setImage(null);
    }
    setActiveTab('create');
  };

  const cancelEditing = () => {
    setEditingAdId(null);
    setAdTitle(''); setAdDesc(''); setTargetUrl(''); setMaxImpressions(''); setImage(null);
    setActiveTab('ads');
  };

  const handlePostAd = async () => {
    if (!adTitle.trim()) {
      Alert.alert('Missing Info', 'Please add an Ad Title.')
      return
    }
    if (!image && !editingAdId) {
      Alert.alert('Missing Image', 'Please select an Ad Image.')
      return
    }
    if (!targetUrl.trim()) {
      Alert.alert('Missing Link URL', 'Please add a Link URL for your ad (e.g. https://yourshop.com).')
      return
    }

    setPostingAd(true)
    try {
      let imageUrl = editingAdId ? (image?.uri?.startsWith('http') ? image.uri : null) : null
      if (image?.base64) {
        const ext = image.uri.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}_${Math.random()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('ads')
          .upload(fileName, decode(image.base64), { contentType: `image/${ext}` })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('ads').getPublicUrl(fileName)
        imageUrl = urlData?.publicUrl
      }

      const maxImpsNum = parseInt(maxImpressions, 10);
      const adPayload: any = {
        title: adTitle.trim(),
        description: adDesc.trim() || null,
        target_url: targetUrl.trim(),
        max_impressions: !isNaN(maxImpsNum) && maxImpsNum > 0 ? maxImpsNum : 0,
      }
      if (imageUrl) {
        adPayload.image_url = imageUrl;
      }

      if (editingAdId) {
        const { error } = await supabase.from('direct_ads').update(adPayload).eq('id', editingAdId)
        if (error) throw error
        Alert.alert('🎉 Ad Updated!', 'Your changes have been saved successfully.')
      } else {
        const { error } = await supabase.from('direct_ads').insert(adPayload)
        if (error) throw error
        Alert.alert('🎉 Ad Launched!', 'Your ad is now live in the feed.')
      }

      setEditingAdId(null)
      setAdTitle(''); setAdDesc(''); setTargetUrl(''); setMaxImpressions(''); setImage(null)
      fetchData()
      setActiveTab('ads')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setPostingAd(false)
    }
  }

  const totalImpressions = ads.reduce((acc, ad) => acc + (ad.impressions || 0), 0)
  const totalClicks = ads.reduce((acc, ad) => acc + (ad.clicks || 0), 0)
  const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0'

  const renderAd = ({ item }: { item: any }) => {
    const imps = item.impressions || 0;
    const clks = item.clicks || 0;
    const ctr = imps > 0 ? ((clks / imps) * 100).toFixed(1) : '0.0';
    const maxImps = item.max_impressions || 0;
    const capReached = maxImps > 0 && imps >= maxImps;
    const progressPct = maxImps > 0 ? Math.min(100, Math.round((imps / maxImps) * 100)) : 0;
    
    return (
      <View style={styles.adCard}>
        {item.image_url && (
          <Image source={{ uri: getCdnUrl(item.image_url) }} style={styles.adCardImage} resizeMode="cover" />
        )}
        <View style={styles.adCardBody}>
          <View style={styles.adCardRow}>
            <Text style={styles.adCardTitle} numberOfLines={1}>{item.title}</Text>
            {capReached ? (
              <View style={[styles.liveTag, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={[styles.liveTagText, { color: '#ef4444' }]}>CAP REACHED</Text>
              </View>
            ) : (
              <View style={styles.liveTag}><Text style={styles.liveTagText}>LIVE</Text></View>
            )}
          </View>
          {!!item.description && <Text style={styles.adCardDesc} numberOfLines={2}>{item.description}</Text>}
          
          {/* Target Destination Preview */}
          {!!item.target_url && (
            <View style={styles.targetRow}>
              <Ionicons name="link-outline" size={13} color="#3b82f6" />
              <Text style={styles.targetUrlText} numberOfLines={1}>{item.target_url}</Text>
            </View>
          )}

          {/* Impression Cap Progress Bar */}
          {maxImps > 0 && (
            <View style={styles.capContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.capLabel}>Impression Cap Progress</Text>
                <Text style={[styles.capText, capReached && { color: '#ef4444', fontWeight: '800' }]}>
                  {imps.toLocaleString()} / {maxImps.toLocaleString()} ({progressPct}%)
                </Text>
              </View>
              <View style={styles.capBarBg}>
                <View style={[styles.capBarFill, { width: `${progressPct}%`, backgroundColor: capReached ? '#ef4444' : '#3b82f6' }]} />
              </View>
            </View>
          )}

          {/* Real Engagement Analytics Row */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricBox}>
              <Ionicons name="eye-outline" size={16} color="#a1a1aa" />
              <View style={{ marginLeft: 6 }}>
                <Text style={styles.metricValue}>{imps.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Impressions</Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Ionicons name="hand-right-outline" size={16} color="#a1a1aa" />
              <View style={{ marginLeft: 6 }}>
                <Text style={styles.metricValue}>{clks.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Clicks</Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Ionicons name="trending-up-outline" size={16} color="#10b981" />
              <View style={{ marginLeft: 6 }}>
                <Text style={[styles.metricValue, { color: '#10b981' }]}>{ctr}%</Text>
                <Text style={styles.metricLabel}>CTR</Text>
              </View>
            </View>
          </View>

          <View style={styles.adActionsRow}>
            <View style={styles.pushedTag}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={styles.pushedTagText}>Pushed via Direct Feed</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.editBtn} onPress={() => startEditingAd(item)}>
                <Ionicons name="create-outline" size={14} color="#3b82f6" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteAd(item.id)}>
                <Ionicons name="trash-outline" size={14} color="#dc2626" />
                <Text style={styles.deleteText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCreator = ({ item }: { item: any }) => (
    <View style={styles.creatorCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {item.avatar_url ? (
          <Image source={{ uri: getCdnUrl(item.avatar_url) }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={{ color: colors.textDim, fontWeight: '700' }}>{item.username?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.creatorName}>{item.full_name}</Text>
          <Text style={styles.creatorHandle}>@{item.username}</Text>
        </View>
      </View>
      <View style={styles.creatorActions}>
        <TouchableOpacity style={styles.btnDecline} onPress={() => handleCreatorAction(item.id, 'declined')}>
          <Text style={styles.btnDeclineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnApprove} onPress={() => handleCreatorAction(item.id, 'approved')}>
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.btnApproveText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Admin Guard */}
      {isAdmin === null ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      ) : isAdmin === false ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="lock-closed" size={48} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>Admin Only</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 8, textAlign: 'center' }}>You do not have permission to access Ads Management.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: '#18181b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['ads', 'create', 'creators'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              if (tab === 'create' && activeTab !== 'create') {
                setEditingAdId(null);
                setAdTitle(''); setAdDesc(''); setTargetUrl(''); setMaxImpressions(''); setImage(null);
              }
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'ads' ? 'Active Ads' : tab === 'create' ? (editingAdId ? 'Edit Ad' : '+ Create Ad') : 'Waitlist'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CREATE AD */}
      {activeTab === 'create' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            {/* Image picker - top and prominent */}
            <TouchableOpacity style={styles.imagePickerArea} onPress={pickImage} activeOpacity={0.85}>
              {image ? (
                <Image source={{ uri: getCdnUrl(image.uri) }} style={styles.imagePickerPreview} resizeMode="cover" />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Ionicons name="image-outline" size={40} color={colors.textDim} />
                  <Text style={styles.imagePickerLabel}>Tap to add Ad Image</Text>
                  <Text style={styles.imagePickerSub}>Square or 4:5 recommended</Text>
                </View>
              )}
              {image && (
                <View style={styles.imageEditBadge}>
                  <Ionicons name="pencil" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.formBody}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.formSectionTitle, { marginBottom: 0 }]}>{editingAdId ? 'Edit Ad Details' : 'Ad Details'}</Text>
                {editingAdId && (
                  <TouchableOpacity onPress={cancelEditing} style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textDim }}>Cancel Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Ad Title <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Summer Sale — 50% Off"
                placeholderTextColor="#a1a1aa"
                value={adTitle}
                onChangeText={setAdTitle}
                maxLength={80}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Short tagline or offer details..."
                placeholderTextColor="#a1a1aa"
                value={adDesc}
                onChangeText={setAdDesc}
                multiline
                numberOfLines={3}
                maxLength={200}
              />

              <Text style={styles.label}>Link URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://your-website.com"
                placeholderTextColor="#a1a1aa"
                value={targetUrl}
                onChangeText={setTargetUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Max Impressions Cap (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000 (Leave blank or 0 for Unlimited)"
                placeholderTextColor="#a1a1aa"
                value={maxImpressions}
                onChangeText={setMaxImpressions}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.launchBtn, (!adTitle.trim() || (!image && !editingAdId)) && styles.launchBtnDisabled]}
                onPress={handlePostAd}
                disabled={postingAd || !adTitle.trim() || (!image && !editingAdId)}
                activeOpacity={0.85}
              >
                {postingAd ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={editingAdId ? "save-outline" : "megaphone-outline"} size={20} color="#fff" />
                    <Text style={styles.launchBtnText}>{editingAdId ? 'Save Changes' : 'Launch Ad'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

      ) : loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Skeleton loading */}
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.adCard}>
              <Skeleton width="100%" height={160} borderRadius={0} />
              <View style={{ padding: 14, gap: 8 }}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="80%" height={12} />
                <Skeleton width={100} height={28} borderRadius={6} />
              </View>
            </View>
          ))}
        </ScrollView>

      ) : activeTab === 'ads' ? (
        <FlatList
          data={ads}
          keyExtractor={item => item.id}
          renderItem={renderAd}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.analyticsBanner}>
              <View style={styles.analyticsBannerHeader}>
                <Ionicons name="stats-chart" size={18} color="#3b82f6" />
                <Text style={styles.analyticsBannerTitle}>Direct Ads Live Analytics</Text>
              </View>
              <Text style={styles.analyticsBannerSub}>Real-time impression & engagement tracking across user feeds.</Text>
              
              <View style={styles.analyticsStatsRow}>
                <View style={styles.analyticsStatBox}>
                  <Text style={styles.analyticsStatValue}>{totalImpressions.toLocaleString()}</Text>
                  <Text style={styles.analyticsStatLabel}>Total Impressions</Text>
                </View>
                <View style={styles.analyticsStatBox}>
                  <Text style={styles.analyticsStatValue}>{totalClicks.toLocaleString()}</Text>
                  <Text style={styles.analyticsStatLabel}>Total Clicks</Text>
                </View>
                <View style={styles.analyticsStatBox}>
                  <Text style={[styles.analyticsStatValue, { color: '#10b981' }]}>{overallCTR}%</Text>
                  <Text style={styles.analyticsStatLabel}>Avg. Engagement</Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, marginTop: 14,
                  shadowColor: '#2563eb', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3
                }}
                onPress={() => {
                  setEditingAdId(null);
                  setAdTitle(''); setAdDesc(''); setTargetUrl(''); setMaxImpressions(''); setImage(null);
                  setActiveTab('create');
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>+ Create New Ad</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={48} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No Active Ads</Text>
              <Text style={styles.emptyDesc}>Launch your first sponsored ad right now.</Text>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8
                }}
                onPress={() => {
                  setEditingAdId(null);
                  setAdTitle(''); setAdDesc(''); setTargetUrl(''); setMaxImpressions(''); setImage(null);
                  setActiveTab('create');
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>+ Create New Ad</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={creators}
          keyExtractor={item => item.id}
          renderItem={renderCreator}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-outline" size={48} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No Pending Applications</Text>
              <Text style={styles.emptyDesc}>Creator applications will appear here.</Text>
            </View>
          }
        />
      )}
      </>
      )}
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: '#2563eb' },

  // Active Ads list
  list: { padding: 16, gap: 14, paddingBottom: 40 },
  adCard: {
    backgroundColor: colors.background, borderRadius: 14, overflow: 'hidden',
    shadowColor: colors.text, shadowOpacity: 0.07, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  adCardImage: { width: '100%', height: 180 },
  adCardBody: { padding: 14 },
  adCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  adCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  liveTag: { backgroundColor: 'rgba(22, 163, 74, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginLeft: 8 },
  liveTagText: { fontSize: 10, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5 },
  adCardDesc: { fontSize: 13, color: colors.textDim, lineHeight: 18, marginBottom: 10 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: 8 },
  deleteText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(59, 130, 246, 0.12)', borderRadius: 8 },
  editText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },

  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  targetUrlText: { fontSize: 13, color: '#3b82f6', fontWeight: '500', flex: 1 },

  metricsContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 14 },
  metricBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', marginTop: 1 },
  metricDivider: { width: 1, height: 28, backgroundColor: colors.background, marginHorizontal: 4 },

  adActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  pushedTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pushedTagText: { fontSize: 12, fontWeight: '700', color: '#10b981' },

  analyticsBanner: { backgroundColor: colors.background, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border, shadowColor: colors.text, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  analyticsBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  analyticsBannerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  analyticsBannerSub: { fontSize: 13, color: colors.textDim, marginBottom: 16, lineHeight: 18 },
  analyticsStatsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  analyticsStatBox: { flex: 1, backgroundColor: colors.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  analyticsStatValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  analyticsStatLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', marginTop: 4, textAlign: 'center' },

  capContainer: { backgroundColor: colors.background, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  capLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase' },
  capText: { fontSize: 12, fontWeight: '700', color: colors.text },
  capBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  capBarFill: { height: '100%', borderRadius: 3 },

  // Creators
  creatorCard: {
    backgroundColor: colors.background, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: colors.text, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  creatorName: { fontSize: 15, fontWeight: '700', color: colors.text },
  creatorHandle: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  creatorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnDecline: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  btnDeclineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  btnApprove: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#16a34a', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnApproveText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Create Ad form
  formScroll: { paddingBottom: 40 },
  imagePickerArea: {
    width: SCREEN_WIDTH, height: SCREEN_WIDTH,
    backgroundColor: colors.border,
    position: 'relative',
  },
  imagePickerPreview: { width: '100%', height: '100%' },
  imagePickerPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  imagePickerLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  imagePickerSub: { fontSize: 13, color: colors.textDim },
  imageEditBadge: {
    position: 'absolute', bottom: 14, right: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  formBody: { padding: 20 },
  formSectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDim, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
  launchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 14,
    marginTop: 28, shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  launchBtnDisabled: { backgroundColor: '#93c5fd' },
  launchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textDim, textAlign: 'center', paddingHorizontal: 32 },
})
