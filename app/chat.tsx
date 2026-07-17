import { getCdnUrl } from '../lib/cdn';
import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Platform, Image, ActivityIndicator, Alert, Modal,
  Dimensions, Animated, InteractionManager, Keyboard
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const KeyboardAvoidingView = require('react-native').KeyboardAvoidingView
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BackButton } from '../components/BackButton'
import { encryptMessage, decryptMessage, getSharedSecret } from '../lib/crypto'
import { Audio } from 'expo-av'
import { GiphyPicker } from '../components/GiphyPicker'
import { Skeleton } from '../components/Skeleton'
import { VibeBadge } from '../components/VibeBadge'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PanResponder, TouchableWithoutFeedback } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { CoinIcon } from '../components/CoinIcon'

type Message = {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
  is_read: boolean
  is_shop_chat?: boolean
  is_offer?: boolean
  offer_amount?: number
  offer_status?: string // 'pending', 'accepted', 'declined'
  offer_product_id?: string
  reactions?: Record<string, string>
}

// ── Swipe to reply wrapper ────────────────────────────────────────────────────
const SwipeableMessage = React.memo(({ children, onSwipe, mine }: { children: React.ReactNode; onSwipe: () => void; mine: boolean }) => {
  const translateX = useRef(new Animated.Value(0)).current

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 5,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 5,
    onPanResponderMove: (_, g) => {
      if (g.dx > 0) translateX.setValue(Math.min(g.dx, 60))
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > 50) onSwipe()
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
    },
  })).current

  return (
    <Animated.View style={{ flexShrink: 1, transform: [{ translateX }] }} {...panResponder.panHandlers}>
      {children}
    </Animated.View>
  )
})

// Emoji grid — matches web
const EMOJIS = ['😂', '❤️', '🔥', '👀', '😭', '💀', '🤣', '✨', '😤', '🙏', '👏', '😍', '🥺', '💪', '⚡', '🎉', '😈', '🤝', '🫡', '😎', '🤯', '💯', '👑', '🫶']

// ── Voice note player component ──────────────────────────────────────────────
const VoiceNote = React.memo(({ url, mine }: { url: string; mine: boolean }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const soundRef = useRef<Audio.Sound | null>(null)

  const play = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync()
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync()
          setPlaying(false)
          return
        }
        if (status.isLoaded) {
          await soundRef.current.playFromPositionAsync(0)
          setPlaying(true)
          return
        }
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis || 0)
            setDuration(status.durationMillis || 0)
            if (status.didJustFinish) {
              setPlaying(false)
              setPosition(0)
            }
          }
        }
      )
      soundRef.current = sound
      setPlaying(true)
    } catch (e: any) {
      if (e?.message?.includes('-11828')) {
        Alert.alert('Unsupported format', 'This voice note was recorded on the web (.webm) and iOS does not support it natively.')
      } else {
        console.error('Voice playback error:', e)
      }
    }
  }

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync() }
  }, [])

  const progress = duration > 0 ? position / duration : 0
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <TouchableOpacity onPress={play} style={styles.voiceNote} activeOpacity={0.7}>
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={22}
        color={mine ? colors.background : '#2563eb'}
      />
      <View style={styles.voiceWaveform}>
        <View style={[styles.voiceProgress, { width: `${progress * 100}%` as any }, mine ? styles.voiceProgressMine : null]} />
      </View>
      <Text style={[styles.voiceTime, mine ? styles.voiceTimeMine : null]}>
        {formatTime(playing ? position : duration)}
      </Text>
    </TouchableOpacity>
  )
})

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { id, is_shop, make_offer, product_id, product_name } = useLocalSearchParams<{ id: string, is_shop?: string, make_offer?: string, product_id?: string, product_name?: string }>()
  const { user } = useAuth()
  const supabase = createClient()
  const insets = useSafeAreaInsets()

  const [partner, setPartner] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const isShopChat = is_shop === 'true' || !!make_offer

  const [requestStatus, setRequestStatus] = useState<string | null>('allowed')
  const [checkingRequest, setCheckingRequest] = useState(true)

  const [isPartnerOnline, setIsPartnerOnline] = useState(false)
  const [isKeyboardVisible, setKeyboardVisible] = useState(false)

  const [showGiphy, setShowGiphy] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const recordingRef = useRef<Audio.Recording | null>(null)
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  const flatListRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const channelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [selectedMessageMenu, setSelectedMessageMenu] = useState<{msg: Message, content: string} | null>(null)

  // ── Local persistent reactions cache (bypasses RLS) ──────────────────────
  const REACTIONS_CACHE_KEY = `@reactions_${user?.id}_${id}`

  const mergeReactionsIntoMessages = useCallback(async (msgs: Message[]) => {
    try {
      const cached = await AsyncStorage.getItem(REACTIONS_CACHE_KEY)
      if (!cached) return msgs
      const reactionsMap: Record<string, Record<string, string>> = JSON.parse(cached)
      return msgs.map(m => reactionsMap[m.id] ? { ...m, reactions: { ...(m.reactions || {}), ...reactionsMap[m.id] } } : m)
    } catch {
      return msgs
    }
  }, [REACTIONS_CACHE_KEY])

  const handleReaction = async (emoji: string) => {
    if (!selectedMessageMenu || !user) return
    const msgId = selectedMessageMenu.msg.id
    setSelectedMessageMenu(null)

    // 1. Update local state immediately
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m
      return { ...m, reactions: { ...(m.reactions || {}), [user.id]: emoji } }
    }))

    // 2. Persist to local AsyncStorage cache (survives re-opens, bypasses RLS)
    try {
      const cached = await AsyncStorage.getItem(REACTIONS_CACHE_KEY)
      const reactionsMap: Record<string, Record<string, string>> = cached ? JSON.parse(cached) : {}
      reactionsMap[msgId] = { ...(reactionsMap[msgId] || {}), [user.id]: emoji }
      await AsyncStorage.setItem(REACTIONS_CACHE_KEY, JSON.stringify(reactionsMap))
    } catch (e) {
      console.error('Failed to save reaction to cache', e)
    }

    // 3. Also try Supabase (best effort)
    const currentMsg = messages.find(m => m.id === msgId)
    const newReactions = { ...(currentMsg?.reactions || {}), [user.id]: emoji }
    supabase.from('messages').update({ reactions: newReactions }).eq('id', msgId).then()
  }

  const sharedSecret = user && id ? getSharedSecret(user.id, id) : ''
  const offerSentRef = useRef(false)

  useEffect(() => {
    if (!make_offer || !user || !id || offerSentRef.current) return
    offerSentRef.current = true
    const sendOffer = async () => {
      const content = `[Offer] Make an Offer: TZS ${parseFloat(make_offer).toLocaleString()} for "${product_name ? decodeURIComponent(product_name) : 'a product'}"`
      const encrypted = await encryptMessage(content, getSharedSecret(user.id, id))
      await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: id,
        content: encrypted,
        is_shop_chat: true,
        is_offer: true,
        offer_amount: parseFloat(make_offer),
        offer_status: 'pending',
        offer_product_id: product_id || null,
      } as any)
    }
    sendOffer()
  }, [make_offer, user, id])

  useEffect(() => {
    if (!id) return
    AsyncStorage.getItem(`@partner_${id}`).then(cached => {
      if (cached) try { setPartner(JSON.parse(cached)) } catch {}
    })
    supabase.from('profiles').select('id, full_name, username, avatar_url, is_verified, settings').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setPartner(data)
          AsyncStorage.setItem(`@partner_${id}`, JSON.stringify(data))
        }
      })
  }, [id])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const checkRequestStatus = useCallback(async () => {
    if (!user || !id) return
    if (is_shop === 'true' || !!make_offer) {
      setRequestStatus('allowed')
      setCheckingRequest(false)
      return
    }
    setCheckingRequest(true)

    const { data: reqs } = await supabase
      .from('message_requests')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false })
      .limit(1)

    const req = reqs?.[0]
    if (req) {
      if ((req as any).status === 'accepted') {
        setRequestStatus('allowed')
      } else if ((req as any).status === 'pending') {
        if ((req as any).sender_id === user.id) setRequestStatus('pending_sent')
        else setRequestStatus('pending_received')
      } else if ((req as any).status === 'declined') {
        setRequestStatus('declined')
      }
      setCheckingRequest(false)
      return
    }

    const { data: followData } = await supabase
      .from('follows')
      .select('*')
      .or(`and(follower_id.eq.${user.id},following_id.eq.${id}),and(follower_id.eq.${id},following_id.eq.${user.id})`)

    if (followData && followData.length > 0) {
      setRequestStatus('allowed')
      setCheckingRequest(false)
      return
    }

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)

    if ((count || 0) > 0) {
      setRequestStatus('allowed')
      setCheckingRequest(false)
      return
    }

    setRequestStatus(null)
    setCheckingRequest(false)
  }, [user, id])

  useEffect(() => { checkRequestStatus() }, [checkRequestStatus])

  const loadMessages = useCallback(async () => {
    if (!user || !id) return

    const cacheKey = `@chat_${user.id}_${id}_${isShopChat}`
    const cached = await AsyncStorage.getItem(cacheKey)
    if (cached) {
      try {
        setMessages(JSON.parse(cached))
        setLoading(false)
      } catch (e) {}
    }

    let query = supabase
      .from('messages')
      .select('*')
      .in('sender_id', [user.id, id])
      .in('receiver_id', [user.id, id])
      .order('created_at', { ascending: false })
      .limit(100)

    if (isShopChat) {
      query = query.eq('is_shop_chat', true)
    } else {
      query = query.or('is_shop_chat.eq.false,is_shop_chat.is.null')
    }

    const { data } = await query

    if (data) {
      const decrypted = await Promise.all(
        data.map(async (m: Message) => ({
          ...m,
          content: await decryptMessage(m.content, sharedSecret),
        }))
      )
      // Merge in locally-cached reactions so they survive re-opens
      const withReactions = await mergeReactionsIntoMessages(decrypted)
      setMessages(withReactions)
    }
    setLoading(false)

    let updateQuery = supabase
      .from('messages')
      .update({ is_read: true } as any)
      .eq('sender_id', id)
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    if (isShopChat) {
      updateQuery = updateQuery.eq('is_shop_chat', true)
    } else {
      updateQuery = updateQuery.or('is_shop_chat.eq.false,is_shop_chat.is.null')
    }
    await updateQuery
  }, [user, id, sharedSecret])

  useEffect(() => { 
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!user || !id || messages.length === 0) return
    AsyncStorage.setItem(`@chat_${user.id}_${id}_${isShopChat}`, JSON.stringify(messages))
  }, [messages, user, id])

  useEffect(() => {
    if (!user || !id) return
    const roomName = [user.id, id].sort().join('-')
    const channelName = `chat-${roomName}`

    const channel = supabase
      .channel(channelName, {
        config: { presence: { key: user.id } }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setIsPartnerOnline(!!state[id])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, async (payload) => {
        if (payload.new.sender_id === id && Boolean(payload.new.is_shop_chat) === isShopChat) {
          const decryptedContent = await decryptMessage(payload.new.content, sharedSecret)
          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [{ ...payload.new, content: decryptedContent } as Message, ...prev]
          })
          setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100)
          supabase.from('messages').update({ is_read: true } as any).eq('id', payload.new.id).then()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, (payload) => {
        // Catch reaction updates from the other person
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, reactions: payload.new.reactions, offer_status: payload.new.offer_status || m.offer_status } : m))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, is_read: payload.new.is_read, reactions: payload.new.reactions, offer_status: payload.new.offer_status || m.offer_status } : m))
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id === id) {
          setIsTyping(true)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })
    
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [user, id, sharedSecret])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 100)
    }
  }, [messages.length])

  const handleTextChange = (text: string) => {
    setInput(text)
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user.id },
      })
    }
  }

  const handleInitialMessageRequest = async (initialMessageText: string) => {
    if (requestStatus !== null || !user || !id) return
    const { error: reqErr } = await supabase.from('message_requests').insert({
      sender_id: user.id,
      receiver_id: id,
      status: 'pending',
      initial_message: initialMessageText,
    } as any)
    if (reqErr) {
      await supabase.from('message_requests').insert({
        sender_id: user.id,
        receiver_id: id,
        status: 'pending',
      } as any)
    }
    setRequestStatus('pending_sent')
  }

  const sendPushNotification = async (type: string) => {
    if (!partner?.push_token || !user) return
    const body = type === 'voice' ? 'Sent you a voice note 🎤' : type === 'gif' ? 'Sent you a GIF 🖼️' : 'Sent you a new message 💬'
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: partner.push_token,
          sound: 'default',
          title: user.full_name || user.username || 'New Message',
          body,
          data: { type: 'message', sender_id: user.id },
        }),
      })
    } catch (e) {}
  }

  const sendMessage = async () => {
    if (!input.trim() || !user || !id || sending) return
    const text = input.trim()
    const payloadText = replyingTo ? `reply:${replyingTo.id}|${text}` : text
    setInput('')
    setShowEmoji(false)
    setSending(true)
    setReplyingTo(null)

    const encrypted = await encryptMessage(payloadText, sharedSecret)
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: id,
      content: encrypted,
      is_shop_chat: isShopChat,
    } as any)

    if (error) {
      Alert.alert('Error', 'Failed to send message')
      setInput(text)
    } else {
      await handleInitialMessageRequest(text)
      sendPushNotification('text')
      setMessages(prev => [{
        id: Date.now().toString(),
        content: payloadText,
        sender_id: user.id,
        receiver_id: id,
        created_at: new Date().toISOString(),
        is_read: false,
        is_shop_chat: isShopChat,
      }, ...prev])
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50)
    }
    setSending(false)
  }

  const sendGif = async (url: string) => {
    if (!user || !id) return
    setShowGiphy(false)
    const payloadText = replyingTo ? `reply:${replyingTo.id}|gif:${url}` : `gif:${url}`
    setReplyingTo(null)
    const encrypted = await encryptMessage(payloadText, sharedSecret)
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: id,
      content: encrypted,
      is_shop_chat: isShopChat,
    } as any)
    if (!error) {
      await handleInitialMessageRequest('🎬 Sent a GIF')
      sendPushNotification('gif')
      setMessages(prev => [{
        id: Date.now().toString(),
        content: payloadText,
        sender_id: user.id,
        receiver_id: id,
        created_at: new Date().toISOString(),
        is_read: false,
        is_shop_chat: isShopChat,
      }, ...prev])
    }
  }

  const addEmoji = (emoji: string) => {
    setInput(prev => prev + emoji)
    inputRef.current?.focus()
  }


  const startRecording = async () => {
    if (recording) {
      stopAndSendVoice()
      return
    }
    try {
      const perm = await Audio.requestPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission', 'Microphone access is needed to send voice notes.')
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = rec
      setRecording(true)
      setRecordingDuration(0)

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start()

      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

    } catch (e) {
      console.error('Recording start failed:', e)
    }
  }

  const stopAndSendVoice = async () => {
    const rec = recordingRef.current
    if (!rec || !user || !id) return
    setRecording(false)
    pulseAnim.stopAnimation()
    pulseAnim.setValue(1)
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current)
      recordingTimer.current = null
    }

    try {
      await rec.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      const uri = rec.getURI()
      if (!uri) return

      const ext = 'm4a'
      const path = `${user.id}/${Date.now()}.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadErr } = await supabase.storage
        .from('voice-notes')
        .upload(path, blob, { contentType: 'audio/mp4' })

      if (uploadErr) {
        console.error('Voice upload failed:', uploadErr)
        return
      }

      const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(path)
      const voiceUrl = urlData?.publicUrl
      if (!voiceUrl) return

      const payloadText = replyingTo ? `reply:${replyingTo.id}|voice:${voiceUrl}` : `voice:${voiceUrl}`
      setReplyingTo(null)

      const encrypted = await encryptMessage(payloadText, sharedSecret)
      await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: id,
        content: encrypted,
        is_shop_chat: isShopChat,
      } as any)

      await handleInitialMessageRequest('🎤 Sent a voice note')
      sendPushNotification('voice')
      setMessages(prev => [{
        id: Date.now().toString(),
        content: payloadText,
        sender_id: user.id,
        receiver_id: id,
        created_at: new Date().toISOString(),
        is_read: false,
        is_shop_chat: isShopChat,
      }, ...prev])
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50)

    } catch (e) {
      console.error('Voice send failed:', e)
    }
    recordingRef.current = null
  }

  const cancelRecording = async () => {
    const rec = recordingRef.current
    if (!rec) return
    setRecording(false)
    pulseAnim.stopAnimation()
    pulseAnim.setValue(1)
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current)
      recordingTimer.current = null
    }
    try {
      await rec.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    } catch {}
    recordingRef.current = null
  }

  const sendMessageRequest = async () => {
    if (!user || !id) return
    setCheckingRequest(true)
    await supabase.from('message_requests').insert({
      sender_id: user.id, receiver_id: id, status: 'pending'
    } as any)
    setRequestStatus('pending_sent')
    setCheckingRequest(false)
  }

  const acceptRequest = async () => {
    if (!user || !id) return
    setCheckingRequest(true)
    await supabase.from('message_requests')
      .update({ status: 'accepted' } as any)
      .eq('sender_id', id).eq('receiver_id', user.id)
    setRequestStatus('allowed')
    setCheckingRequest(false)
  }

  const declineRequest = async () => {
    if (!user || !id) return
    setCheckingRequest(true)
    await supabase.from('message_requests')
      .update({ status: 'declined' } as any)
      .eq('sender_id', id).eq('receiver_id', user.id)
    setRequestStatus('declined')
    setCheckingRequest(false)
  }

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const formatRecordingTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const renderMessage = ({ item: msg, index }: { item: Message; index: number }) => {
    const mine = msg.sender_id === user?.id
    const olderMsg = messages[index + 1]
    const newerMsg = messages[index - 1]
    const sameAsOlder = olderMsg?.sender_id === msg.sender_id
    const sameAsNewer = newerMsg?.sender_id === msg.sender_id

    let actualContent = msg.content
    let replyMsg: Message | undefined = undefined
    if (msg.content.startsWith('reply:')) {
      const splitIdx = msg.content.indexOf('|')
      if (splitIdx !== -1) {
        const replyId = msg.content.slice(6, splitIdx)
        actualContent = msg.content.slice(splitIdx + 1)
        replyMsg = messages.find(m => m.id === replyId)
      }
    }

    const borderRadius = {
      borderTopLeftRadius: mine ? 20 : (sameAsOlder ? 6 : 20),
      borderTopRightRadius: mine ? (sameAsOlder ? 6 : 20) : 20,
      borderBottomLeftRadius: mine ? 20 : (sameAsNewer ? 6 : 20),
      borderBottomRightRadius: mine ? (sameAsNewer ? 6 : 20) : 20,
    }

    const isVoice = actualContent.startsWith('voice:')
    const isGif = actualContent.startsWith('gif:')
    const isOffer = msg.is_offer === true
    const isPayment = actualContent.startsWith('💰 Payment Sent:') || actualContent.startsWith('[Payment] Payment Sent:')

    const handleAcceptOffer = async () => {
      await supabase.from('messages').update({ offer_status: 'accepted' } as any).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, offer_status: 'accepted' } : m))
    }
    const handleDeclineOffer = async () => {
      await supabase.from('messages').update({ offer_status: 'declined' } as any).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, offer_status: 'declined' } : m))
    }

    if (isOffer || isPayment) {
      const status = msg.offer_status || 'pending'
      const isSeller = !mine
      
      const borderColor = isPayment ? '#f59e0b' : (status === 'accepted' ? '#16a34a' : status === 'declined' ? '#ef4444' : '#f59e0b');
      const bgColor = isPayment ? '#f59e0b22' : (status === 'accepted' ? '#16a34a22' : status === 'declined' ? '#ef444422' : '#f59e0b22');

      return (
        <View style={[styles.msgRow, { justifyContent: 'center', marginVertical: 6 }]}>
          <View style={{
            width: '90%', maxWidth: 340,
            backgroundColor: colors.card || '#111',
            borderRadius: 20, padding: 16,
            borderWidth: 1.5,
            borderColor,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                {isPayment ? <CoinIcon size={20} /> : <Text style={{ fontSize: 18 }}>{status === 'accepted' ? '✅' : status === 'declined' ? '❌' : '🤝'}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{isPayment ? 'Payment' : 'Price Offer'}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }} numberOfLines={1}>{actualContent.replace('💰 Make an Offer: ', '').replace('[Offer] Make an Offer: ', '')}</Text>
              </View>
            </View>

            {!isPayment && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: borderColor, fontWeight: '700', fontSize: 13 }}>
                  {status === 'pending' ? '⏳ Awaiting response' : status === 'accepted' ? '✅ Offer Accepted!' : '❌ Offer Declined'}
                </Text>
                {status === 'pending' && isSeller && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={handleDeclineOffer} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ef444420', borderWidth: 1, borderColor: '#ef4444' }}>
                      <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleAcceptOffer} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#16a34a', borderWidth: 1, borderColor: '#16a34a' }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {status === 'accepted' && mine && (
                  <TouchableOpacity
                    onPress={() => router.push(`/cart`)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#16a34a' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Checkout →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )
    }

    const handleLongPress = () => {
      setSelectedMessageMenu({ msg, content: actualContent })
    }

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs, { marginTop: sameAsOlder ? 2 : 10 }]}>
        {/* Inner horizontal row: avatar + bubble */}
        <View style={[styles.msgRowInner, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
          {!mine && !sameAsNewer && partner?.avatar_url ? (
            <Image source={{ uri: getCdnUrl(partner.avatar_url) }} style={styles.msgAvatar} />
          ) : !mine ? (
            <View style={styles.msgAvatarSpacer} />
          ) : null}

          <SwipeableMessage
            mine={mine}
            onSwipe={() => setReplyingTo({ ...msg, content: actualContent })}
          >
            {replyMsg && (
              <View style={[styles.replyPreview, mine ? styles.replyPreviewMine : styles.replyPreviewTheirs, { alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {(() => {
                    let text = replyMsg.content || ''
                    if (text.startsWith('reply:')) {
                      const splitIdx = text.indexOf('|')
                      if (splitIdx !== -1) text = text.slice(splitIdx + 1)
                    }
                    if (text.startsWith('voice:')) return '🎤 Voice note'
                    if (text.startsWith('gif:')) return '🖼️ GIF'
                    return text
                  })()}
                </Text>
              </View>
            )}

            {isVoice ? (
              <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, borderRadius, { paddingHorizontal: 8, paddingVertical: 6, alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
                <VoiceNote url={actualContent.slice(6)} mine={mine} />
              </TouchableOpacity>
            ) : isGif ? (
              <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9} style={[{ overflow: 'hidden', maxWidth: SCREEN_WIDTH * 0.72, alignSelf: mine ? 'flex-end' : 'flex-start' }, borderRadius]}>
                <Image source={{ uri: getCdnUrl(actualContent.slice(4)) }} style={styles.gifMessage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, borderRadius, { alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
                <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                  {actualContent}
                </Text>
              </TouchableOpacity>
            )}

            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <View style={[styles.reactionsContainer, mine ? styles.reactionsContainerMine : styles.reactionsContainerTheirs]}>
                {Array.from(new Set(Object.values(msg.reactions))).map((emoji, i) => (
                  <Text key={i} style={styles.reactionPillEmoji}>{emoji}</Text>
                ))}
                {Object.keys(msg.reactions).length > 1 && (
                  <Text style={styles.reactionPillCount}>{Object.keys(msg.reactions).length}</Text>
                )}
              </View>
            )}
          </SwipeableMessage>
        </View>

        {/* Time + tick — BELOW the bubble */}
        {!sameAsNewer && mine && (
          <View style={[styles.msgTimeRow, { alignSelf: 'flex-end', marginTop: 2, marginRight: 6 }]}>
            <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
            <Ionicons name="checkmark-done" size={13} color={msg.is_read ? '#3b82f6' : colors.textDim} style={{ marginLeft: 3 }} />
          </View>
        )}
        {!sameAsNewer && !mine && (
          <View style={[styles.msgTimeRow, { alignSelf: 'flex-start', marginTop: 2, marginLeft: 40 }]}>
            <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: 0 }]} edges={['top']}>
      <View style={styles.header}>
        <BackButton style={{ marginRight: 12 }} />
        <View style={{ position: 'relative' }}>
          {partner?.avatar_url ? (
            <Image source={{ uri: getCdnUrl(partner.avatar_url) }} style={styles.headerAvatar} />
          ) : partner ? (
            <View style={[styles.headerAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{partner.full_name?.[0] || partner.username?.[0] || '?'}</Text>
            </View>
          ) : (
            <Skeleton width={40} height={40} borderRadius={20} />
          )}
          {partner && <VibeBadge vibe={partner.settings?.vibe} size={14} style={{ position: 'absolute', bottom: -2, right: -2 }} />}
        </View>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => router.push(`/user-profile?id=${id}` as any)}
          activeOpacity={0.7}
        >
          {partner ? (
            <>
              <Text style={styles.headerName} numberOfLines={1}>{partner.full_name || partner.username || 'User'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.headerUsername}>@{partner.username || 'user'}</Text>
                {isPartnerOnline && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                    <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '700' }}>Online</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={{ gap: 4 }}>
              <Skeleton width={120} height={16} borderRadius={4} />
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}
      >
        {loading ? (
          <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 20 }}>
            {/* Bubble 1 (Theirs) */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
              <View style={{ gap: 4 }}>
                <Skeleton width={180} height={38} borderRadius={20} style={{ borderBottomLeftRadius: 6 }} />
                <Skeleton width={120} height={38} borderRadius={20} />
              </View>
            </View>

            {/* Bubble 2 (Mine) */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Skeleton width={220} height={38} borderRadius={20} style={{ borderBottomRightRadius: 6 }} />
            </View>

            {/* Bubble 3 (Mine) */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Skeleton width={140} height={38} borderRadius={20} style={{ borderBottomRightRadius: 6 }} />
            </View>

            {/* Bubble 4 (Theirs) */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
              <Skeleton width={200} height={50} borderRadius={20} style={{ borderBottomLeftRadius: 6 }} />
            </View>

            {/* Bubble 5 (Mine) */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Skeleton width={240} height={38} borderRadius={20} style={{ borderBottomRightRadius: 6 }} />
                <Skeleton width={180} height={38} borderRadius={20} style={{ borderBottomRightRadius: 6 }} />
              </View>
            </View>

            {/* Bubble 6 (Theirs) */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
              <Skeleton width={160} height={38} borderRadius={20} style={{ borderBottomLeftRadius: 6 }} />
            </View>
            
            {/* Bubble 7 (Mine) */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Skeleton width={190} height={38} borderRadius={20} style={{ borderBottomRightRadius: 6 }} />
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' }}
            showsVerticalScrollIndicator={false}
            inverted
            onContentSizeChange={() => {}}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color="#e4e4e7" />
                <Text style={styles.emptyText}>Start a conversation!</Text>
              </View>
            }
          />
        )}

        {showEmoji && (
          <View style={styles.emojiPicker}>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => addEmoji(e)} style={styles.emojiBtn}>
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {checkingRequest ? (
          <View style={[styles.requestBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <ActivityIndicator size="small" color="#000" />
          </View>
        ) : (requestStatus === 'allowed' || requestStatus === null) ? (
          recording ? (
            <View style={[styles.recordingBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity onPress={cancelRecording} style={styles.recordCancelBtn}>
                <Ionicons name="close" size={24} color="#ef4444" />
              </TouchableOpacity>
              <View style={styles.recordingInfo}>
                <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
              </View>
              <TouchableOpacity onPress={stopAndSendVoice} style={styles.recordSendBtn}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {requestStatus === null && (
                <View style={styles.initialRequestBanner}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563eb" />
                  <Text style={styles.initialRequestBannerText}>
                    Send one introductory message along with your request so {partner?.full_name?.split(' ')[0] || 'they'} can accept and start chatting.
                  </Text>
                </View>
              )}
              {replyingTo && (
                <View style={styles.replyingToBar}>
                  <View style={styles.replyingToContent}>
                    <Text style={styles.replyingToLabel}>Replying to {replyingTo.sender_id === user?.id ? 'yourself' : partner?.full_name?.split(' ')[0]}</Text>
                    <Text style={styles.replyingToText} numberOfLines={1}>
                      {(() => {
                        let text = replyingTo.content || ''
                        if (text.startsWith('reply:')) {
                          const splitIdx = text.indexOf('|')
                          if (splitIdx !== -1) text = text.slice(splitIdx + 1)
                        }
                        if (text.startsWith('voice:')) return '🎤 Voice note'
                        if (text.startsWith('gif:')) return '🖼️ GIF'
                        return text
                      })()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={24} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
              )}
              {isTyping && (
                <Text style={styles.typingIndicatorText}>
                  {partner?.full_name?.split(' ')[0] || partner?.username || 'User'} is typing...
                </Text>
              )}
              <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.inputRow}>
                  <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder={requestStatus === null ? `Introduce yourself to ${partner?.full_name?.split(' ')[0] || 'them'}...` : "Type a message..."}
                    placeholderTextColor="#a1a1aa"
                    value={input}
                    onChangeText={handleTextChange}
                    autoFocus={false}
                    multiline
                    maxLength={1000}
                  />
                  {!input.trim() && (
                    <>
                      {/* GIF button */}
                      <TouchableOpacity
                        onPress={() => { setShowGiphy(!showGiphy); setShowEmoji(false) }}
                        style={styles.inputIconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={[styles.gifIconBox, showGiphy && styles.gifIconBoxActive]}>
                          <Text style={[styles.gifIconText, showGiphy && styles.gifIconTextActive]}>GIF</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Emoji button */}
                      <TouchableOpacity
                        onPress={() => { setShowEmoji(!showEmoji); setShowGiphy(false) }}
                        style={styles.inputIconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="happy-outline" size={24} color={showEmoji ? '#2563eb' : colors.textDim} />
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Mic button — only when no text */}
                  {!input.trim() && (
                    <TouchableOpacity
                      onPress={startRecording}
                      style={styles.inputIconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="mic-outline" size={24} color="#a1a1aa" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Send button — only when there's text */}
                {(input.trim() || sending) ? (
                  <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={!input.trim() || sending}
                    activeOpacity={0.7}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )
        ) : requestStatus === 'pending_sent' ? (
          <View style={[styles.requestBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.requestBannerTitle}>Message request sent</Text>
            <Text style={styles.requestBannerDesc}>We sent your introductory message to {partner?.full_name}. You can continue chatting once they accept your request.</Text>
          </View>
        ) : requestStatus === 'pending_received' ? (
          <View style={[styles.requestBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.requestBannerTitle}>{partner?.full_name} wants to message you.</Text>
            <Text style={[styles.requestBannerDesc, { marginBottom: 12 }]}>If you accept, they will be able to continue chatting with you.</Text>
            <View style={styles.requestBannerActions}>
              <TouchableOpacity style={styles.btnDecline} onPress={declineRequest}>
                <Text style={styles.btnDeclineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAccept} onPress={acceptRequest}>
                <Text style={styles.btnAcceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : requestStatus === 'declined' ? (
          <View style={[styles.requestBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.requestBannerDesc}>This request was declined.</Text>
          </View>
        ) : null}

      </KeyboardAvoidingView>

      {/* GIF Picker modal */}
      <GiphyPicker
        visible={showGiphy}
        onClose={() => setShowGiphy(false)}
        onGifSelect={sendGif}
      />

      <Modal visible={!!selectedMessageMenu} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setSelectedMessageMenu(null)}>
          <View style={styles.modalOverlay}>
            {selectedMessageMenu && (
              <TouchableWithoutFeedback>
                <View style={styles.contextMenuContainer}>
                  {/* Emoji Reactions */}
                  <View style={styles.reactionBar}>
                    {['❤️', '😂', '😮', '😢', '😡', '👍', '➕'].map(emoji => (
                      <TouchableOpacity key={emoji} style={styles.reactionEmojiBtn} onPress={() => handleReaction(emoji)}>
                        <Text style={styles.reactionEmojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Date Header */}
                  <View style={styles.contextMenuDateContainer}>
                    <Text style={styles.contextMenuDateText}>
                      {new Date(selectedMessageMenu.msg.created_at).toLocaleDateString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
                    </Text>
                  </View>

                  {/* Action List */}
                  <View style={styles.actionList}>
                    <TouchableOpacity 
                      style={styles.actionItem} 
                      onPress={() => {
                        setReplyingTo({ ...selectedMessageMenu.msg, content: selectedMessageMenu.content })
                        setSelectedMessageMenu(null)
                      }}
                    >
                      <Ionicons name="arrow-undo-outline" size={24} color="#e4e4e7" />
                      <Text style={styles.actionText}>Reply</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionItem} 
                      onPress={() => {
                        Clipboard.setStringAsync(selectedMessageMenu.content)
                        Alert.alert('Copied', 'Message copied to clipboard.')
                        setSelectedMessageMenu(null)
                      }}
                    >
                      <Ionicons name="copy-outline" size={24} color="#e4e4e7" />
                      <Text style={styles.actionText}>Copy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionItem, { borderBottomWidth: 0 }]} 
                      onPress={async () => {
                        const msgId = selectedMessageMenu.msg.id
                        setMessages(prev => prev.filter(m => m.id !== msgId))
                        setSelectedMessageMenu(null)
                        await supabase.from('messages').delete().eq('id', msgId)
                      }}
                    >
                      <Ionicons name="trash-outline" size={24} color="#e4e4e7" />
                      <Text style={styles.actionText}>Delete for you</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionItem, { borderTopWidth: 1, borderTopColor: '#3f3f46', borderBottomWidth: 0 }]} 
                      onPress={() => {
                        Alert.alert('Reported', 'Message reported. Our team will review this shortly.')
                        setSelectedMessageMenu(null)
                      }}
                    >
                      <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
                      <Text style={[styles.actionText, { color: '#ef4444' }]}>Report</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  )
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.textDim },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerUsername: { fontSize: 13, color: colors.textDim, marginTop: 1 },

  messagesList: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  msgRow: { flexDirection: 'column', gap: 0 },
  msgRowMine: { alignItems: 'flex-end' },
  msgRowTheirs: { alignItems: 'flex-start' },
  msgRowInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarSpacer: { width: 28 },
  bubble: { maxWidth: SCREEN_WIDTH * 0.72, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#2563eb' },
  bubbleTheirs: { backgroundColor: colors.border },
  bubbleTextMine: { fontSize: 15, color: colors.background, lineHeight: 21 },
  bubbleTextTheirs: { fontSize: 15, color: colors.text, lineHeight: 21 },
  msgTime: { fontSize: 11, color: colors.textDim },
  msgTimeRow: { flexDirection: 'row', alignItems: 'center' },

  gifMessage: { width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.4, borderRadius: 16 },

  voiceNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: 160, paddingHorizontal: 4, paddingVertical: 4,
  },
  voiceWaveform: {
    flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3, overflow: 'hidden',
  },
  voiceProgress: { height: '100%', backgroundColor: colors.background, borderRadius: 3 },
  voiceProgressMine: { backgroundColor: colors.background },
  voiceTime: { fontSize: 12, color: colors.textDim, fontVariant: ['tabular-nums'] },
  voiceTimeMine: { color: 'rgba(255,255,255,0.8)' },

  emojiPicker: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
  },
  emojiBtn: { padding: 6 },
  emojiText: { fontSize: 24 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  inputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.card || '#111', borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 4,
  },
  input: {
    flex: 1, color: colors.text, fontSize: 16,
    minHeight: 40, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 10,
  },
  inputIconBtn: { padding: 8, paddingBottom: 10 },
  gifIconBox: { borderWidth: 1, borderColor: colors.textDim, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  gifIconBoxActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  gifIconText: { fontSize: 10, fontWeight: '800', color: colors.textDim },
  gifIconTextActive: { color: '#fff' },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: '#3f3f46' },

  typingIndicatorText: {
    fontSize: 12, color: colors.textDim,
    paddingHorizontal: 20, paddingBottom: 4,
  },
  replyingToBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    borderLeftWidth: 3, borderLeftColor: '#2563eb'
  },
  replyingToContent: { flex: 1 },
  replyingToLabel: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginBottom: 2 },
  replyingToText: { fontSize: 13, color: colors.textDim },
  
  replyPreview: {
    backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 8,
    marginBottom: 4, maxWidth: SCREEN_WIDTH * 0.7,
    borderLeftWidth: 3, borderLeftColor: '#2563eb'
  },
  replyPreviewMine: { backgroundColor: 'rgba(255,255,255,0.1)' },
  replyPreviewTheirs: { backgroundColor: 'rgba(0,0,0,0.05)' },
  replyPreviewText: { fontSize: 12, color: colors.text, opacity: 0.8 },

  empty: { alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, color: colors.textDim, marginTop: 12, fontWeight: '600' },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background,
  },
  recordCancelBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },
  recordSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recordingTime: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },

  initialRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  initialRequestBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 18,
  },

  requestBanner: {
    padding: 16, alignItems: 'center', backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  requestBannerTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  requestBannerDesc: { fontSize: 14, color: colors.textDim, textAlign: 'center', marginBottom: 16 },
  requestBannerActions: { flexDirection: 'row', gap: 12 },
  btnDecline: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border
  },
  btnAccept: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#2563eb'
  },
  btnDeclineText: { fontSize: 14, fontWeight: '600', color: colors.text },
  btnAcceptText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  actionText: {
    color: '#e4e4e7',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  contextMenuContainer: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  reactionBar: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  reactionEmojiBtn: {
    paddingHorizontal: 4,
  },
  reactionEmojiText: {
    fontSize: 26,
  },
  contextMenuDateContainer: {
    width: '100%',
    backgroundColor: '#1f1f22',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  contextMenuDateText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionList: {
    width: '100%',
    backgroundColor: '#1f1f22',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  reactionsContainer: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  reactionsContainerMine: { right: 8 },
  reactionsContainerTheirs: { left: 8 },
  reactionPillEmoji: { fontSize: 12 },
  reactionPillCount: { fontSize: 11, color: '#fff', marginLeft: 2, fontWeight: '700' },
})
