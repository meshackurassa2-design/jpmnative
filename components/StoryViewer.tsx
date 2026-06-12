import { getCdnUrl } from '../lib/cdn';
// components/StoryViewer.tsx — Full-screen native story viewer
import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, Dimensions, TextInput, Modal, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { encryptMessage, getSharedSecret } from '../lib/crypto'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const DURATION = 5000

function timeLeft(expiresAt: string) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h left`
  return `${m}m left`
}

interface Story {
  id: string
  creator_id: string
  image_url?: string
  bg_color?: string
  text_content?: string
  expires_at: string
  view_count?: number
  profiles?: { id: string; full_name: string; username: string; avatar_url?: string }
  is_seen?: boolean
}

interface StoryGroup {
  profile: any
  stories: Story[]
  hasUnseen: boolean
}

interface Props {
  groups: StoryGroup[]
  startGroupIndex: number
  visible: boolean
  onClose: () => void
  onViewed: () => void
}

export function StoryViewer({ groups, startGroupIndex, visible, onClose, onViewed }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const insets = useSafeAreaInsets()

  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [slideIndex, setSlideIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const progressAnim = useRef(new Animated.Value(0)).current
  const progressRef = useRef<Animated.CompositeAnimation | null>(null)

  const currentGroup = groups[groupIndex]
  const current = currentGroup?.stories[slideIndex]

  const startProgress = () => {
    progressAnim.setValue(0)
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => {
      if (finished) goNext()
    })
  }

  const stopProgress = () => {
    progressRef.current?.stop()
  }

  useEffect(() => {
    if (!current) return
    startProgress()

    // Record view
    if (user && !current.is_seen) {
      supabase.from('story_views').insert({ story_id: current.id, viewer_id: user.id }).then(() => {})
    }

    // Check like
    if (user) {
      supabase.from('story_likes').select('id').eq('story_id', current.id).eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setIsLiked(!!data))
    }

    return () => stopProgress()
  }, [groupIndex, slideIndex])

  useEffect(() => {
    if (isPaused) stopProgress()
    else startProgress()
  }, [isPaused])

  const groupIndexRef = useRef(groupIndex)
  const slideIndexRef = useRef(slideIndex)
  useEffect(() => { groupIndexRef.current = groupIndex }, [groupIndex])
  useEffect(() => { slideIndexRef.current = slideIndex }, [slideIndex])

  const goNext = () => {
    const gi = groupIndexRef.current
    const si = slideIndexRef.current
    const grp = groups[gi]
    if (!grp) { onClose(); return }
    if (si < grp.stories.length - 1) {
      setSlideIndex(si + 1)
    } else if (gi < groups.length - 1) {
      setGroupIndex(gi + 1)
      setSlideIndex(0)
    } else {
      onViewed()
      onClose()
    }
  }

  const goPrev = () => {
    const gi = groupIndexRef.current
    const si = slideIndexRef.current
    if (si > 0) {
      setSlideIndex(s => s - 1)
    } else if (groupIndex > 0) {
      setGroupIndex(g => g - 1)
      setSlideIndex(0)
    } else {
      progressAnim.setValue(0)
      startProgress()
    }
  }

  const handleLike = async () => {
    if (!user || !current) return
    const newLiked = !isLiked
    setIsLiked(newLiked)
    if (newLiked) {
      await supabase.from('story_likes').insert({ story_id: current.id, user_id: user.id })
    } else {
      await supabase.from('story_likes').delete().eq('story_id', current.id).eq('user_id', user.id)
    }
  }

  const sendPushNotification = async (partnerId: string, type: string) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('push_token').eq('id', partnerId).single()
      if (!profile?.push_token || !user) return
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          sound: 'default',
          title: user.full_name || user.username || 'New Message',
          body: type === 'reaction' ? 'Reacted to your story 🌟' : 'Replied to your story 💬',
          data: { type: 'message', sender_id: user.id },
        }),
      })
    } catch {}
  }

  const handleReply = async () => {
    if (!user || !current || !reply.trim() || sending) return
    setSending(true)
    const content = reply.trim()
    setReply('')

    const secret = getSharedSecret(user.id, current.creator_id)
    const encrypted = await encryptMessage(`Replied to story: ${content}`, secret)

    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: current.creator_id,
      content: encrypted,
    } as any)
    
    sendPushNotification(current.creator_id, 'reply')
    setSending(false)
    setIsPaused(false)
  }

  const handleReaction = async (emoji: string) => {
    if (!user || !current || sending) return
    setSending(true)
    
    const secret = getSharedSecret(user.id, current.creator_id)
    const encrypted = await encryptMessage(`Reacted to your story: ${emoji}`, secret)

    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: current.creator_id,
      content: encrypted,
    } as any)
    
    sendPushNotification(current.creator_id, 'reaction')
    setSending(false)
    setIsPaused(false)
    onClose()
  }

  if (!current || !currentGroup) return null

  const bgColor = current.bg_color || '#000000'
  const textColor = bgColor === '#ffffff' ? '#000000' : '#ffffff'

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Background image */}
        {current.image_url ? (
          <Image source={{ uri: getCdnUrl(current.image_url) }} style={styles.bgImage} resizeMode="cover" />
        ) : null}

        {/* Dark overlay */}
        <View style={styles.overlay} />

        {/* Progress bars */}
        <View style={[styles.progressRow, { top: insets.top + 10 }]}>
          {currentGroup.stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: i < slideIndex
                      ? '100%'
                      : i === slideIndex
                        ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%'
                  }
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={[styles.header, { top: insets.top + 24 }]}>
          <TouchableOpacity
            style={styles.headerProfile}
            onPress={() => { onClose(); router.push(`/profile?id=${current.creator_id}`) }}
          >
            {currentGroup.profile?.avatar_url ? (
              <Image source={{ uri: getCdnUrl(currentGroup.profile.avatar_url) }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                  {currentGroup.profile?.full_name?.[0] || '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.headerName}>{currentGroup.profile?.full_name}</Text>
              <Text style={styles.headerTime}>{timeLeft(current.expires_at)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Text overlay */}
        {current.text_content ? (
          <View style={styles.textOverlay}>
            <Text style={[styles.storyText, { color: textColor }]}>
              {current.text_content}
            </Text>
          </View>
        ) : null}

        {/* Touch zones for prev/next */}
        <TouchableWithoutFeedback onPress={goPrev}>
          <View style={styles.tapLeft} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={goNext}>
          <View style={styles.tapRight} />
        </TouchableWithoutFeedback>

        {/* Bottom bar */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}
        >
          {user && user.id !== current.creator_id ? (
            <View>
              <View style={styles.replyRow}>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Send message..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={reply}
                  onChangeText={setReply}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onSubmitEditing={handleReply}
                />
                <TouchableOpacity style={styles.likeBtn} onPress={handleLike} activeOpacity={0.7}>
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={26}
                    color={isLiked ? '#ef4444' : '#ffffff'}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.likeBtn} onPress={handleReply} activeOpacity={0.7}>
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="paper-plane-outline" size={24} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
              
              <View style={styles.quickReactionsRow}>
                {['❤️', '😂', '😮', '🔥', '👏'].map(emoji => (
                  <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)} style={styles.quickReactionBtn}>
                    <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  bgImage: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  progressRow: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', gap: 4, zIndex: 50,
  },
  progressTrack: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#ffffff', borderRadius: 2 },
  header: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 50,
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  headerAvatarFallback: { backgroundColor: '#444', justifyContent: 'center', alignItems: 'center' },
  headerName: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  headerTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 4 },
  textOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, zIndex: 20,
  },
  storyText: { fontSize: 34, fontWeight: '900', textAlign: 'center', lineHeight: 42 },
  tapLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: SCREEN_W * 0.3, zIndex: 40 },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: SCREEN_W * 0.3, zIndex: 40 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 28, paddingHorizontal: 18, paddingVertical: 10,
    color: '#ffffff', fontSize: 15, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  likeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  quickReactionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16, paddingBottom: 8 },
  quickReactionBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24 },
  quickReactionEmoji: { fontSize: 28 },
})
