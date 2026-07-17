import { getCdnUrl } from '../../lib/cdn';
// app/(settings)/bookmarks.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBookmarks = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        post_id,
        created_at,
        posts (
          *,
          profiles:creator_id(id, full_name, username, avatar_url, is_verified)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data && !error) {
      setPosts(data.map((b: any) => ({ ...b.posts, is_bookmarked: true })))
    }
    setLoading(false)
    setRefreshing(false)
  }, [user])

  useEffect(() => { fetchBookmarks() }, [fetchBookmarks])

  const onRefresh = () => {
    setRefreshing(true)
    fetchBookmarks()
  }

  const unbookmark = async (postId: string) => {
    if (!user) return
    await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const timeAgo = (date: string) => {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`
    return `${Math.floor(secs / 86400)}d`
  }

  const renderItem = ({ item: post }: { item: any }) => {
    const hasImage = post.image_urls && post.image_urls.length > 0;
    return (
      <View style={styles.post}>
        <View style={styles.postHeader}>
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.postHeaderText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.fullName}>{post.profiles?.full_name}</Text>
              {post.profiles?.is_verified && <Ionicons name="checkmark-circle" size={14} color="#2563eb" />}
            </View>
            <Text style={styles.username}>@{post.profiles?.username} · {timeAgo(post.created_at)}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)}>
          {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}
          {hasImage && <Image source={{ uri: getCdnUrl(post.image_urls[0]) }} style={styles.postImage} resizeMode="cover" />}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="heart-outline" size={22} color="#71717a" />
            <Text style={styles.actionCount}>{post.likes_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={22} color="#71717a" />
            <Text style={styles.actionCount}>{post.comments_count || 0}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.actionBtn} onPress={() => unbookmark(post.id)}>
            <Ionicons name="bookmark" size={22} color="#2563eb" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color="#d4d4d8" />
          <Text style={styles.emptyText}>No saved posts yet.</Text>
        </View>
      }
    />
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  post: { paddingHorizontal: 16, paddingTop: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.textDim },
  postHeaderText: { flex: 1 },
  fullName: { fontSize: 15, fontWeight: '700', color: colors.text },
  username: { fontSize: 13, color: colors.textDim, marginTop: 1 },
  postContent: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 10 },
  postImage: { width: '100%', height: 260, borderRadius: 16, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 20, paddingBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: -16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 12 },
  emptyText: { fontSize: 16, color: colors.textDim },
})


