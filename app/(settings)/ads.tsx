import { getCdnUrl } from '../../lib/cdn';
// app/(settings)/ads.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
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
import { Skeleton } from '../../components/Skeleton'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  const [ads, setAds] = useState<any[]>([])
  const [creators, setCreators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ads' | 'create' | 'creators'>('ads')

  // Ad Form State
  const [adTitle, setAdTitle] = useState('')
  const [adDesc, setAdDesc] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [postingAd, setPostingAd] = useState(false)

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    if (activeTab === 'create') return
    setLoading(true)
    if (activeTab === 'ads') {
      const { data } = await supabase.from('direct_ads').select('*').order('created_at', { ascending: false })
      setAds(data || [])
    } else if (activeTab === 'creators') {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, settings, created_at')
        .eq('settings->creator_application_status', 'pending')
      setCreators(data || [])
    }
    setLoading(false)
  }

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
          await supabase.from('direct_ads').delete().eq('id', id)
          setAds(prev => prev.filter(a => a.id !== id))
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

  const handlePostAd = async () => {
    if (!adTitle.trim()) {
      Alert.alert('Missing Info', 'Please add an Ad Title.')
      return
    }
    if (!image) {
      Alert.alert('Missing Image', 'Please select an Ad Image.')
      return
    }

    setPostingAd(true)
    try {
      let imageUrl = null
      if (image.base64) {
        const ext = image.uri.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}_${Math.random()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('ads')
          .upload(fileName, decode(image.base64), { contentType: `image/${ext}` })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('ads').getPublicUrl(fileName)
        imageUrl = urlData?.publicUrl
      }

      // Only insert columns that actually exist in the direct_ads table
      const { error } = await supabase.from('direct_ads').insert({
        title: adTitle.trim(),
        description: adDesc.trim() || null,
        target_url: targetUrl.trim() || null,
        image_url: imageUrl,
      })

      if (error) throw error

      Alert.alert('🎉 Ad Launched!', 'Your ad is now live in the feed.')
      setAdTitle(''); setAdDesc(''); setTargetUrl(''); setImage(null)
      setActiveTab('ads')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setPostingAd(false)
    }
  }

  const renderAd = ({ item }: { item: any }) => (
    <View style={styles.adCard}>
      {item.image_url && (
        <Image source={{ uri: getCdnUrl(item.image_url) }} style={styles.adCardImage} resizeMode="cover" />
      )}
      <View style={styles.adCardBody}>
        <View style={styles.adCardRow}>
          <Text style={styles.adCardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.liveTag}><Text style={styles.liveTagText}>LIVE</Text></View>
        </View>
        {!!item.description && <Text style={styles.adCardDesc} numberOfLines={2}>{item.description}</Text>}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteAd(item.id)}>
          <Ionicons name="trash-outline" size={14} color="#dc2626" />
          <Text style={styles.deleteText}>Remove Ad</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

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
      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['ads', 'create', 'creators'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'ads' ? 'Active Ads' : tab === 'create' ? 'Create Ad' : 'Creators'}
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
              <Text style={styles.formSectionTitle}>Ad Details</Text>

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

              <TouchableOpacity
                style={[styles.launchBtn, (!adTitle.trim() || !image) && styles.launchBtnDisabled]}
                onPress={handlePostAd}
                disabled={postingAd || !adTitle.trim() || !image}
                activeOpacity={0.85}
              >
                {postingAd ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={20} color="#fff" />
                    <Text style={styles.launchBtnText}>Launch Ad</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

      ) : loading ? (
        /* Skeleton loading */
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={48} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No Active Ads</Text>
              <Text style={styles.emptyDesc}>Tap "Create Ad" to launch your first sponsored post.</Text>
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
