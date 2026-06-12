import { getCdnUrl } from '../lib/cdn';
// components/PostItem.tsx — Reusable feed post component
import React, { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Dimensions, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme';
import { useUI } from '../lib/ui';
import { getCDNUrl } from '../lib/cdn';
import { Video, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window')

export type PostType = {
  id: string
  content: string
  image_urls?: string[]
  video_url?: string
  created_at: string
  creator_id: string
  likes_count?: number
  comments_count?: number
  reposts_count?: number
  is_liked?: boolean
  is_bookmarked?: boolean
  is_reposted?: boolean
  is_ghost?: boolean
  settings?: any
  profiles?: {
    id: string
    full_name: string
    username: string
    avatar_url?: string
    is_verified?: boolean
  }
}

export function PostItem({ post: initialPost }: { post: PostType }) {
  const { user } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()
  const { showActionSheet, showToast } = useUI()
  const [post, setPost] = useState(initialPost)
  const videoRef = React.useRef(null)

  const timeAgo = (date: string) => {
    // simplified formatting to match "8 May" or time ago
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      if (hours > 0) return `${hours}h`
      const mins = Math.floor(diff / 60000)
      return `${mins}m`
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${d.getDate()} ${months[d.getMonth()]}`
  }

  const toggleLike = async () => {
    if (!user) return
    const wasLiked = post.is_liked
    if (!wasLiked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPost(p => ({ ...p, is_liked: !wasLiked, likes_count: (p.likes_count || 0) + (wasLiked ? -1 : 1) }))
    if (wasLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const toggleRepost = async () => {
    if (!user) return
    const wasReposted = post.is_reposted
    if (!wasReposted) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPost(p => ({ ...p, is_reposted: !wasReposted, reposts_count: (p.reposts_count || 0) + (wasReposted ? -1 : 1) }))
    if (wasReposted) {
      await supabase.from('reposts').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('reposts').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const toggleBookmark = async () => {
    if (!user) return
    const wasBookmarked = post.is_bookmarked
    if (!wasBookmarked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPost(p => ({ ...p, is_bookmarked: !wasBookmarked }))
    if (wasBookmarked) {
      await supabase.from('bookmarks').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('bookmarks').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const submitReport = async (reason: string) => {
    if (!user || !post) return
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id, post_id: post.id, reason
    })
    if (!error) showToast('Post reported for review.', 'success')
    else showToast('Could not submit report.', 'error')
  }

  const handlePostOptions = () => {
    if (!user || !post) return
    if (user.id === post.creator_id) return
    showActionSheet('Post Options', [
      { text: 'Report Post', style: 'destructive', icon: 'flag', onPress: () => {
        setTimeout(() => {
          showActionSheet('Why are you reporting this post?', [
            { text: 'It is spam', onPress: () => submitReport('Spam') },
            { text: 'Hate speech or symbols', onPress: () => submitReport('Hate speech') },
            { text: 'Nudity or sexual activity', onPress: () => submitReport('Nudity') },
            { text: 'Bullying or harassment', onPress: () => submitReport('Harassment') },
            { text: 'Cancel', style: 'cancel', onPress: () => {} }
          ])
        }, 400)
      }},
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const hasImage = post.image_urls && post.image_urls.length > 0
  const hasVideo = !!post.video_url

  return (
    <View style={styles.post}>
      <TouchableOpacity
        style={styles.postHeader}
        onPress={() => router.push(`/user-profile?id=${post.creator_id}`)}
        activeOpacity={0.7}
      >
        {post.profiles?.avatar_url ? (
          <Image source={{ uri: getCdnUrl(getCDNUrl(post.profiles.avatar_url) || '') }} style={[styles.avatar, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]}>
            <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <View style={styles.postHeaderText}>
          <Text style={styles.fullName}>{post.profiles?.username}</Text>
          {post.profiles?.is_verified && (
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
          )}
          <Text style={styles.username}>
            {' '}· {timeAgo(post.created_at)}
            {post.is_ghost && <Text style={{ color: '#f59e0b' }}>  👻 24h</Text>}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={{ padding: 4 }} onPress={handlePostOptions}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textDim} />
        </TouchableOpacity>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.9}>
        {!!post.content && (
          <View style={styles.contentContainer}>
            <Text style={styles.postContent}>{post.content}</Text>
          </View>
        )}
      </TouchableOpacity>

      {hasVideo && (
        <View style={{ width: '100%' }}>
          <Video
            ref={videoRef}
            source={{ uri: getCdnUrl(getCDNUrl(post.video_url) || '') }}
            style={styles.postImage}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            isLooping
            shouldPlay
          />
        </View>
      )}

      {hasImage && !hasVideo && (
        <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.95}>
          <Image
            source={{ uri: getCdnUrl(getCDNUrl(post.image_urls![0]) || '') }}
            style={styles.postImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLike} activeOpacity={0.7}>
          <Ionicons
            name={post.is_liked ? 'heart' : 'heart-outline'}
            size={22}
            color={post.is_liked ? '#ef4444' : colors.textDim}
          />
          {(post.likes_count || 0) > 0 && (
            <Text style={[styles.actionCount, post.is_liked && { color: '#ef4444' }]}>
              {post.likes_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.textDim} />
          {(post.comments_count || 0) > 0 && (
            <Text style={styles.actionCount}>{post.comments_count}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleRepost}>
          <Ionicons
            name={post.is_reposted ? 'repeat' : 'repeat-outline'}
            size={22}
            color={post.is_reposted ? '#10b981' : colors.textDim}
          />
          {(post.reposts_count || 0) > 0 && (
            <Text style={[styles.actionCount, post.is_reposted && { color: '#10b981' }]}>
              {post.reposts_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={toggleBookmark} activeOpacity={0.7}>
          <Ionicons
            name={post.is_bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={post.is_bookmarked ? '#3b82f6' : colors.textDim}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  post: { 
    paddingTop: 16, 
    backgroundColor: colors.background 
  },
  postHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8,
    paddingHorizontal: 16
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    marginRight: 10 
  },
  avatarFallback: { 
    backgroundColor: colors.border, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.textDim 
  },
  postHeaderText: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  fullName: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: colors.text 
  },
  username: { 
    fontSize: 14, 
    color: colors.textDim, 
    fontWeight: '500' 
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  postContent: { 
    fontSize: 16, 
    color: colors.text, 
    lineHeight: 22,
    fontWeight: '700', // To match screenshot bold text
    textAlign: 'center' // To match screenshot centered text
  },
  postImage: { 
    width: '100%', 
    aspectRatio: 1 / 1.1,
    backgroundColor: colors.border 
  },
  actions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionCount: { 
    fontSize: 14, 
    color: colors.textDim, 
    marginLeft: 6, 
    fontWeight: '500' 
  },
  divider: { 
    height: StyleSheet.hairlineWidth, 
    backgroundColor: colors.border,
    marginTop: 8
  },
})
