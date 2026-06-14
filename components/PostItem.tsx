import { getCdnUrl } from '../lib/cdn';
// components/PostItem.tsx — Reusable feed post component
import React, { useState, useMemo, useEffect } from 'react'
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
import { VibeBadge } from './VibeBadge';

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
  const [isDeleted, setIsDeleted] = useState(false)
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

  const handleDeletePost = async () => {
    if (!user || !post) return
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleted(true)
            const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('creator_id', user.id)
            if (error) {
              setIsDeleted(false)
              showToast('Could not delete post.', 'error')
            } else {
              showToast('Post deleted', 'success')
            }
          }
        }
      ]
    )
  }

  const handlePostOptions = () => {
    if (!user || !post) return
    
    if (user.id === post.creator_id) {
      showActionSheet('Post Options', [
        { text: 'Delete Post', style: 'destructive', icon: 'trash', onPress: handleDeletePost },
        { text: 'Cancel', style: 'cancel', onPress: () => {} }
      ])
      return
    }

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

  if (isDeleted) return null

  const hasImage = post.image_urls && post.image_urls.length > 0
  const hasVideo = !!post.video_url
  const isAnonymous = post.settings?.is_anonymous === true
  
  const [isRevealed, setIsRevealed] = useState(false)
  const isHidden = post.settings?.is_hidden === true && !isRevealed
  
  const [coAuthor, setCoAuthor] = useState<any>(post.co_author_profile)

  useEffect(() => {
    if (!coAuthor && post.settings?.co_author_id) {
      const supabase = createClient()
      supabase.from('profiles').select('id, full_name, username, avatar_url, is_verified').eq('id', post.settings.co_author_id).single()
        .then(({ data }) => {
          if (data) setCoAuthor(data)
        })
    }
  }, [post.settings?.co_author_id])

  return (
    <View style={styles.post}>
      <TouchableOpacity
        style={styles.postHeader}
        onPress={() => {
          if (!isAnonymous) {
            router.push(`/user-profile?id=${post.creator_id}`)
          }
        }}
        activeOpacity={isAnonymous ? 1 : 0.7}
      >
        {isAnonymous ? (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#9333ea' }]}>
            <Ionicons name="mask" size={20} color="#9333ea" />
          </View>
        ) : coAuthor ? (
          <View style={{ width: 44, height: 44, marginRight: 10, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderRadius: 15, overflow: 'hidden', borderWidth: post.is_ghost ? 2 : 1, borderColor: post.is_ghost ? '#f59e0b' : colors.border }}>
              {post.profiles?.avatar_url ? (
                <Image source={{ uri: getCdnUrl(getCDNUrl(post.profiles.avatar_url) || '') }} style={{ width: 30, height: 30 }} />
              ) : (
                <View style={[styles.avatarFallback, { width: 30, height: 30 }]}>
                  <Text style={[styles.avatarText, { fontSize: 13 }]}>{post.profiles?.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.background, overflow: 'hidden' }}>
              {coAuthor.avatar_url ? (
                <Image source={{ uri: getCdnUrl(getCDNUrl(coAuthor.avatar_url) || '') }} style={{ width: 30, height: 30 }} />
              ) : (
                <View style={[styles.avatarFallback, { width: 30, height: 30 }]}>
                  <Text style={[styles.avatarText, { fontSize: 13 }]}>{coAuthor.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => router.push(`/user-profile?id=${post.creator_id}`)} activeOpacity={0.7} style={{ position: 'relative', marginRight: 10 }}>
            <View style={[post.profiles?.settings?.football_team && { padding: 2, borderRadius: 24, borderWidth: 2, borderColor: post.profiles.settings.football_team.color }]}>
              {post.profiles?.avatar_url ? (
                <Image source={{ uri: getCDNUrl(post.profiles.avatar_url) }} style={[styles.avatar, { marginRight: 0 }, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]} />
              ) : (
                <View style={[styles.avatar, { marginRight: 0 }, styles.avatarFallback, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]}>
                  <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
            {post.profiles?.settings?.football_team && (
              <View style={{ position: 'absolute', bottom: -6, alignSelf: 'center', backgroundColor: post.profiles.settings.football_team.color, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 8, borderWidth: 1.5, borderColor: '#18181b', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="football" size={8} color="#fff" style={{ marginRight: 2 }} />
                <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>{post.profiles.settings.football_team.id.toUpperCase()}</Text>
              </View>
            )}
            {!post.profiles?.settings?.football_team && <VibeBadge vibe={post.profiles?.settings?.vibe} size={16} style={{ position: 'absolute', bottom: -2, right: -2 }} />}
          </TouchableOpacity>
        )}
        <View style={[styles.postHeaderText, { flex: 1, marginRight: 8 }]}>
          <Text style={[styles.fullName, { flexShrink: 1 }]} numberOfLines={1}>
            {isAnonymous ? 'Anonymous' : (
              coAuthor ? `${post.profiles?.username} & ${coAuthor.username}` : post.profiles?.username
            )}
          </Text>
          {post.profiles?.settings?.account_type === 'news' ? (
            <Ionicons name="newspaper" size={16} color="#eab308" style={{ flexShrink: 0 }} />
          ) : post.profiles?.is_verified && !isAnonymous ? (
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
          ) : null}
          <Text style={[styles.username, { flexShrink: 0 }]} numberOfLines={1}>
            {' '}· {timeAgo(post.created_at)}
            {post.is_ghost && <Text style={{ color: '#f59e0b' }}>  👻 24h</Text>}
          </Text>
        </View>
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
        <TouchableOpacity 
          onPress={() => {
            if (isHidden) setIsRevealed(true)
          }}
          activeOpacity={1}
          style={{ width: '100%', position: 'relative' }}
        >
          <Video
            ref={videoRef}
            source={{ uri: getCdnUrl(getCDNUrl(post.video_url) || '') }}
            style={styles.postImage}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            isLooping
            shouldPlay={!isHidden}
          />
          {isHidden && (
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.95)' }]}>
              <Ionicons name="eye-off" size={48} color="#fff" style={{ marginBottom: 12, opacity: 0.8 }} />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', opacity: 0.9 }}>Hidden Video</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>Tap to reveal</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {hasImage && !hasVideo && (
        <TouchableOpacity 
          onPress={() => {
            if (isHidden) setIsRevealed(true)
            else router.push(`/post/${post.id}`)
          }} 
          activeOpacity={0.95}
          style={{ position: 'relative', width: '100%' }}
        >
          <Image
            source={{ uri: getCdnUrl(getCDNUrl(post.image_urls![0]) || '') }}
            style={[styles.postImage, isHidden && { opacity: 0.3 }]}
            blurRadius={isHidden ? 50 : 0}
            resizeMode="cover"
          />
          {isHidden && (
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Ionicons name="eye-off" size={48} color="#fff" style={{ marginBottom: 12, opacity: 0.8 }} />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', opacity: 0.9 }}>Spoiler / Hidden Content</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>Tap to reveal</Text>
            </View>
          )}
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
    lineHeight: 22
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
