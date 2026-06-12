// app/chat.tsx — Full E2E encrypted chat with voice, emoji, and GIF support
import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert,
  Dimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BackButton } from '../components/BackButton'
import { encryptMessage, decryptMessage, getSharedSecret } from '../lib/crypto'
import { Audio } from 'expo-av'
import { GiphyPicker } from '../components/GiphyPicker'
import { Skeleton } from '../components/Skeleton'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Message = {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
  is_read: boolean
}

// Emoji grid — matches web
const EMOJIS = ['😂', '❤️', '🔥', '👀', '😭', '💀', '🤣', '✨', '😤', '🙏', '👏', '😍', '🥺', '💪', '⚡', '🎉', '😈', '🤝', '🫡', '😎', '🤯', '💯', '👑', '🫶']

// ── Voice note player component ──────────────────────────────────────────────
const VoiceNote = React.memo(({ url, mine }: { url: string; mine: boolean }) => {
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
        color={mine ? '#fff' : '#2563eb'}
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

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const supabase = createClient()

  const [partner, setPartner] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [requestStatus, setRequestStatus] = useState<string | null>('allowed')
  const [checkingRequest, setCheckingRequest] = useState(true)

  // Feature states
  const [showGiphy, setShowGiphy] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  const flatListRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const didFocus = useRef(false)

  const sharedSecret = user && id ? getSharedSecret(user.id, id) : ''

  // Auto-focus input when screen gains focus (after transition animation)
  useFocusEffect(
    useCallback(() => {
      if (!didFocus.current) {
        didFocus.current = true
        const t = setTimeout(() => { inputRef.current?.focus() }, 400)
        return () => clearTimeout(t)
      }
    }, [])
  )

  // Load partner profile
  useEffect(() => {
    if (!id) return
    supabase.from('profiles').select('*').eq('id', id).single()
      .then(({ data }) => setPartner(data))
  }, [id])

  const checkRequestStatus = useCallback(async () => {
    if (!user || !id) return
    setCheckingRequest(true)

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)

    if ((count || 0) > 0) {
      setRequestStatus('allowed')
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

    const { data: req } = await supabase
      .from('message_requests')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
      .maybeSingle()

    if (!req) {
      setRequestStatus(null)
    } else if ((req as any).status === 'accepted') {
      setRequestStatus('allowed')
    } else if ((req as any).status === 'pending') {
      if ((req as any).sender_id === user.id) setRequestStatus('pending_sent')
      else setRequestStatus('pending_received')
    } else if ((req as any).status === 'declined') {
      setRequestStatus('declined')
    }

    setCheckingRequest(false)
  }, [user, id])

  useEffect(() => { checkRequestStatus() }, [checkRequestStatus])

  // Decrypt and load messages
  const loadMessages = useCallback(async () => {
    if (!user || !id) return

    // Offline Cache load
    const cached = await AsyncStorage.getItem(`@chat_${user.id}_${id}`)
    if (cached) {
      try {
        setMessages(JSON.parse(cached))
        setLoading(false)
      } catch (e) {}
    }

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${id}),` +
        `and(sender_id.eq.${id},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      const decrypted = await Promise.all(
        data.map(async (m: Message) => ({
          ...m,
          content: await decryptMessage(m.content, sharedSecret),
        }))
      )
      setMessages(decrypted)
    }
    setLoading(false)

    await supabase
      .from('messages')
      .update({ is_read: true } as any)
      .eq('sender_id', id)
      .eq('receiver_id', user.id)
      .eq('is_read', false)
  }, [user, id, sharedSecret])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Save cache when messages update
  useEffect(() => {
    if (!user || !id || messages.length === 0) return
    AsyncStorage.setItem(`@chat_${user.id}_${id}`, JSON.stringify(messages))
  }, [messages, user, id])

  // Real-time subscription
  useEffect(() => {
    if (!user || !id) return
    const channel = supabase
      .channel(`chat-${user.id}-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.new.sender_id !== id) return
        const decryptedContent = await decryptMessage(payload.new.content, sharedSecret)
        setMessages(prev => [...prev, { ...payload.new, content: decryptedContent } as Message])
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, id, sharedSecret])

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }, [messages.length])

  // ── Send text message ─────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !user || !id || sending) return
    const text = input.trim()
    setInput('')
    setShowEmoji(false)
    setSending(true)

    const encrypted = await encryptMessage(text, sharedSecret)
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: id,
      content: encrypted,
    } as any)

    if (error) {
      Alert.alert('Error', 'Failed to send message')
      setInput(text)
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: text,
        sender_id: user.id,
        receiver_id: id,
        created_at: new Date().toISOString(),
        is_read: false,
      }])
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
    }
    setSending(false)
  }

  // ── Send GIF ──────────────────────────────────────────────────────────────
  const sendGif = async (url: string) => {
    if (!user || !id) return
    setShowGiphy(false)
    const encrypted = await encryptMessage(`gif:${url}`, sharedSecret)
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: id,
      content: encrypted,
    } as any)
    if (!error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: `gif:${url}`,
        sender_id: user.id,
        receiver_id: id,
        created_at: new Date().toISOString(),
        is_read: false,
      }])
    }
  }

  // ── Add emoji to input ────────────────────────────────────────────────────
  const addEmoji = (emoji: string) => {
    setInput(prev => prev + emoji)
    inputRef.current?.focus()
  }

  // ── Voice recording ───────────────────────────────────────────────────────
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

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start()

      // Duration counter
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

      // Upload to Supabase
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

      const encrypted = await encryptMessage(`voice:${voiceUrl}`, sharedSecret)
      await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: id,
        content: encrypted,
      } as any)

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: `voice:${voiceUrl}`,
        sender_id: user.id,
        receiver_id: id,
        created_at: new Date().toISOString(),
        is_read: false,
      }])
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)

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

  // ── Request actions ───────────────────────────────────────────────────────
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

  // ── Render message ────────────────────────────────────────────────────────
  const renderMessage = ({ item: msg, index }: { item: Message; index: number }) => {
    const mine = msg.sender_id === user?.id
    const prev = messages[index - 1]
    const next = messages[index + 1]
    const sameAsPrev = prev?.sender_id === msg.sender_id
    const sameAsNext = next?.sender_id === msg.sender_id

    const borderRadius = {
      borderTopLeftRadius: mine ? 20 : (sameAsPrev ? 6 : 20),
      borderTopRightRadius: mine ? (sameAsPrev ? 6 : 20) : 20,
      borderBottomLeftRadius: mine ? 20 : (sameAsNext ? 6 : 20),
      borderBottomRightRadius: mine ? (sameAsNext ? 6 : 20) : 20,
    }

    const isVoice = msg.content.startsWith('voice:')
    const isGif = msg.content.startsWith('gif:')

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs,
        { marginTop: sameAsPrev ? 2 : 10 }]}>
        {!mine && !sameAsNext && partner?.avatar_url ? (
          <Image source={{ uri: partner.avatar_url }} style={styles.msgAvatar} />
        ) : !mine ? (
          <View style={styles.msgAvatarSpacer} />
        ) : null}

        {isVoice ? (
          <View style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            borderRadius,
            { paddingHorizontal: 8, paddingVertical: 6 },
          ]}>
            <VoiceNote url={msg.content.slice(6)} mine={mine} />
          </View>
        ) : isGif ? (
          <View style={[{ overflow: 'hidden', maxWidth: '72%' }, borderRadius]}>
            <Image
              source={{ uri: msg.content.slice(4) }}
              style={styles.gifMessage}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, borderRadius]}>
            <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
              {msg.content}
            </Text>
          </View>
        )}

        {mine && !sameAsNext && (
          <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <BackButton style={{ marginRight: 12 }} />
        {partner?.avatar_url ? (
          <Image source={{ uri: partner.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{partner?.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => router.push(`/user-profile?id=${id}` as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.headerName} numberOfLines={1}>{partner?.full_name || 'Loading...'}</Text>
          <Text style={styles.headerUsername}>@{partner?.username || '...'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages list ── */}
        {loading ? (
          <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 20 }}>
            {/* Their bubble */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
              <View style={{ gap: 4 }}>
                <Skeleton width={180} height={36} borderRadius={20} style={{ borderBottomLeftRadius: 6 }} />
                <Skeleton width={140} height={36} borderRadius={20} />
              </View>
            </View>
            {/* My bubble */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Skeleton width={220} height={36} borderRadius={20} style={{ borderBottomRightRadius: 6 }} />
              </View>
            </View>
            {/* Their bubble */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
              <View style={{ gap: 4 }}>
                <Skeleton width={160} height={36} borderRadius={20} style={{ borderBottomLeftRadius: 6 }} />
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color="#e4e4e7" />
                <Text style={styles.emptyText}>Start a conversation!</Text>
              </View>
            }
          />
        )}

        {/* ── Emoji picker overlay ── */}
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

        {/* ── Input bar / Request status ── */}
        {checkingRequest ? (
          <View style={styles.requestBanner}>
            <ActivityIndicator size="small" color="#000" />
          </View>
        ) : requestStatus === 'allowed' ? (
          recording ? (
            // ── Recording UI ──
            <View style={styles.recordingBar}>
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
            // ── Normal input bar ──
            <View style={styles.inputBar}>
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor="#a1a1aa"
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={1000}
                />

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
                  <Ionicons name="happy-outline" size={24} color={showEmoji ? '#2563eb' : '#a1a1aa'} />
                </TouchableOpacity>

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
          )
        ) : requestStatus === 'pending_sent' ? (
          <View style={styles.requestBanner}>
            <Text style={styles.requestBannerTitle}>Message request sent</Text>
            <Text style={styles.requestBannerDesc}>You can message {partner?.full_name} once they accept your request.</Text>
          </View>
        ) : requestStatus === 'pending_received' ? (
          <View style={styles.requestBanner}>
            <Text style={styles.requestBannerTitle}>{partner?.full_name} wants to message you.</Text>
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
          <View style={styles.requestBanner}>
            <Text style={styles.requestBannerDesc}>This request was declined.</Text>
          </View>
        ) : (
          <View style={styles.requestBanner}>
            <Text style={styles.requestBannerDesc}>To start a conversation, send a message request to {partner?.full_name}.</Text>
            <TouchableOpacity style={styles.btnAccept} onPress={sendMessageRequest}>
              <Text style={styles.btnAcceptText}>Send Message Request</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* GIF Picker modal */}
      <GiphyPicker
        visible={showGiphy}
        onClose={() => setShowGiphy(false)}
        onGifSelect={sendGif}
      />
    </SafeAreaView>
  )
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e4e4e7',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatarFallback: { backgroundColor: '#e4e4e7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#71717a' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#18181b' },
  headerUsername: { fontSize: 13, color: '#71717a', marginTop: 1 },

  // Messages
  messagesList: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarSpacer: { width: 28 },
  bubble: { maxWidth: '72%', paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#2563eb' },
  bubbleTheirs: { backgroundColor: '#f4f4f5' },
  bubbleTextMine: { fontSize: 15, color: '#fff', lineHeight: 21 },
  bubbleTextTheirs: { fontSize: 15, color: '#18181b', lineHeight: 21 },
  msgTime: { fontSize: 10, color: '#a1a1aa', marginBottom: 2, alignSelf: 'flex-end' },

  // GIF in message
  gifMessage: { width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.4, borderRadius: 16 },

  // Voice note
  voiceNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: 160, paddingHorizontal: 4, paddingVertical: 4,
  },
  voiceWaveform: {
    flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3, overflow: 'hidden',
  },
  voiceProgress: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  voiceProgressMine: { backgroundColor: '#fff' },
  voiceTime: { fontSize: 12, color: '#71717a', fontVariant: ['tabular-nums'] },
  voiceTimeMine: { color: 'rgba(255,255,255,0.8)' },

  // Emoji picker
  emojiPicker: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e4e4e7',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
  },
  emojiBtn: { padding: 6 },
  emojiText: { fontSize: 24 },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e4e4e7',
    backgroundColor: '#fff',
  },
  inputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f4f4f5', borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 15, color: '#18181b', maxHeight: 100, paddingVertical: 0 },
  inputIconBtn: { paddingHorizontal: 4, paddingVertical: 4 },

  // GIF icon
  gifIconBox: {
    borderWidth: 1.5, borderColor: '#a1a1aa', borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  gifIconBoxActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  gifIconText: { fontSize: 11, fontWeight: '900', color: '#a1a1aa' },
  gifIconTextActive: { color: '#fff' },

  // Send button
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d4d4d8' },

  // Recording bar
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e4e4e7',
    backgroundColor: '#fff',
  },
  recordCancelBtn: { padding: 4 },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recordingTime: { fontSize: 17, fontWeight: '600', color: '#ef4444', fontVariant: ['tabular-nums'] },
  recordSendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
  },

  // Request banners
  requestBanner: {
    paddingHorizontal: 16, paddingVertical: 20,
    backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e4e4e7',
    alignItems: 'center', gap: 8,
  },
  requestBannerTitle: { fontSize: 14, fontWeight: '700', color: '#18181b', textAlign: 'center' },
  requestBannerDesc: { fontSize: 13, color: '#71717a', textAlign: 'center', marginBottom: 8 },
  requestBannerActions: { flexDirection: 'row', gap: 12 },
  btnDecline: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: '#e4e4e7',
  },
  btnDeclineText: { fontSize: 14, fontWeight: '700', color: '#52525b' },
  btnAccept: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#18181b',
  },
  btnAcceptText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: '#a1a1aa', fontSize: 15 },
})
