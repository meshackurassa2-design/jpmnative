import { getCdnUrl } from '../lib/cdn';
// app/notifications.tsx
import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, RefreshControl
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Skeleton } from '../components/Skeleton'
import { BackButton } from '../components/BackButton'

type Notification = {
  id: string
  type: string
  created_at: string
  read: boolean
  actor_id: string
  actor: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
    is_verified?: boolean
  }
}

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingCollabs, setPendingCollabs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id(id, username, full_name, avatar_url, is_verified)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setNotifications(data)
    }

    const { data: collabData } = await supabase
      .from('posts')
      .select(`id, created_at, content, profiles:creator_id(id, full_name, username, avatar_url, is_verified)`)
      .eq('settings->>co_author_id', user.id)
      .eq('settings->>co_author_status', 'pending')
    
    if (collabData) setPendingCollabs(collabData)

    setLoading(false)
    setRefreshing(false)
  }, [user])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const acceptCollab = async (postId: string) => {
    const { data } = await supabase.from('posts').select('settings').eq('id', postId).single()
    if (data) {
      await supabase.from('posts').update({ 
        settings: { ...data.settings, co_author_status: 'accepted' } 
      }).eq('id', postId)
    }
    setPendingCollabs(prev => prev.filter(p => p.id !== postId))
  }

  const declineCollab = async (postId: string) => {
    const { data } = await supabase.from('posts').select('settings').eq('id', postId).single()
    if (data) {
      const newSettings = { ...data.settings }
      delete newSettings.co_author_id
      delete newSettings.co_author_status
      await supabase.from('posts').update({ 
        settings: newSettings 
      }).eq('id', postId)
    }
    setPendingCollabs(prev => prev.filter(p => p.id !== postId))
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchNotifications()
  }

  // Mark all read on mount
  useEffect(() => {
    if (!user) return
    const markRead = async () => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    }
    const timer = setTimeout(markRead, 2000)
    return () => clearTimeout(timer)
  }, [user])

  const getActionText = (type: string) => {
    switch (type) {
      case 'like': return 'liked your post'
      case 'comment': return 'commented on your post'
      case 'follow': return 'followed you'
      case 'mention': return 'mentioned you'
      case 'message': return 'sent you a message'
      default: return 'interacted with you'
    }
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'like': return <Ionicons name="heart" size={12} color="#fff" />
      case 'comment': return <Ionicons name="chatbubble" size={12} color="#fff" />
      case 'follow': return <Ionicons name="person" size={12} color="#fff" />
      default: return <Ionicons name="notifications" size={12} color="#fff" />
    }
  }

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'like': return '#ef4444' // Red
      case 'comment': return '#3b82f6' // Blue
      case 'follow': return '#8b5cf6' // Purple
      default: return colors.textDim
    }
  }

  const timeAgo = (date: string) => {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`
    return `${Math.floor(secs / 86400)}d`
  }

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.row, !item.read && styles.rowUnread]}
      onPress={() => {
        if (item.type === 'follow') router.push(`/user-profile?id=${item.actor_id}`)
        else if (item.type === 'message') router.push(`/chat?id=${item.actor_id}`)
        // TODO: route to post for likes/comments if post_id was stored in notifications
      }}
    >
      <View style={styles.avatarContainer}>
        {item.actor?.avatar_url ? (
          <Image source={{ uri: getCdnUrl(item.actor.avatar_url) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{item.actor?.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: getBadgeColor(item.type) }]}>
          {getIconForType(item.type)}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.headerLine}>
          <Text style={styles.name} numberOfLines={1}>{item.actor?.full_name}</Text>
          {item.actor?.is_verified && <Ionicons name="checkmark-circle" size={14} color="#2563eb" style={{ marginLeft: 4 }} />}
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.actionText}>{getActionText(item.type)}</Text>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>Notifications</Text>
        </View>
        <View style={{ flex: 1, paddingTop: 8 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={styles.row}>
              <View style={styles.avatarContainer}>
                <Skeleton width={48} height={48} borderRadius={24} />
              </View>
              <View style={styles.content}>
                <View style={styles.headerLine}>
                  <Skeleton width="50%" height={15} style={{ marginBottom: 6 }} />
                </View>
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
        <BackButton />
        <Text style={styles.title}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        ListHeaderComponent={
          pendingCollabs.length > 0 ? (
            <View style={{ paddingBottom: 16 }}>
              {pendingCollabs.map(collab => (
                <View key={collab.id} style={[styles.row, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <View style={styles.avatarContainer}>
                    {collab.profiles?.avatar_url ? (
                      <Image source={{ uri: getCdnUrl(collab.profiles.avatar_url) }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarText}>{collab.profiles?.full_name?.[0] || '?'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.content}>
                    <Text style={styles.name}>{collab.profiles?.username} invited you to collaborate</Text>
                    {!!collab.content && <Text style={styles.actionText} numberOfLines={1}>"{collab.content}"</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <TouchableOpacity 
                        style={{ backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                        onPress={() => acceptCollab(collab.id)}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ backgroundColor: colors.border, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                        onPress={() => declineCollab(collab.id)}
                      >
                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color="#d4d4d8" />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowUnread: {},
  avatarContainer: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.textDim },
  badge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background
  },
  content: { flex: 1 },
  headerLine: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, maxWidth: '75%' },
  time: { fontSize: 13, color: colors.textDim, marginLeft: 8 },
  actionText: { fontSize: 14, color: '#52525b', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 12 },
  emptyText: { fontSize: 16, color: colors.textDim },
})
