import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Modal, Switch, TextInput as RNTextInput,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme';
import { decode } from 'base64-arraybuffer'
import { GiphyPicker } from '../components/GiphyPicker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as StoreReview from 'expo-store-review'

interface PostItem {
  id: string
  content: string
  images: ImagePicker.ImagePickerAsset[]
  remoteUrls: string[]
  video: ImagePicker.ImagePickerAsset | null
}

const CATEGORIES = ['Funny', 'Trending', 'Relatable', 'Dank', 'Wholesome', 'Meme', 'Video', 'Art']

// ─── Stable avatar component ─────────────────────────────────────────────────
// Defined outside the screen so React never re-mounts it on parent re-render.
// React.memo means it only re-renders when `uri` or `ghost` actually changes.
const AvatarImage = React.memo(({ uri, ghost, styles }: { uri: string | null; ghost: boolean; styles: any }) => {
  const [loaded, setLoaded] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  // When uri changes, reset loaded/errored so image re-evaluates cleanly
  const prevUri = React.useRef<string | null>(null)
  if (prevUri.current !== uri) {
    prevUri.current = uri
    // Only reset if we actually have a new non-null uri to try
    if (uri) {
      setLoaded(false)
      setErrored(false)
    }
  }

  const showImage = uri && !errored

  return (
    <View style={[styles.avatarBase, ghost ? styles.avatarGhost : null]}>
      {/* Purple placeholder always underneath — never flickers */}
      {!loaded && !errored && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#6366f1', borderRadius: 20 }]} />
      )}
      {showImage && (
        <Image
          source={{ uri }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={StyleSheet.absoluteFill}
        />
      )}
      {errored && (
        <Image
          source={require('../assets/icon.png')}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  )
})

// ─── Stable media image component ────────────────────────────────────────────
// Same reason: prevents media thumbnails from reloading on every keystroke.
const MediaImage = React.memo(({ uri, styles }: { uri: string; styles: any }) => {
  // useMemo ensures the source object reference is stable
  const source = useMemo(() => ({ uri }), [uri])
  return <Image source={source} style={styles.mediaImage} />
})

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function CreatePostScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()

  const [thread, setThread] = useState<PostItem[]>([{
    id: Date.now().toString(), content: '', images: [], remoteUrls: [], video: null,
  }])
  const [loading, setLoading] = useState(false)
  const [showGiphy, setShowGiphy] = useState<{ postIndex: number } | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [replyPrivacy, setReplyPrivacy] = useState<'Anyone' | 'Followers' | 'Followed' | 'Mentioned'>('Anyone')
  const [reviewReplies, setReviewReplies] = useState(false)
  const [isGhost, setIsGhost] = useState(false)
  const [isDeal, setIsDeal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isBusiness, setIsBusiness] = useState(false)
  const [profileAvatar, setProfileAvatar] = useState<string | null>(
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
  )

  // Input ref so we can focus programmatically ONCE on mount (not on every render)
  const inputRef = useRef<RNTextInput>(null)
  const didFocus = useRef(false)

  // Load profile — same pattern as web (cache-first, then fresh from DB)
  useEffect(() => {
    if (!user) return

    AsyncStorage.getItem('jpm_current_profile').then((cached) => {
      if (cached) {
        try {
          const p = JSON.parse(cached)
          if (p.avatar_url) setProfileAvatar(p.avatar_url)
          if (p.is_business !== undefined) setIsBusiness(!!p.is_business)
        } catch {}
      }
    })

    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        const fresh = data.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null
        if (fresh) setProfileAvatar(fresh)
        setIsBusiness(!!data.is_business)
        AsyncStorage.setItem('jpm_current_profile', JSON.stringify(data))
      }
    })
  }, [user?.id]) // stable string dep — avoids re-running on auth token refresh

  // Focus the TextInput once when the screen gains focus.
  // useFocusEffect fires AFTER the navigation transition completes,
  // so the modal slide animation is already done — keyboard reliably appears.
  useFocusEffect(
    useCallback(() => {
      if (!didFocus.current) {
        didFocus.current = true
        // Small extra delay so the modal is fully settled on iOS
        const t = setTimeout(() => { inputRef.current?.focus() }, 400)
        return () => clearTimeout(t)
      }
    }, [])
  )

  const updatePost = useCallback((index: number, updates: Partial<PostItem>) => {
    setThread((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }, [])

  const pickMedia = async (index: number, type: 'Images' | 'Videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'Videos'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      allowsMultipleSelection: false, // Must be false for allowsEditing to work
      quality: 0.4, // AGGRESSIVE COMPRESSION: Reduces image size by 80% to save Supabase Egress!
      base64: type === 'Images',
    })
    if (!result.canceled) {
      const post = thread[index]
      if (type === 'Images') {
        const newImages = [...post.images, ...result.assets].slice(0, 4 - post.remoteUrls.length)
        updatePost(index, { images: newImages, video: null })
      } else {
        updatePost(index, { video: result.assets[0], images: [], remoteUrls: [] })
      }
    }
  }

  const handleGifSelect = (url: string) => {
    if (showGiphy !== null) {
      const post = thread[showGiphy.postIndex]
      const newRemote = [...post.remoteUrls, url].slice(0, 4 - post.images.length)
      updatePost(showGiphy.postIndex, { remoteUrls: newRemote })
    }
  }

  const handlePost = async () => {
    if (!user) return
    const isEmpty = thread.every(p => !p.content.trim() && p.images.length === 0 && p.remoteUrls.length === 0 && !p.video)
    if (isEmpty) { Alert.alert('Error', 'Post cannot be empty.'); return }

    setLoading(true)
    try {
      let previousPostId: string | null = null
      for (const [idx, post] of thread.entries()) {
        if (!post.content.trim() && post.images.length === 0 && post.remoteUrls.length === 0 && !post.video)
          continue

        let videoUrl = null
        let imageUrls: string[] = [...post.remoteUrls]

        if (post.images.length > 0) {
          for (const img of post.images) {
            if (!img.base64) continue
            const ext = img.uri.split('.').pop() || 'jpg'
            const path = `memes/${user.id}_${Date.now()}_${Math.random()}.${ext}`
            const { error: uploadErr } = await supabase.storage.from('post-media').upload(path, decode(img.base64), { contentType: `image/${ext}` })
            if (!uploadErr) {
              const { data } = supabase.storage.from('post-media').getPublicUrl(path)
              imageUrls.push(data.publicUrl)
            }
          }
        }

        if (post.video) {
          const ext = post.video.uri.split('.').pop() || 'mp4'
          const path = `vid_${user.id}_${Date.now()}.${ext}`
          try {
            const res = await fetch(post.video.uri)
            const blob = await res.blob()
            const { error: uploadErr } = await supabase.storage.from('videos').upload(path, blob)
            if (!uploadErr) {
              const { data } = supabase.storage.from('videos').getPublicUrl(path)
              videoUrl = data.publicUrl
            }
          } catch (e) { console.error('Video upload failed', e) }
        }

        const { data: result, error } = await supabase.from('posts').insert({
          content: post.content.trim(),
          image_urls: imageUrls,
          video_url: videoUrl,
          creator_id: user.id,
          parent_id: previousPostId,
          is_ghost: isGhost,
          expires_at: isGhost ? new Date(Date.now() + 86400000).toISOString() : null,
          settings: {
            reply_privacy: replyPrivacy,
            review_replies: reviewReplies,
            thread_index: idx,
            ghost_mode: isGhost,
            is_deal: isDeal,
            category: selectedCategory,
          },
        }).select('id').single()

        if (error) throw error
        previousPostId = result.id
      }

      // Check if we should prompt for app review (e.g. after 3rd and 10th post)
      try {
        const countStr = await AsyncStorage.getItem('user_created_posts_count')
        const currentCount = countStr ? parseInt(countStr, 10) : 0
        const newCount = currentCount + 1
        await AsyncStorage.setItem('user_created_posts_count', newCount.toString())

        if (newCount === 3 || newCount === 10) {
          const isAvailable = await StoreReview.isAvailableAsync()
          if (isAvailable) {
            await StoreReview.requestReview()
          }
        }
      } catch (reviewErr) {
        console.warn('Store review skipped:', reviewErr)
      }

      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = thread.every(
    p => !p.content.trim() && p.images.length === 0 && p.remoteUrls.length === 0 && !p.video
  )

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fixed header — lives OUTSIDE KeyboardAvoidingView, never jumps ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.headerBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* ── KAV only wraps the scrollable content area ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {thread.map((post, index) => (
            <View key={post.id} style={styles.postItem}>
              {/* Left column: avatar + thread line */}
              <View style={styles.postLeft}>
                <AvatarImage uri={profileAvatar} ghost={isGhost} styles={styles} />
                <View style={styles.threadLine} />
                {index === thread.length - 1 && (
                  <View style={styles.addThreadCircle}>
                    <Ionicons name="add" size={14} color={colors.textDim} />
                  </View>
                )}
              </View>

              {/* Right column: input + media + toolbar */}
              <View style={styles.postRight}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.fullName}>{user?.user_metadata?.username || 'user'}</Text>
                  <Text style={styles.privacyText}> › {replyPrivacy}</Text>
                </View>
                {index === 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryBtn, selectedCategory === cat && styles.categoryBtnActive]}
                        onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      >
                        <Text style={[styles.categoryBtnText, selectedCategory === cat && styles.categoryBtnTextActive]}>#{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Text input — ref only on first post for keyboard auto-focus */}
                <TextInput
                  ref={index === 0 ? inputRef : undefined}
                  style={styles.input}
                  placeholder={index === 0 ? "What's happening?" : 'Say more...'}
                  placeholderTextColor="#a1a1aa"
                  multiline
                  value={post.content}
                  onChangeText={(txt) => updatePost(index, { content: txt })}
                  textAlignVertical="top"
                />

                {/* Attached media previews */}
                {(post.images.length > 0 || post.remoteUrls.length > 0 || post.video) && (
                  <View style={styles.mediaRow}>
                    {[...post.remoteUrls, ...post.images.map(i => i.uri)].map((uri, i) => (
                      <View key={`${uri}-${i}`} style={styles.mediaItem}>
                        <MediaImage uri={uri} styles={styles} />
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => {
                            if (i < post.remoteUrls.length) {
                              updatePost(index, { remoteUrls: post.remoteUrls.filter((_, k) => k !== i) })
                            } else {
                              const imgIdx = i - post.remoteUrls.length
                              updatePost(index, { images: post.images.filter((_, k) => k !== imgIdx) })
                            }
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={24} color="#000" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {post.video && (
                      <View style={styles.mediaItem}>
                        <View style={styles.videoPlaceholder}>
                          <Ionicons name="play-circle" size={48} color="#fff" />
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => updatePost(index, { video: null })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={24} color="#000" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Toolbar */}
                <View style={styles.toolbar}>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => pickMedia(index, 'Images')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="image-outline" size={22} color={colors.textDim} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => pickMedia(index, 'Videos')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="videocam-outline" size={22} color={colors.textDim} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => setShowGiphy({ postIndex: index })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={styles.gifIcon}><Text style={styles.gifText}>GIF</Text></View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="list-outline" size={22} color={colors.textDim} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => setShowOptions(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={colors.textDim} />
                  </TouchableOpacity>
                </View>

                {index === thread.length - 1 && (
                  <TouchableOpacity
                    style={styles.addThreadBtn}
                    onPress={() => setThread(prev => [
                      ...prev,
                      { id: Date.now().toString(), content: '', images: [], remoteUrls: [], video: null },
                    ])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.addThreadText}>Add to thread</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* Deal toggle for business accounts */}
          {isBusiness && (
            <TouchableOpacity
              style={[styles.dealToggle, isDeal && styles.dealToggleActive]}
              onPress={() => setIsDeal(v => !v)}
            >
              <Ionicons name="pricetag" size={20} color={isDeal ? '#15803d' : '#71717a'} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.dealTitle, isDeal && styles.dealTitleActive]}>Post as Local Deal</Text>
                <Text style={styles.dealDesc}>List this post on the Deals Feed</Text>
              </View>
              <Switch value={isDeal} onValueChange={setIsDeal} trackColor={{ true: '#22c55e' }} />
            </TouchableOpacity>
          )}
        </ScrollView>

        <GiphyPicker
          visible={showGiphy !== null}
          onClose={() => setShowGiphy(null)}
          onGifSelect={handleGifSelect}
        />
      </KeyboardAvoidingView>

      {/* Floating Bottom Action Bar */}
      <View style={styles.bottomBarWrapper}>
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomOptionsBtn} onPress={() => setShowOptions(true)}>
            <Text style={styles.bottomOptionsText}>Options</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bottomPostBtn, isEmpty && styles.bottomPostBtnDisabled]} 
            onPress={handlePost}
            disabled={loading || isEmpty}
          >
            {loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.bottomPostText}>Post</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.bottomHint}>Drafts auto-save to local history</Text>
      </View>

      {/* Post settings modal */}
      <Modal visible={showOptions} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowOptions(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post Settings</Text>
            <TouchableOpacity onPress={() => setShowOptions(false)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.settingSection}>
              <Text style={styles.settingHeader}>WHO CAN REPLY?</Text>
              {(['Anyone', 'Followers', 'Followed', 'Mentioned'] as const).map(opt => (
                <TouchableOpacity key={opt} style={styles.radioRow} onPress={() => setReplyPrivacy(opt)}>
                  <Text style={[styles.radioLabel, replyPrivacy === opt && styles.radioLabelActive]}>{opt}</Text>
                  <View style={[styles.radioOuter, replyPrivacy === opt && styles.radioOuterActive]}>
                    {replyPrivacy === opt && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Ghost Post</Text>
                <Text style={styles.settingDesc}>Anonymous, disappears in 24h</Text>
              </View>
              <Switch value={isGhost} onValueChange={setIsGhost} trackColor={{ true: '#f59e0b' }} />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Review replies</Text>
                <Text style={styles.settingDesc}>Verify replies before they go public</Text>
              </View>
              <Switch value={reviewReplies} onValueChange={setReviewReplies} trackColor={{ true: '#2563eb' }} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 17, color: colors.text, fontWeight: '400' },
  postBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnDisabled: { backgroundColor: colors.border },
  postBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  postBtnTextDisabled: { color: colors.textDim },

  scroll: { flex: 1 },

  postItem: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16 },
  postLeft: { alignItems: 'center', width: 48, marginRight: 12 },
  avatarBase: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', overflow: 'hidden' },
  avatarGhost: { borderWidth: 2, borderColor: '#f59e0b' },
  threadLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 8, borderRadius: 1 },
  postRight: { flex: 1, paddingBottom: 16 },

  categoriesScroll: { marginBottom: 12 },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.border,
  },
  categoryBtnActive: { backgroundColor: colors.text, borderColor: '#18181b' },
  categoryBtnText: { fontSize: 12, fontWeight: '700', color: colors.textDim },
  categoryBtnTextActive: { color: colors.background },

  input: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    minHeight: 60,
    paddingBottom: 8,
  },
  privacyText: { fontSize: 14, color: colors.textDim, fontWeight: '700' },
  gifIcon: { borderWidth: 1, borderColor: colors.textDim, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  gifText: { fontSize: 10, color: colors.textDim, fontWeight: '700' },
  addThreadBtn: { marginTop: 12, paddingVertical: 8 },
  addThreadText: { color: colors.textDim, fontWeight: '600', fontSize: 15 },
  addThreadCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  bottomBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 32, paddingHorizontal: 16, backgroundColor: colors.background },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomOptionsBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  bottomOptionsText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  bottomPostBtn: { backgroundColor: colors.text, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12 },
  bottomPostBtnDisabled: { backgroundColor: colors.border },
  bottomPostText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  bottomHint: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginTop: 12, textAlign: 'center' },

  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  mediaItem: { position: 'relative', width: 120, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.border },
  mediaImage: { width: '100%', height: '100%' },
  videoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.background, borderRadius: 12 },

  toolbar: { flexDirection: 'row', gap: 16, marginTop: 12 },
  toolBtn: { padding: 4 },

  dealToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    marginTop: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#dcfce3',
  },
  dealToggleActive: { backgroundColor: '#dcfce3' },
  dealTitle: { fontSize: 15, fontWeight: '700', color: '#14532d' },
  dealTitleActive: { color: '#14532d' },
  dealDesc: { fontSize: 12, color: '#166534', marginTop: 2 },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: { padding: 4 },
  modalScroll: { flex: 1, padding: 16 },
  settingSection: { marginBottom: 32 },
  settingHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textDim,
    marginBottom: 12,
    letterSpacing: 1,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  radioLabel: { fontSize: 16, fontWeight: '600', color: colors.textDim },
  radioLabelActive: { color: colors.text },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: { borderColor: '#000', backgroundColor: '#000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.background },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  settingDesc: { fontSize: 13, color: colors.textDim, marginTop: 4 },
})
