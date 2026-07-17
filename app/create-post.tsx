import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Modal, Switch, TextInput as RNTextInput, Animated,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme';
import { useTranslation } from '../lib/i18n';
import { decode } from 'base64-arraybuffer'
import { GiphyPicker } from '../components/GiphyPicker'
import { PhotoEditor } from '../components/PhotoEditor'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as StoreReview from 'expo-store-review'
import * as FileSystem from 'expo-file-system/legacy'
import * as VideoThumbnails from 'expo-video-thumbnails'

interface PostItem {
  id: string
  content: string
  images: ImagePicker.ImagePickerAsset[]
  remoteUrls: string[]
  video: ImagePicker.ImagePickerAsset | null
  isHidden?: boolean
}

const CATEGORIES = ['Funny', 'Trending', 'Relatable', 'Dank', 'Wholesome', 'Meme', 'Video', 'Art']

const DICT = {
  en: {
    cancel: 'Cancel', whats_happening: "What's happening?", say_more: 'Say more...', add_to_thread: 'Add to thread',
    post_deal: 'Post as Local Deal', post_deal_desc: 'List this post on the Deals Feed', options: 'Options', post: 'Post',
    drafts_hint: 'Drafts auto-save to local history', post_settings: 'Post Settings', who_can_reply: 'WHO CAN REPLY?',
    ghost_post: 'Ghost Post', ghost_desc: 'Anonymous, disappears in 24h', whispers: 'Whispers (Anonymous)', whispers_desc: 'Post completely anonymously',
    review_replies: 'Review replies', review_desc: 'Verify replies before they go public', invite_collab: 'Invite Collaborator', invite_desc: 'Type exact username of co-author',
    copyright_title: 'Media Ownership',
    copyright_body: 'By posting this media you confirm you own all rights to it. JPM is not responsible for copyright violations.',
    copyright_point1: 'I own or have rights to this content',
    copyright_point2: 'It does not violate anyone else\'s rights',
    copyright_point3: 'I understand violations may lead to removal',
    copyright_accept: 'Accept & Post',
    copyright_cancel: 'Cancel',
  },
  sw: {
    cancel: 'Ghairi', whats_happening: "Kuna nini kipya?", say_more: 'Sema zaidi...', add_to_thread: 'Ongeza kwenye uzi',
    post_deal: 'Chapisha kama Dili', post_deal_desc: 'Orodhesha kwenye Uzi wa Dili', options: 'Chaguzi', post: 'Chapisha',
    drafts_hint: 'Rasimu inahifadhiwa kiotomatiki', post_settings: 'Mipangilio ya Chapisho', who_can_reply: 'NANI ANAWEZA KUJIBU?',
    ghost_post: 'Chapisho la Siri', ghost_desc: 'Bila jina, hupotea baada ya saa 24', whispers: 'Minong\'ono (Bila jina)', whispers_desc: 'Chapisha bila kujulikana',
    review_replies: 'Kagua majibu', review_desc: 'Hakiki majibu kabla ya kuonekana', invite_collab: 'Alika Mshiriki', invite_desc: 'Andika jina la mtumiaji',
    copyright_title: 'Umiliki wa Maudhui',
    copyright_body: 'Kwa kupakia maudhui haya, unathibitisha kwamba una haki zote za maudhui hayo. JPM haitawajibika kwa ukiukaji wa hakimiliki.',
    copyright_point1: 'Ninamiliki au nina haki za maudhui haya',
    copyright_point2: 'Hayakiuki haki za mtu mwingine',
    copyright_point3: 'Naelewa ukiukaji unaweza kusababisha kuondolewa',
    copyright_accept: 'Kubali & Chapisha',
    copyright_cancel: 'Ghairi',
  },
  suk: {
    cancel: 'Leka', whats_happening: "Kuli mbita gani?", say_more: 'Longela zaidi...', add_to_thread: 'Ongeza haha',
    post_deal: 'Bika Deal', post_deal_desc: 'Bika kwenye Deal', options: 'Chaguzi', post: 'Bika',
    drafts_hint: 'Inahifadhiwa yenyewe', post_settings: 'Mipangilio', who_can_reply: 'NANI AKUJIBA?',
    ghost_post: 'Mhola ya Siri', ghost_desc: 'Ipotea baada ya 24h', whispers: 'Minong\'ono', whispers_desc: 'Bika siri',
    review_replies: 'Kagua majibu', review_desc: 'Kagua kabla ya kubika', invite_collab: 'Alika Mponyi', invite_desc: 'Andika zina',
    copyright_title: 'Umiliki wa Maudhui',
    copyright_body: 'Kwa kubika vitu hivi, unasema una haki zote. JPM haitawajibika kwa matatizo ya hakimiliki.',
    copyright_point1: 'Nina haki za vitu hivi',
    copyright_point2: 'Havikui haki za wengine',
    copyright_point3: 'Naelewa ukiukaji unaweza kusababisha kuondolewa',
    copyright_accept: 'Kubali & Bika',
    copyright_cancel: 'Leka',
  },
  cha: {
    cancel: 'Leka', whats_happening: "Kuna kiki?", say_more: 'Ocha zaidi...', add_to_thread: 'Wika haha',
    post_deal: 'Wika Dili', post_deal_desc: 'Wika kwenye Dili', options: 'Chaguzi', post: 'Wika',
    drafts_hint: 'Inahifadhiwa yenyewe', post_settings: 'Mipangilio', who_can_reply: 'NANI AKUJIBU?',
    ghost_post: 'Kindu kya Siri', ghost_desc: 'Kipotea baada ya 24h', whispers: 'Minong\'ono', whispers_desc: 'Wika siri',
    review_replies: 'Kagua majibu', review_desc: 'Kagua kabla ya kuwika', invite_collab: 'Ika Mndu', invite_desc: 'Wika zina',
    copyright_title: 'Umiliki wa Vitu',
    copyright_body: 'Kwa kuwika vitu hivi, unasema una haki zote. JPM haitawajibika kwa matatizo ya hakimiliki.',
    copyright_point1: 'Nina haki za vitu hivi',
    copyright_point2: 'Havikui haki za wengine',
    copyright_point3: 'Naelewa ukiukaji unaweza kusababisha kuondolewa',
    copyright_accept: 'Kubali & Wika',
    copyright_cancel: 'Leka',
  },
  maa: {
    cancel: 'Pal', whats_happening: "Inkishu nanu?", say_more: 'Iro zaidi...', add_to_thread: 'Soj haha',
    post_deal: 'Wika Dili', post_deal_desc: 'Wika kwenye Dili', options: 'Chaguzi', post: 'Ita',
    drafts_hint: 'Inahifadhiwa yenyewe', post_settings: 'Mpangilio', who_can_reply: 'ANI ALOSUJAA?',
    ghost_post: 'Ita Siri', ghost_desc: 'Pal suata, ipotea 24h', whispers: 'Minong\'ono', whispers_desc: 'Ita siri',
    review_replies: 'Kagua', review_desc: 'Kagua kabla ya kuwika', invite_collab: 'Ika Mndu', invite_desc: 'Wika karna',
    copyright_title: 'Enkiama e Todua',
    copyright_body: 'Iyiolo itodua ino, isujaa ina enkiama pooki. JPM mme enkijapata e inkishu.',
    copyright_point1: 'Ina enkiama e todua ino',
    copyright_point2: 'Mme inkishu e iltungani',
    copyright_point3: 'Ingera inkishu alosupata tukul',
    copyright_accept: 'Sujaa & Ita',
    copyright_cancel: 'Pal',
  },
}

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
  const insets = useSafeAreaInsets()
  const { lang } = useTranslation()
  const tLocal = (key: keyof typeof DICT.en) => (DICT[lang as keyof typeof DICT] || DICT.en)[key]

  const [thread, setThread] = useState<PostItem[]>([{
    id: Date.now().toString(), content: '', images: [], remoteUrls: [], video: null, isHidden: false
  }])
  const [loading, setLoading] = useState(false)
  const [showGiphy, setShowGiphy] = useState<{ postIndex: number } | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [replyPrivacy, setReplyPrivacy] = useState<'Anyone' | 'Followers' | 'Followed' | 'Mentioned'>('Anyone')
  const [reviewReplies, setReviewReplies] = useState(false)
  const [isGhost, setIsGhost] = useState(false)
  const [isDeal, setIsDeal] = useState(false)
  const [isBettingCode, setIsBettingCode] = useState(false)
  const [bettingPlatform, setBettingPlatform] = useState('SportyBet')
  const [bettingCode, setBettingCode] = useState('')
  const [coAuthorUsername, setCoAuthorUsername] = useState('')
  const [coAuthorId, setCoAuthorId] = useState<string | null>(null)
  const [verifyingCoAuthor, setVerifyingCoAuthor] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<{ uri: string, index: number, asset: any } | null>(null)
  const [showCopyrightModal, setShowCopyrightModal] = useState(false)
  const [copyrightAccepted, setCopyrightAccepted] = useState(false)

  // Check if user has already accepted copyright — only show once ever
  useEffect(() => {
    AsyncStorage.getItem('@jpm_copyright_accepted').then(val => {
      if (val === 'true') setCopyrightAccepted(true)
    })
  }, [])

  // Upload progress timeline
  type UploadStep = { label: string; status: 'pending' | 'active' | 'done' | 'error' }
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Shake animation for empty post button
  const shakeAnim = useRef(new Animated.Value(0)).current
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start()
  }

  // Smooth Upload Animation
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(0.7);
    }
  }, [loading]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isBusiness, setIsBusiness] = useState(false)
  const [profileAvatar, setProfileAvatar] = useState<string | null>(
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
  )

  // Input ref so we can focus programmatically ONCE on mount (not on every render)
  const inputRef = useRef<RNTextInput>(null)
  const didFocus = useRef(false)

  // Auto-save drafts
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const hasContent = thread.length > 1 || thread[0].content.trim() || thread[0].images.length > 0;
      if (hasContent) {
        await AsyncStorage.setItem('@dapaz_post_draft', JSON.stringify(thread));
      } else {
        await AsyncStorage.removeItem('@dapaz_post_draft');
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [thread]);

  // Load drafts on mount — show a banner so user knows a draft was restored
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    AsyncStorage.getItem('@dapaz_post_draft').then(draft => {
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed && parsed.length > 0) {
            const hasRealContent = parsed.some((p: any) => p.content?.trim() || p.images?.length > 0 || p.remoteUrls?.length > 0 || p.video)
            if (hasRealContent) {
              setThread(parsed);
              setHasDraft(true)
            }
          }
        } catch(e) {}
      }
    });
  }, []);

  const discardDraft = async () => {
    await AsyncStorage.removeItem('@dapaz_post_draft');
    setThread([{ id: Date.now().toString(), content: '', images: [], remoteUrls: [], video: null, isHidden: false }])
    setHasDraft(false)
  }

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
    })
    if (!result.canceled) {
      const post = thread[index]
      if (type === 'Images') {
        setEditingPhoto({ uri: result.assets[0].uri, index, asset: result.assets[0] })
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

  const executePost = async () => {
    setLoading(true)

    // Build steps dynamically based on what's being posted
    const hasImages = thread.some(p => p.images.length > 0)
    const hasVideo = thread.some(p => p.video !== null)
    const steps: { label: string; status: 'pending' | 'active' | 'done' | 'error' }[] = [
      { label: hasImages ? 'Uploading images...' : hasVideo ? 'Uploading video...' : 'Preparing post...', status: 'pending' },
      ...(hasImages || hasVideo ? [{ label: 'Processing media...', status: 'pending' as const }] : []),
      { label: 'Publishing your post...', status: 'pending' },
      { label: 'All done!', status: 'pending' },
    ]
    setUploadSteps(steps)
    setShowUploadModal(true)

    const setStep = (index: number, status: 'active' | 'done' | 'error') => {
      setUploadSteps(prev => prev.map((s, i) => i === index ? { ...s, status } : s))
    }

    let stepIndex = 0
    setStep(stepIndex, 'active')

    try {
      let previousPostId: string | null = null
      for (const [idx, post] of thread.entries()) {
        if (!post.content.trim() && post.images.length === 0 && post.remoteUrls.length === 0 && !post.video)
          continue

        let videoUrl = null
        let imageUrls: string[] = [...post.remoteUrls]

        if (post.images.length > 0) {
          for (const img of post.images) {
            const ext = img.uri.split('.').pop() || 'jpg'
            const path = `img_${Date.now()}_${Math.random()}.${ext}`
            try {
              const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: 'base64' })
              const { error: uploadErr } = await supabase.storage.from('memes').upload(path, decode(base64), { contentType: `image/${ext}` })
              if (!uploadErr) {
                const { data } = supabase.storage.from('memes').getPublicUrl(path)
                imageUrls.push(data.publicUrl)
              } else {
                console.error('Upload Error:', uploadErr)
              }
            } catch (e) {
              console.error('File read/upload failed', e)
            }
          }
        }

        if (post.video) {
          const ext = post.video.uri.split('.').pop() || 'mp4'
          const path = `vid_${user.id}_${Date.now()}.${ext}`
          try {
            const res = await fetch(post.video.uri)
            const blob = await res.blob()
            const { error: uploadErr } = await supabase.storage.from('memes').upload(path, blob)
            if (!uploadErr) {
              const { data } = supabase.storage.from('memes').getPublicUrl(path)
              videoUrl = data.publicUrl
              
              // Generate and upload thumbnail
              try {
                const { uri } = await VideoThumbnails.getThumbnailAsync(post.video.uri, {
                  time: 1000,
                  quality: 0.5,
                });
                
                const thumbExt = uri.split('.').pop() || 'jpg'
                const thumbPath = `thumb_${Date.now()}_${Math.random()}.${thumbExt}`
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
                const { error: thumbUploadErr } = await supabase.storage.from('memes').upload(thumbPath, decode(base64), { contentType: `image/${thumbExt}` })
                
                if (!thumbUploadErr) {
                  const { data: thumbData } = supabase.storage.from('memes').getPublicUrl(thumbPath)
                  imageUrls.push(thumbData.publicUrl)
                }
              } catch (thumbErr) {
                console.warn('Could not generate video thumbnail', thumbErr);
              }
            }
          } catch (e) { console.error('Video upload failed', e) }
        }

        // Mark media step done, move to processing
        setStep(stepIndex, 'done')
        stepIndex++
        if (stepIndex < steps.length - 1) setStep(stepIndex, 'active')

        // Small pause so user can see each step
        await new Promise(r => setTimeout(r, 300))

        // Mark processing done, move to publishing
        if (hasImages || hasVideo) {
          setStep(stepIndex, 'done')
          stepIndex++
        }
        setStep(stepIndex, 'active')

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
            is_betting_code: isBettingCode,
            betting_platform: isBettingCode ? bettingPlatform : undefined,
            betting_code: isBettingCode ? bettingCode : undefined,
            co_author_id: coAuthorId,
            co_author_status: coAuthorId ? 'pending' : undefined,
            is_hidden: post.isHidden || false
          },
        }).select('id').single()

        if (error) throw error
        previousPostId = result.id
      }

      // Check if we should prompt for app review
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

      // Mark publishing done + show "All done!"
      setStep(stepIndex, 'done')
      stepIndex++
      setStep(stepIndex, 'done')

      await new Promise(r => setTimeout(r, 600))

      await AsyncStorage.removeItem('@dapaz_post_draft');
      setShowUploadModal(false)
      router.back()
    } catch (e: any) {
      // Mark current step as error
      setStep(stepIndex, 'error')
      await new Promise(r => setTimeout(r, 1200))
      setShowUploadModal(false)
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePost = () => {
    if (!user) return
    const isEmpty = thread.every(p => !p.content.trim() && p.images.length === 0 && p.remoteUrls.length === 0 && !p.video)
    if (isEmpty) {
      triggerShake()
      return
    }

    const hasLocalMedia = thread.some(p => p.images.length > 0 || p.video !== null)

    // Only show copyright agreement first time they post media
    if (hasLocalMedia && !copyrightAccepted) {
      setShowCopyrightModal(true)
    } else {
      executePost()
    }
  }

  const isEmpty = thread.every(
    p => !p.content.trim() && p.images.length === 0 && p.remoteUrls.length === 0 && !p.video
  )

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fixed header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <TouchableOpacity
            style={[styles.postBtn, isEmpty && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={loading}
          >
            <Text style={[styles.postBtnText, isEmpty && styles.postBtnTextDisabled]}>{tLocal('post')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Draft restored banner */}
      {hasDraft && (
        <View style={styles.draftBanner}>
          <Ionicons name="document-text-outline" size={16} color={colors.primary} />
          <Text style={styles.draftBannerText}>Draft restored</Text>
          <TouchableOpacity onPress={discardDraft} style={styles.draftDiscardBtn}>
            <Text style={styles.draftDiscardText}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

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
                {index < thread.length - 1 && <View style={styles.threadLine} />}
                {index === thread.length - 1 && thread.length > 1 && (
                  <View style={styles.threadLine} />
                )}
              </View>

              {/* Right column: input + media + toolbar */}
              <View style={styles.postRight}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.fullName}>{user?.user_metadata?.username || 'user'}</Text>
                    {isGhost && <View style={styles.ghostBadge}><Text style={styles.ghostBadgeText}>👻 Ghost</Text></View>}
                  </View>
                  {thread.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setThread(prev => prev.filter((_, i) => i !== index))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={colors.textDim} />
                    </TouchableOpacity>
                  )}
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

                {/* Text input */}
                <TextInput
                  ref={index === 0 ? inputRef : undefined}
                  style={styles.input}
                  placeholder={index === 0 ? tLocal('whats_happening') : tLocal('say_more')}
                  placeholderTextColor={colors.textDim}
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
                          <Ionicons name="close-circle" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {post.video && (
                      <View style={styles.mediaItem}>
                        <View style={styles.videoPlaceholder}>
                          <Ionicons name="play-circle" size={40} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 11, marginTop: 4, fontWeight: '600' }}>Video</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => updatePost(index, { video: null })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Toolbar */}
                <View style={styles.toolbar}>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => pickMedia(index, 'Images')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="image-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => pickMedia(index, 'Videos')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="videocam-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => setShowGiphy({ postIndex: index })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={styles.gifIcon}><Text style={styles.gifText}>GIF</Text></View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  {index === thread.length - 1 && (
                    <TouchableOpacity
                      style={styles.addThreadBtn}
                      onPress={() => setThread(prev => [
                        ...prev,
                        { id: Date.now().toString(), content: '', images: [], remoteUrls: [], video: null, isHidden: false },
                      ])}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.textDim} style={{ marginRight: 4 }} />
                      <Text style={styles.addThreadText}>{tLocal('add_to_thread')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
                <Text style={[styles.dealTitle, isDeal && styles.dealTitleActive]}>{tLocal('post_deal')}</Text>
                <Text style={styles.dealDesc}>{tLocal('post_deal_desc')}</Text>
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
        <PhotoEditor
          visible={!!editingPhoto}
          imageUri={editingPhoto?.uri || ''}
          onCancel={() => setEditingPhoto(null)}
          onSave={(newUri) => {
            if (!editingPhoto) return
            const post = thread[editingPhoto.index]
            const newAsset = { ...editingPhoto.asset, uri: newUri }
            const newImages = [...post.images, newAsset].slice(0, 4 - post.remoteUrls.length)
            updatePost(editingPhoto.index, { images: newImages, video: null })
            setEditingPhoto(null)
          }}
        />
      </KeyboardAvoidingView>

        {/* Bottom bar: Options + character count */}
        <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bottomOptionsBtn} onPress={() => setShowOptions(true)}>
              <Ionicons name="settings-outline" size={18} color={colors.textDim} style={{ marginRight: 6 }} />
              <Text style={styles.bottomOptionsText}>{tLocal('options')}</Text>
            </TouchableOpacity>
            <View style={styles.charCountWrap}>
              <Text style={[
                styles.charCount,
                thread[0]?.content?.length > 240 && { color: '#ef4444' }
              ]}>
                {thread.reduce((sum, p) => sum + (p.content?.length || 0), 0)}
              </Text>
            </View>
          </View>
          {hasDraft && (
            <Text style={styles.draftSavedText}>✓ Draft auto-saved</Text>
          )}
        </View>

      {/* Post settings modal */}
      <Modal visible={showOptions} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowOptions(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{tLocal('post_settings')}</Text>
            <TouchableOpacity onPress={() => setShowOptions(false)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.settingSection}>
              <Text style={styles.settingHeader}>{tLocal('who_can_reply')}</Text>
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
                <Text style={styles.settingLabel}>{tLocal('ghost_post')}</Text>
                <Text style={styles.settingDesc}>{tLocal('ghost_desc')}</Text>
              </View>
              <Switch value={isGhost} onValueChange={setIsGhost} trackColor={{ true: '#f59e0b' }} />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Share Betting Code ⚽</Text>
                <Text style={styles.settingDesc}>Attach a booking code for others to copy</Text>
              </View>
              <Switch value={isBettingCode} onValueChange={setIsBettingCode} trackColor={{ true: '#10b981' }} />
            </View>

            {isBettingCode && (
              <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'stretch', marginTop: -8, paddingTop: 0, borderTopWidth: 0 }]}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.text, borderColor: colors.border, borderWidth: 1 }}
                    placeholder="Platform (e.g. SportyBet)"
                    placeholderTextColor={colors.textDim}
                    value={bettingPlatform}
                    onChangeText={setBettingPlatform}
                  />
                  <TextInput
                    style={{ flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.text, borderColor: colors.border, borderWidth: 1 }}
                    placeholder="Code (e.g. BC5TRQ)"
                    placeholderTextColor={colors.textDim}
                    value={bettingCode}
                    onChangeText={setBettingCode}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{tLocal('review_replies')}</Text>
                <Text style={styles.settingDesc}>{tLocal('review_desc')}</Text>
              </View>
              <Switch value={reviewReplies} onValueChange={setReviewReplies} trackColor={{ true: '#2563eb' }} />
            </View>

            <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={styles.settingLabel}>{tLocal('invite_collab')}</Text>
              <Text style={styles.settingDesc}>{tLocal('invite_desc')}</Text>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.text, borderColor: colors.border, borderWidth: 1 }}
                  placeholder="@username"
                  placeholderTextColor={colors.textDim}
                  value={coAuthorUsername}
                  onChangeText={(text) => {
                    setCoAuthorUsername(text.replace('@', '').toLowerCase().trim())
                    setCoAuthorId(null) // reset on change
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={{ backgroundColor: coAuthorId ? '#16a34a' : '#3b82f6', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, marginLeft: 8 }}
                  disabled={verifyingCoAuthor || !coAuthorUsername}
                  onPress={async () => {
                    if (!coAuthorUsername) return;
                    setVerifyingCoAuthor(true);
                    const { data } = await supabase.from('profiles').select('id').eq('username', coAuthorUsername).single();
                    if (data?.id) {
                      setCoAuthorId(data.id);
                      Alert.alert("Found!", "Collaborator successfully linked.");
                    } else {
                      Alert.alert("Not Found", "Could not find a user with that username.");
                      setCoAuthorId(null);
                    }
                    setVerifyingCoAuthor(false);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                    {verifyingCoAuthor ? '...' : coAuthorId ? 'Verified' : 'Verify'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Uploading Overlay */}
      <Modal transparent visible={loading} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={{ 
            alignItems: 'center',
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim 
          }}>
            <View style={{
              width: 100, height: 100, borderRadius: 50, 
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 2, borderColor: '#3b82f6'
            }}>
              <Ionicons name="cloud-upload" size={48} color="#3b82f6" />
            </View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 24, letterSpacing: 1 }}>POSTING...</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 8 }}>Please wait while your media uploads</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Upload Progress Timeline Modal */}
      <Modal visible={showUploadModal} animationType="fade" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 380, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Posting...</Text>
            <Text style={{ fontSize: 14, color: colors.textDim, marginBottom: 28, textAlign: 'center' }}>Please wait while we publish your post</Text>

            <View style={{ width: '100%', gap: 16 }}>
              {uploadSteps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {/* Step indicator */}
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor:
                      step.status === 'done' ? colors.primary :
                      step.status === 'active' ? (colors.isDark ? '#1e3a8a' : '#dbeafe') :
                      step.status === 'error' ? '#fee2e2' :
                      colors.border,
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: step.status === 'active' ? 2 : 0,
                    borderColor: colors.primary,
                  }}>
                    {step.status === 'done' && <Ionicons name="checkmark" size={18} color="#fff" />}
                    {step.status === 'active' && <ActivityIndicator size="small" color={colors.primary} />}
                    {step.status === 'error' && <Ionicons name="close" size={18} color="#ef4444" />}
                    {step.status === 'pending' && <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDim }}>{i + 1}</Text>}
                  </View>

                  {/* Step label + connector line */}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 15, fontWeight: step.status === 'active' ? '700' : '500',
                      color: step.status === 'active' ? colors.text :
                             step.status === 'done' ? colors.primary :
                             step.status === 'error' ? '#ef4444' :
                             colors.textDim,
                    }}>{step.label}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Progress bar */}
            <View style={{ width: '100%', height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 24, overflow: 'hidden' }}>
              <View style={{
                height: '100%',
                borderRadius: 2,
                backgroundColor: colors.primary,
                width: `${Math.round((uploadSteps.filter(s => s.status === 'done').length / Math.max(uploadSteps.length, 1)) * 100)}%`
              }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Copyright Agreement Modal — shown ONCE, remembered forever */}
      <Modal visible={showCopyrightModal} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 28, paddingBottom: Math.max(32, 28),
          }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.isDark ? '#1e3a8a30' : '#eff6ff',
                justifyContent: 'center', alignItems: 'center', marginBottom: 14,
              }}>
                <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                {tLocal('copyright_title')}
              </Text>
            </View>

            {/* Body */}
            <Text style={{ fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 21, marginBottom: 20 }}>
              {tLocal('copyright_body')}
            </Text>

            {/* Bullet points */}
            {(['copyright_point1', 'copyright_point2', 'copyright_point3'] as const).map((key, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 1,
                }}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
                <Text style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '500' }}>
                  {tLocal(key)}
                </Text>
              </View>
            ))}

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 14,
                  borderWidth: 1, borderColor: colors.border, alignItems: 'center',
                }}
                onPress={() => setShowCopyrightModal(false)}
              >
                <Text style={{ color: colors.textDim, fontWeight: '700', fontSize: 15 }}>
                  {tLocal('copyright_cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 2, paddingVertical: 14, borderRadius: 14,
                  backgroundColor: colors.primary, alignItems: 'center',
                }}
                onPress={async () => {
                  // Save acceptance — never show again
                  await AsyncStorage.setItem('@jpm_copyright_accepted', 'true')
                  setCopyrightAccepted(true)
                  setShowCopyrightModal(false)
                  executePost()
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                  {tLocal('copyright_accept')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 17, color: colors.text, fontWeight: '400' },
  postBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 20,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnDisabled: { backgroundColor: colors.border },
  postBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  postBtnTextDisabled: { color: colors.textDim },

  // Draft banner
  draftBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.isDark ? '#1e3a8a20' : '#eff6ff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.isDark ? '#1e3a8a40' : '#bfdbfe',
  },
  draftBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  draftDiscardBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.isDark ? '#1e3a8a40' : '#dbeafe' },
  draftDiscardText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  scroll: { flex: 1 },

  postItem: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16 },
  postLeft: { alignItems: 'center', width: 44, marginRight: 12 },
  avatarBase: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6366f1', overflow: 'hidden' },
  avatarGhost: { borderWidth: 2, borderColor: '#f59e0b' },
  threadLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 6, borderRadius: 1, minHeight: 20 },
  postRight: { flex: 1, paddingBottom: 16 },

  fullName: { fontSize: 15, fontWeight: '700', color: colors.text },
  ghostBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#fef3c7', borderRadius: 10 },
  ghostBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  privacyText: { fontSize: 14, color: colors.textDim, fontWeight: '700' },

  categoriesScroll: { marginBottom: 10 },
  categoryBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, marginRight: 8,
    backgroundColor: colors.border,
  },
  categoryBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryBtnText: { fontSize: 12, fontWeight: '700', color: colors.textDim },
  categoryBtnTextActive: { color: '#ffffff' },

  input: {
    fontSize: 17, color: colors.text,
    lineHeight: 24, minHeight: 60, paddingBottom: 8,
  },
  gifIcon: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  gifText: { fontSize: 10, color: colors.primary, fontWeight: '800' },

  addThreadBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  addThreadText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  addThreadCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 4 },

  bottomBarWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: colors.background,
  },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bottomOptionsBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.border },
  bottomOptionsText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  charCountWrap: { paddingHorizontal: 10 },
  charCount: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  draftSavedText: { fontSize: 12, color: colors.primary, fontWeight: '500', textAlign: 'center', marginTop: 6, marginBottom: 4 },

  // keep these for the old bottomPostBtn references in existing code
  bottomPostBtn: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12 },
  bottomPostBtnDisabled: { backgroundColor: colors.border },
  bottomPostText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
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
