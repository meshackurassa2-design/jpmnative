import { getCdnUrl } from '../../lib/cdn';
// app/(tabs)/messages.tsx — Messages list screen
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, TextInput, ScrollView, Modal, TouchableWithoutFeedback, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { decryptMessage, getSharedSecret } from '../../lib/crypto'
import { Skeleton } from '../../components/Skeleton'
import { VibeBadge } from '../../components/VibeBadge'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [convos, setConvos] = useState<any[]>([])
  const [inboundRequests, setInboundRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'Inbox' | 'Requests' | 'Shop'>('Inbox')
  const [activeFilter, setActiveFilter] = useState<'All' | 'Unread' | 'Unanswered' | 'Verified'>('All')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    
    try {
    console.log('Fetching conversations for user:', user.id)
    // Get all unique people this user has messaged
    const { data: sent, error: err1 } = await supabase
      .from('messages')
      .select('receiver_id, created_at, content, is_shop_chat')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
      
    console.log('Sent messages fetched, count:', sent?.length, err1)

    const { data: received, error: err2 } = await supabase
      .from('messages')
      .select('sender_id, created_at, content, is_read, is_shop_chat')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    console.log('Received messages fetched, count:', received?.length, err2)

    // Build unique partner IDs
    const partnerIds = new Set<string>()
    ;(sent || []).forEach((m: any) => partnerIds.add(m.receiver_id))
    ;(received || []).forEach((m: any) => partnerIds.add(m.sender_id))

    console.log('Partner IDs:', partnerIds.size)
    if (partnerIds.size === 0) { setConvos([]); setLoading(false); return }

    const { data: profiles, error: err3 } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, is_verified, last_seen, settings')
      .in('id', [...partnerIds])
      
    console.log('Profiles fetched:', profiles?.length, err3)

    // Get unread counts
    const { data: unread } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    const unreadMap = new Map<string, number>()
    ;(unread || []).forEach((m: any) => {
      unreadMap.set(m.sender_id, (unreadMap.get(m.sender_id) || 0) + 1)
    })

    // Find the latest message for each partner
    const allMessages = [...(sent || []).map((m: any) => ({...m, partner_id: m.receiver_id})), ...(received || []).map((m: any) => ({...m, partner_id: m.sender_id}))]
    allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    const latestMsgMap = new Map<string, any>()
    const shopChatPartners = new Set<string>()

    for (const msg of allMessages) {
      if (!latestMsgMap.has(msg.partner_id)) {
        latestMsgMap.set(msg.partner_id, msg)
      }
      if (msg.is_shop_chat) {
        shopChatPartners.add(msg.partner_id)
      }
    }

    console.log('Latest messages computed, starting decryption...')
    const conversations = await Promise.all((profiles || []).map(async (p: any) => {
      const latestMsg = latestMsgMap.get(p.id)
      let decryptedContent = ''
      if (latestMsg?.content) {
        try {
          console.log(`Decrypting for ${p.id}...`)
          decryptedContent = await decryptMessage(latestMsg.content, getSharedSecret(user.id, p.id), true)
          console.log(`Decrypted for ${p.id} successfully`)
        } catch {
          decryptedContent = '📷 Media'
        }
      }

      return {
        profile: p,
        unread: unreadMap.get(p.id) || 0,
        lastMessage: decryptedContent,
        lastMessageTime: latestMsg?.created_at,
        lastSenderId: latestMsg?.sender_id || latestMsg?.partner_id,
        isShopChat: shopChatPartners.has(p.id)
      }
    }))

    console.log('All decrypted, setting convos')
    setConvos(conversations)

    // Fetch inbound requests
    const { data: reqData } = await supabase
      .from('message_requests')
      .select('*, sender:sender_id(id, full_name, username, avatar_url, settings)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
    
    setInboundRequests(reqData || [])

    } catch (e: any) {
      console.error('Error fetching conversations:', e)
      Alert.alert('Fetch Error', e.message || String(e))
    } finally {
      console.log('Finally block reached, setting loading false')
      setLoading(false)
    }
  }, [user])

  const acceptRequest = async (senderId: string) => {
    if (!user) return
    await supabase.from('message_requests').update({ status: 'accepted' }).eq('sender_id', senderId).eq('receiver_id', user.id)
    setInboundRequests(prev => prev.filter(r => r.sender_id !== senderId))
    fetchConversations()
  }

  const declineRequest = async (senderId: string) => {
    if (!user) return
    await supabase.from('message_requests').update({ status: 'declined' }).eq('sender_id', senderId).eq('receiver_id', user.id)
    setInboundRequests(prev => prev.filter(r => r.sender_id !== senderId))
  }

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('messages_inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        const row = payload.new || payload.old
        if (row && (row.receiver_id === user.id || row.sender_id === user.id)) {
          fetchConversations()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetchConversations])

  // Apply search + filter
  let activeConvos = convos
  if (activeTab === 'Shop') {
    activeConvos = convos.filter(c => c.isShopChat)
  } else if (activeTab === 'Inbox') {
    activeConvos = convos.filter(c => !c.isShopChat)
  }

  let filtered = activeConvos.filter(c =>
    (c.profile.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.profile.username?.toLowerCase() || '').includes(search.toLowerCase())
  )
  if (activeFilter === 'Unread') {
    filtered = filtered.filter(c => c.unread > 0)
  } else if (activeFilter === 'Unanswered') {
    filtered = filtered.filter(c => c.lastSenderId && c.lastSenderId !== user?.id)
  } else if (activeFilter === 'Verified') {
    filtered = filtered.filter(c => c.profile.is_verified)
  }

  const timeAgo = (date?: string) => {
    if (!date) return ''
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (secs < 60) return 'now'
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`
    return `${Math.floor(secs / 86400)}d`
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity onPress={() => Alert.alert('New Message', 'Feature coming soon!')}>
            <Ionicons name="create-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <View key={i} style={styles.row}>
              <Skeleton width={56} height={56} borderRadius={28} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="70%" height={14} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity onPress={() => Alert.alert('New Message', 'Feature coming soon!')}>
          <Ionicons name="create-outline" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Filter and Tabs */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.filterMenuBtn} 
          onPress={() => setShowFilterMenu(true)}
        >
          <Ionicons name="options" size={22} color="#18181b" style={{ transform: [{ rotate: '90deg' }] }} />
          {activeFilter !== 'All' && <View style={styles.filterActiveDot} />}
        </TouchableOpacity>

        <View style={[styles.tabsRow, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
          <TouchableOpacity style={[styles.tab, activeTab === 'Inbox' && styles.tabActive]} onPress={() => setActiveTab('Inbox')}>
            <Text style={[styles.tabText, activeTab === 'Inbox' && styles.tabTextActive]}>Inbox</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'Shop' && styles.tabActive]} onPress={() => setActiveTab('Shop')}>
            <Text style={[styles.tabText, activeTab === 'Shop' && styles.tabTextActive]}>Shop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'Requests' && styles.tabActive]} onPress={() => setActiveTab('Requests')}>
            <Text style={[styles.tabText, activeTab === 'Requests' && styles.tabTextActive]} numberOfLines={1}>Reqs {inboundRequests.length > 0 ? `(${inboundRequests.length})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(activeTab === 'Inbox' || activeTab === 'Shop') && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#a1a1aa" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#a1a1aa"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}



      {(activeTab === 'Inbox' || activeTab === 'Shop') ? (
        <FlatList
          data={filtered}
          keyExtractor={item => item.profile.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/chat?id=${item.profile.id}`)}
            >
              <View style={{ position: 'relative' }}>
                {item.profile.avatar_url ? (
                  <Image source={{ uri: getCdnUrl(item.profile.avatar_url) }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{item.profile.full_name?.[0] || '?'}</Text>
                  </View>
                )}
                <VibeBadge vibe={item.profile.settings?.vibe} size={14} style={{ position: 'absolute', bottom: 0, right: -2 }} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.name}>{item.profile.full_name}</Text>
                  {item.profile.is_verified && (
                    <Ionicons name="checkmark-circle" size={13} color="#2563eb" />
                  )}
                </View>
                {item.lastMessage ? (
                  <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                    {item.lastMessage.startsWith('voice:') ? '🎤 Voice note' : item.lastMessage.startsWith('gif:') ? '🎬 GIF' : item.lastMessage}
                  </Text>
                ) : (
                  <Text style={styles.username} numberOfLines={1}>@{item.profile.username}</Text>
                )}
              </View>
              {item.unread > 0 && (
                <View style={styles.badgeCol}>
                  <Text style={styles.timeText}>{timeAgo(item.lastMessageTime)}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                  </View>
                </View>
              )}
              {item.unread === 0 && item.lastMessageTime && (
                <Text style={styles.timeText}>{timeAgo(item.lastMessageTime)}</Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={32} color="#a1a1aa" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} messages` : 'No messages yet'}
              </Text>
              <Text style={styles.emptyText}>
                {activeFilter !== 'All' ? `You're all caught up on your ${activeFilter.toLowerCase()} messages.` : 'Start a conversation with your friends to see them here.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      ) : (
        <FlatList
          data={inboundRequests}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/chat?id=${item.sender?.id}`)}
            >
              <View style={{ position: 'relative' }}>
                {item.sender.avatar_url ? (
                  <Image source={{ uri: getCdnUrl(item.sender.avatar_url) }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{item.sender.full_name?.[0] || '?'}</Text>
                  </View>
                )}
                <VibeBadge vibe={item.sender.settings?.vibe} size={14} style={{ position: 'absolute', bottom: 0, right: -2 }} />
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <Text style={styles.name}>{item.sender?.full_name}</Text>
                <Text style={styles.username} numberOfLines={1}>wants to message you</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.btnDecline} onPress={() => declineRequest(item.sender?.id)}>
                  <Text style={styles.btnDeclineText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnAccept} onPress={() => acceptRequest(item.sender?.id)}>
                  <Text style={styles.btnAcceptText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="mail-unread-outline" size={32} color="#a1a1aa" />
              </View>
              <Text style={styles.emptyTitle}>No message requests</Text>
              <Text style={styles.emptyText}>When someone you don't follow sends you a message, it will appear here.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {/* Filter Dropdown Modal */}
      <Modal visible={showFilterMenu} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowFilterMenu(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>FILTER</Text>
                </View>
                {(['All', 'Unread', 'Unanswered', 'Verified'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={styles.modalOption}
                    onPress={() => { setActiveFilter(f); setShowFilterMenu(false) }}
                  >
                    <Text style={[styles.modalOptionText, activeFilter === f && styles.modalOptionTextActive]}>{f}</Text>
                    {activeFilter === f && <Ionicons name="checkmark" size={24} color="#000" />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  
  // Top Bar with Filter Button
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 16,
  },
  filterMenuBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background
  },
  filterActiveDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb',
    borderWidth: 1, borderColor: colors.background
  },

  // Segmented Control Tabs
  tabsRow: { 
    flexDirection: 'row', 
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: colors.border,
    borderRadius: 20,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 16 },
  tabActive: { backgroundColor: colors.background, shadowColor: colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: colors.text },

  // Search Bar
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: colors.border, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },

  // List Rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  avatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', borderWidth: 0 },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.textDim },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  username: { fontSize: 14, color: colors.textDim, marginTop: 1 },
  lastMessage: { fontSize: 14, color: colors.textDim, marginTop: 3 },
  lastMessageUnread: { fontWeight: '700', color: colors.text },
  
  timeText: { fontSize: 12, color: colors.textDim, fontWeight: '500' },
  badgeCol: { alignItems: 'flex-end', gap: 6 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: colors.background, fontSize: 11, fontWeight: '800' },

  // Request Buttons
  btnDecline: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.border, justifyContent: 'center'
  },
  btnDeclineText: { fontSize: 13, fontWeight: '700', color: '#52525b' },
  btnAccept: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#2563eb', justifyContent: 'center'
  },
  btnAcceptText: { fontSize: 13, fontWeight: '700', color: colors.background },

  // Empty States
  empty: { paddingTop: 60, alignItems: 'center', gap: 16 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 15, color: colors.textDim, textAlign: 'center', maxWidth: '80%', lineHeight: 22 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '80%', backgroundColor: colors.background, borderRadius: 24,
    paddingVertical: 12, overflow: 'hidden'
  },
  modalHeader: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border
  },
  modalTitle: { fontSize: 12, fontWeight: '800', color: colors.textDim, letterSpacing: 1 },
  modalOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  modalOptionText: { fontSize: 16, fontWeight: '600', color: '#3f3f46' },
  modalOptionTextActive: { color: colors.text, fontWeight: '800' },
})

