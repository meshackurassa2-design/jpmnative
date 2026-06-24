import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView, useWindowDimensions
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useUI } from '../../lib/ui'
import { BackButton } from '../../components/BackButton'
import { Video, ResizeMode } from 'expo-av'

export default function PostDetail() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width;
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showActionSheet, showToast } = useUI()
  const supabase = createClient()

  const [post, setPost] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [coAuthor, setCoAuthor] = useState<any>(null)

  useEffect(() => {
    if (!coAuthor && post?.settings?.co_author_id && post?.settings?.co_author_status === 'accepted') {
      supabase.from('profiles').select('id, full_name, username, avatar_url, is_verified').eq('id', post.settings.co_author_id).single()
        .then(({ data }) => {
          if (data) setCoAuthor(data)
        })
    }
  }, [post?.settings?.co_author_id, post?.settings?.co_author_status])

  const fetchData = useCallback(async () => {
    const postId = Array.isArray(id) ? id[0] : id
    if (!postId) return
    const { data: postData } = await supabase
      .from('posts')
      .select(`*, profiles:creator_id(id, full_name, username, avatar_url, is_verified, settings)`)
      .eq('id', postId)
      .single()
    
    if (postData) {
      if (user) {
        const { data: likes } = await supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
        postData.is_liked = !!likes

        const { data: reposts } = await supabase.from('reposts').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
        postData.is_reposted = !!reposts
      }

      // Explicitly fetch true counts to ensure accuracy if triggers are missing
      const { count: likesCount } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId)
      const { count: commentsCount } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId)
      const { count: repostsCount } = await supabase.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', postId)
      
      postData.likes_count = likesCount || 0
      postData.comments_count = commentsCount || 0
      postData.reposts_count = repostsCount || 0

      setPost(postData)
    }

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(id, full_name, username, avatar_url, is_verified, settings)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (commentsData) {
      const commentIds = commentsData.map(c => c.id)
      if (commentIds.length > 0) {
        const { data: allLikes, error: likesErr } = await supabase
          .from('comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds)

        if (!likesErr && allLikes) {
          const likeCounts: Record<string, number> = {}
          const userLiked: Record<string, boolean> = {}
          
          allLikes.forEach(like => {
            likeCounts[like.comment_id] = (likeCounts[like.comment_id] || 0) + 1
            if (user && like.user_id === user.id) {
              userLiked[like.comment_id] = true
            }
          })

          commentsData.forEach(c => {
            c.likes_count = likeCounts[c.id] || 0
            c.is_liked = !!userLiked[c.id]
          })
        }
      }
    }

    setComments(commentsData || [])
    setLoading(false)
  }, [id, user])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!id || !user) return
    const postId = Array.isArray(id) ? id[0] : id

    const channel = supabase.channel(`post_detail_${postId}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, async (payload) => {
        if (payload.new.user_id === user.id) return; // Handled locally
        const { data: cData } = await supabase.from('comments').select('*, profiles(id, full_name, username, avatar_url, is_verified, settings)').eq('id', payload.new.id).single()
        if (cData) {
          cData.likes_count = 0
          cData.is_liked = false
          setComments(prev => {
            if (prev.some(c => c.id === cData.id)) return prev
            return [...prev, cData]
          })
          setPost(p => p ? { ...p, comments_count: (p.comments_count || 0) + 1 } : null)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, (payload) => {
        setComments(prev => prev.filter(c => c.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes', filter: `post_id=eq.${postId}` }, (payload) => {
        if (payload.new.user_id !== user.id) {
          setPost(p => p ? { ...p, likes_count: (p.likes_count || 0) + 1 } : null)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes', filter: `post_id=eq.${postId}` }, (payload) => {
        setPost(p => p ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) - 1) } : null)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comment_likes' }, (payload) => {
        if (payload.new.user_id !== user.id) {
          setComments(prev => prev.map(c => c.id === payload.new.comment_id ? { ...c, likes_count: (c.likes_count || 0) + 1 } : c))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comment_likes' }, (payload) => {
        setComments(prev => prev.map(c => c.id === payload.old.comment_id ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) - 1) } : c))
      })
      .subscribe()
      
    return () => { supabase.removeChannel(channel) }
  }, [id, user])

  const toggleLike = async () => {
    if (!user || !post) return
    const isLiked = post.is_liked
    
    setPost({ ...post, is_liked: !isLiked, likes_count: (post.likes_count || 0) + (isLiked ? -1 : 1) })

    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const toggleRepost = async () => {
    if (!user || !post) return
    const isReposted = post.is_reposted
    
    setPost({ ...post, is_reposted: !isReposted, reposts_count: (post.reposts_count || 0) + (isReposted ? -1 : 1) })

    if (isReposted) {
      await supabase.from('reposts').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('reposts').insert({ post_id: post.id, user_id: user.id })
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

  const toggleCommentLike = async (commentId: string, currentLiked: boolean) => {
    if (!user) return
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, is_liked: !currentLiked, likes_count: (c.likes_count || 0) + (currentLiked ? -1 : 1) }
        : c
    ))
    if (currentLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    }
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
        }, 400) // Delay to let first sheet close smoothly
      }},
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const submitComment = async () => {
    if (!newComment.trim() || !user || !post) return
    setSubmitting(true)
    
    const { data, error } = await supabase.from('comments').insert({
      post_id: post.id, user_id: user.id, content: newComment.trim()
    }).select('*, profiles(id, full_name, username, avatar_url, is_verified, settings)').single()

    if (error) {
      Alert.alert('Error', error.message)
    } else if (data) {
      setComments(prev => [...prev, data])
      setNewComment('')
      setPost({ ...post, comments_count: (post.comments_count || 0) + 1 })
    }
    setSubmitting(false)
  }

  const timeAgo = (date: string) => {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`
    return `${Math.floor(secs / 86400)}d`
  }

  const renderHeader = () => (
    <View style={[styles.postHeader]}>
      {coAuthor ? (
          <View style={{ width: 44, height: 44, marginRight: 10, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderRadius: 15, overflow: 'hidden', borderWidth: post.is_ghost ? 2 : 1, borderColor: post.is_ghost ? '#f59e0b' : colors.border }}>
              {post.profiles?.avatar_url ? (
                <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={{ width: 30, height: 30 }} />
              ) : (
                <View style={[styles.avatarFallback, { width: 30, height: 30 }]}>
                  <Text style={[styles.avatarFallbackText, { fontSize: 13 }]}>{post.profiles?.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.background, overflow: 'hidden' }}>
              {coAuthor.avatar_url ? (
                <Image source={{ uri: getCdnUrl(coAuthor.avatar_url) }} style={{ width: 30, height: 30 }} />
              ) : (
                <View style={[styles.avatarFallback, { width: 30, height: 30 }]}>
                  <Text style={[styles.avatarFallbackText, { fontSize: 13 }]}>{coAuthor.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
          </View>
      ) : post.profiles?.avatar_url ? (
        <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={[styles.postAvatar, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]} />
      ) : (
        <View style={[styles.postAvatar, styles.avatarFallback, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]}>
          <Text style={styles.avatarFallbackText}>{post.profiles?.full_name?.[0] || '?'}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.postName}>
            {coAuthor ? `${post.profiles?.username} & ${coAuthor.username}` : post.profiles?.username}
            {post.is_ghost && <Text style={{ color: '#f59e0b', fontWeight: '400' }}>  👻 24h</Text>}
          </Text>
          {post.profiles?.settings?.account_type === 'news' ? (
            <Ionicons name="newspaper" size={14} color="#eab308" />
          ) : post.profiles?.is_verified ? (
            <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
          ) : null}
        </View>
      </View>
      {user?.id !== post.creator_id && (
        <TouchableOpacity onPress={handlePostOptions} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textDim} />
        </TouchableOpacity>
      )}
    </View>
  )

  const renderMedia = () => {
    if (!post) return null;
    const hasImage = post.image_urls && post.image_urls.length > 0;
    if (post.video_url) {
      return (
        <View style={{ marginBottom: 12 }}>
          <Video
            source={{ uri: getCdnUrl(post.video_url) }}
            style={[styles.postImage, { width: '100%', aspectRatio: 1 / 1.1 }]}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            isLooping
          />
        </View>
      )
    }
    if (hasImage) {
      return (
        <View style={{}}>
          {post.image_urls.length > 1 ? (
            <ScrollView 
              horizontal 
              pagingEnabled 
              snapToInterval={feedWidth}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false} 
              style={{ marginBottom: 12 }}
            >
              {post.image_urls.map((url: string, idx: number) => (
                <View key={idx} style={{ width: feedWidth }}>
                  <Image source={{ uri: getCdnUrl(url) }} style={[styles.postImage, { width: '100%', aspectRatio: 1 / 1.1, marginBottom: 0 }]} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
          ) : (
            <Image source={{ uri: getCdnUrl(post.image_urls[0]) }} style={[styles.postImage, { width: '100%', aspectRatio: 1 / 1.1 }]} resizeMode="cover" />
          )}
        </View>
      )
    }
    return null;
  }

  const renderActions = () => (
    <View style={[styles.postActions]}>
      <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
        <Ionicons name={post.is_liked ? 'heart' : 'heart-outline'} size={26} color={post.is_liked ? '#ef4444' : colors.text} />
      </TouchableOpacity>
      <View style={styles.actionBtn}>
        <Ionicons name="chatbubble-outline" size={24} color={colors.text} style={{ transform: [{ scaleX: -1 }] }} />
      </View>
      <TouchableOpacity style={styles.actionBtn} onPress={toggleRepost}>
        <Ionicons name={post.is_reposted ? 'sync' : 'sync-outline'} size={26} color={post.is_reposted ? '#10b981' : colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <View style={styles.actionBtn}>
        <Ionicons name="bookmark-outline" size={24} color={colors.text} />
      </View>
    </View>
  )

  const renderLikesCount = () => (
    <View style={[styles.likesCountContainer]}>
      <Text style={styles.likesCountText}>{post?.likes_count || 0} likes</Text>
      <Text style={styles.timeAgoText}>{timeAgo(post?.created_at || new Date().toISOString())} ago</Text>
    </View>
  )

  const renderInputBox = () => (
    <View style={styles.inputArea}>
      <Ionicons name="happy-outline" size={24} color={colors.text} style={{ marginRight: 8 }} />
      <TextInput
        style={styles.input}
        placeholder="Add a comment..."
        placeholderTextColor={colors.textDim}
        value={newComment}
        onChangeText={setNewComment}
        multiline
      />
      <TouchableOpacity 
        onPress={submitComment}
        disabled={!newComment.trim() || submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : (
          <Text style={[styles.sendBtnText, (!newComment.trim() || submitting) && { opacity: 0.5 }]}>Post</Text>
        )}
      </TouchableOpacity>
    </View>
  )

  const renderComment = ({ item }: { item: any }) => (
    <View style={styles.commentRow}>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: getCdnUrl(item.profiles.avatar_url) }} style={styles.commentAvatar} />
      ) : (
        <View style={[styles.commentAvatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{item.profiles?.full_name?.[0] || '?'}</Text>
        </View>
      )}
      <View style={styles.commentContent}>
        <Text style={styles.commentText}>
          <Text style={styles.commentName}>{item.profiles?.username}</Text>
          {item.profiles?.settings?.account_type === 'news' ? (
            <Text> <Ionicons name="newspaper" size={13} color="#eab308" /></Text>
          ) : item.profiles?.is_verified ? (
            <Text> <Ionicons name="checkmark-circle" size={13} color="#3b82f6" /></Text>
          ) : null}
          <Text>  {item.content}</Text>
        </Text>
        <View style={styles.commentFooter}>
          <Text style={styles.commentMeta}>{timeAgo(item.created_at)}</Text>
          {item.likes_count > 0 && <Text style={styles.commentMeta}>{item.likes_count} likes</Text>}
          <Text style={styles.commentMetaBtn}>Reply</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.commentLikeBtn} onPress={() => toggleCommentLike(item.id, item.is_liked)}>
        <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={14} color={item.is_liked ? "#ef4444" : colors.textDim} />
      </TouchableOpacity>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    )
  }



  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton style={styles.backBtn} />
        <Text style={styles.headerTitle}>Post</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={comments}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View style={[styles.postContainer, { paddingTop: 0, paddingHorizontal: 0 }]}>
                {renderHeader()}
                {renderMedia()}
                {renderActions()}
                {renderLikesCount()}
                {!!post.content && (
                  <View style={{ paddingHorizontal: 16, marginBottom: 8, marginTop: 4 }}>
                    <Text style={styles.commentText}>
                      <Text style={styles.commentName}>{post.profiles?.username} </Text>
                      {post.content}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.divider} />
            </>
          }
          renderItem={renderComment}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
            </View>
          }
        />
        {renderInputBox()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  postContainer: { paddingBottom: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingHorizontal: 16 },
  webHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 0 },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postName: { fontSize: 14, fontWeight: '700', color: colors.text },
  postImage: { width: '100%', aspectRatio: 1 / 1.1, marginBottom: 12, backgroundColor: colors.border },
  webMediaContainer: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  webMediaElement: { width: '100%', height: '100%' },
  postActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 16 },
  webActions: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 6 },
  actionBtn: { paddingVertical: 4 },
  likesCountContainer: { paddingHorizontal: 16, marginBottom: 8 },
  webLikesCount: { paddingHorizontal: 16, marginBottom: 16 },
  likesCountText: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  timeAgoText: { fontSize: 12, color: colors.textDim, textTransform: 'uppercase' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  avatarFallbackText: { fontSize: 14, fontWeight: '700', color: colors.textDim },
  commentContent: { flex: 1 },
  commentName: { fontSize: 14, fontWeight: '700', color: colors.text },
  commentText: { fontSize: 14, lineHeight: 20, color: colors.text },
  commentFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  commentMeta: { fontSize: 12, color: colors.textDim },
  commentMetaBtn: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 15 },
  inputArea: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background
  },
  input: {
    flex: 1, fontSize: 15, color: colors.text, maxHeight: 100
  },
  sendBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 15 },
})
