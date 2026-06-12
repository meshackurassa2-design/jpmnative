import { getCdnUrl } from '../../lib/cdn';
// app/(tabs)/profile.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Linking
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PostItem, PostType } from '../../components/PostItem'
import { Skeleton } from '../../components/Skeleton'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [monthlyViews, setMonthlyViews] = useState(0)
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'reposts' | 'likes' | 'jobs' | 'archive'>('posts')
  const [unreadCount, setUnreadCount] = useState(0)

  useFocusEffect(
    React.useCallback(() => {
      if (!user) return
      let isActive = true

      const fetch = async () => {
        try {
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const postSel = 'id, content, image_urls, created_at, creator_id, parent_id, settings, profiles:creator_id(id, full_name, username, avatar_url, is_verified), likes(count), comments(count), reposts(count)'
          
          const [
            { data: prof, error: profErr },
            { data: userPosts, error: postsErr },
            { count: followers },
            { count: following },
            { data: viewsData },
            { data: repostsRes, error: repErr },
            { data: likesRes, error: likesErr },
            { data: bookmarksRes, error: bookErr }
          ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('posts').select(postSel).eq('creator_id', user.id).or('is_ghost.is.null,is_ghost.eq.false').order('created_at', { ascending: false }).limit(20),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
            supabase.from('posts').select('view_count').eq('creator_id', user.id).gte('created_at', startDate),
            supabase.from('reposts').select(`created_at, user_id, post:posts(${postSel})`).eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
            supabase.from('likes').select(`created_at, post:posts(${postSel})`).eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
            supabase.from('bookmarks').select(`created_at, post:posts(${postSel})`).eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
          ])

          if (!isActive) return

          setProfile(prof)
          setFollowersCount(followers || 0)
          setFollowingCount(following || 0)

          let combinedFeed: any[] = []

          if (userPosts) {
            combinedFeed = [...combinedFeed, ...userPosts.map((p: any) => ({
              ...p,
              is_repost: false,
              likes_count: p.likes?.[0]?.count || 0,
              comments_count: p.comments?.[0]?.count || 0,
              reposts_count: p.reposts?.[0]?.count || 0
            }))]
          }

          if (repostsRes) {
            combinedFeed = [...combinedFeed, ...repostsRes.map((r: any) => {
              const originalPost = Array.isArray(r.post) ? r.post[0] : r.post
              if (!originalPost) return null
              return {
                ...originalPost,
                feed_created_at: r.created_at,
                is_repost: true,
                likes_count: originalPost.likes?.[0]?.count || 0,
                comments_count: originalPost.comments?.[0]?.count || 0,
                reposts_count: originalPost.reposts?.[0]?.count || 0
              }
            }).filter(Boolean)]
          }

          if (likesRes) {
            combinedFeed = [...combinedFeed, ...likesRes.map((l: any) => {
              const originalPost = Array.isArray(l.post) ? l.post[0] : l.post
              if (!originalPost) return null
              return {
                ...originalPost,
                feed_created_at: l.created_at,
                is_liked_tab: true,
                likes_count: originalPost.likes?.[0]?.count || 0,
                comments_count: originalPost.comments?.[0]?.count || 0,
                reposts_count: originalPost.reposts?.[0]?.count || 0
              }
            }).filter(Boolean)]
          }

          if (bookmarksRes) {
            combinedFeed = [...combinedFeed, ...bookmarksRes.map((b: any) => {
              const originalPost = Array.isArray(b.post) ? b.post[0] : b.post
              if (!originalPost) return null
              return {
                ...originalPost,
                feed_created_at: b.created_at,
                is_bookmarked_tab: true,
                likes_count: originalPost.likes?.[0]?.count || 0,
                comments_count: originalPost.comments?.[0]?.count || 0,
                reposts_count: originalPost.reposts?.[0]?.count || 0
              }
            }).filter(Boolean)]
          }

          combinedFeed.sort((a, b) => new Date(b.feed_created_at || b.created_at).getTime() - new Date(a.feed_created_at || a.created_at).getTime())
          
          const uniqueFeed = combinedFeed.filter((v: any, i: number, a: any[]) => 
            a.findIndex(t => t.id === v.id && t.is_repost === v.is_repost && t.is_liked_tab === v.is_liked_tab && t.is_bookmarked_tab === v.is_bookmarked_tab) === i
          )

          setPosts(uniqueFeed)
          
          const sum = viewsData?.reduce((acc, curr) => acc + (curr.view_count || 0), 0) || 0
          setMonthlyViews(sum)
        } catch (error) {
          console.error("Error in profile fetch:", error)
        } finally {
          setLoading(false)
        }
      }
      fetch()

      const channel = supabase.channel(`public:follows:${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${user.id}` }, () => {
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id)
            .then(({ count }) => isActive && setFollowersCount(count || 0))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${user.id}` }, () => {
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id)
            .then(({ count }) => isActive && setFollowingCount(count || 0))
        })
        .subscribe()

      const postsChannel = supabase.channel(`public:posts:analytics:${user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `creator_id=eq.${user.id}` }, () => {
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          supabase.from('posts').select('view_count').eq('creator_id', user.id).gte('created_at', startDate)
            .then(({ data }) => {
              if (isActive) {
                const sum = data?.reduce((acc, curr) => acc + (curr.view_count || 0), 0) || 0
                setMonthlyViews(sum)
              }
            })
        })
        .subscribe()

      return () => {
        isActive = false
        supabase.removeChannel(channel)
        supabase.removeChannel(postsChannel)
      }
    }, [user])
  )

  // Live unread notification badge
  React.useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false)
      setUnreadCount(count || 0)
    }
    fetchUnread()
    const ch = supabase.channel(`notif_badge_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerRow}>
          <Skeleton width={120} height={20} />
          <Skeleton width={28} height={28} borderRadius={14} />
        </View>
        <View style={styles.infoArea}>
          <View style={styles.infoLeft}>
            <Skeleton width="60%" height={24} style={{ marginBottom: 4 }} />
            <Skeleton width="40%" height={16} style={{ marginBottom: 16 }} />
            <Skeleton width="80%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="70%" height={14} />
          </View>
          <View style={styles.avatarWrap}>
            <Skeleton width={76} height={76} borderRadius={38} />
          </View>
        </View>
        <View style={[styles.followersRow, { marginVertical: 16 }]}>
          <Skeleton width={100} height={14} />
        </View>
        <View style={styles.ctaRow}>
          <Skeleton width="48%" height={36} borderRadius={18} />
          <Skeleton width="48%" height={36} borderRadius={18} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/wallet')} style={[styles.iconBtn, { marginRight: 8 }]}>
              <Ionicons name="wallet-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            {/* 🔴 Live Notifications Badge */}
            <TouchableOpacity onPress={() => { setUnreadCount(0); router.push('/notifications') }} style={[styles.iconBtn, { marginRight: 8 }]}>
              <View>
                <Ionicons name="notifications-outline" size={24} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(settings)')} style={styles.iconBtn}>
              <Ionicons name="menu-outline" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Info Area */}
        <View style={styles.infoArea}>
          <View style={styles.infoLeft}>
            <View style={styles.nameRow}>
              <Text style={styles.fullName}>{profile?.full_name}</Text>
              {profile?.is_verified && (
                <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
              )}
            </View>
            <Text style={styles.username}>@{profile?.username || 'user'}</Text>
            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          </View>

          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: getCdnUrl(profile.avatar_url) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{profile?.full_name?.[0] || '?'}</Text>
              </View>
            )}
          </View>
        </View>

        {monthlyViews !== null && monthlyViews > 0 && (
          <TouchableOpacity style={styles.insightsLink} onPress={() => router.push('/analytics')} activeOpacity={0.7}>
            <Text style={styles.insightsText}>{monthlyViews} views in the last 30 days</Text>
            <Ionicons name="chevron-forward" size={14} color="#71717a" />
          </TouchableOpacity>
        )}

        <View style={styles.followersRow}>
          <TouchableOpacity onPress={() => router.push(`/connections?userId=${user.id}&initialTab=followers`)} activeOpacity={0.7}>
            <Text style={styles.followersText}>{followersCount} followers</Text>
          </TouchableOpacity>
          <Text style={styles.dot}>•</Text>
          <TouchableOpacity onPress={() => router.push(`/connections?userId=${user.id}&initialTab=following`)} activeOpacity={0.7}>
            <Text style={styles.followersText}>{followingCount} following</Text>
          </TouchableOpacity>
          {profile?.website_url ? (
            <>
              <Text style={styles.dot}>•</Text>
              <TouchableOpacity onPress={() => {
                let url = profile.website_url;
                if (!url.startsWith('http')) url = 'https://' + url;
                Linking.openURL(url).catch(() => {});
              }}>
                <Text style={styles.websiteText}>{profile.website_url.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => router.push('/(settings)/edit-profile')} activeOpacity={0.7}>
            <Text style={styles.btnOutlineText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutlineShare} activeOpacity={0.7}>
            <Text style={styles.btnOutlineText}>Share profile</Text>
          </TouchableOpacity>
        </View>

        {(profile?.instagram_url || profile?.tiktok_url || profile?.facebook_url) ? (
          <View style={styles.socialRow}>
            {profile?.instagram_url ? (
              <TouchableOpacity onPress={() => { let url = profile.instagram_url; if (!url.startsWith('http')) url = 'https://' + url; Linking.openURL(url).catch(() => {}); }}>
                <Ionicons name="logo-instagram" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            ) : null}
            {profile?.tiktok_url ? (
              <TouchableOpacity onPress={() => { let url = profile.tiktok_url; if (!url.startsWith('http')) url = 'https://' + url; Linking.openURL(url).catch(() => {}); }}>
                <Ionicons name="logo-tiktok" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            ) : null}
            {profile?.facebook_url ? (
              <TouchableOpacity onPress={() => { let url = profile.facebook_url; if (!url.startsWith('http')) url = 'https://' + url; Linking.openURL(url).catch(() => {}); }}>
                <Ionicons name="logo-facebook" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {['posts', 'replies', 'media', 'reposts', 'likes', 'jobs', 'archive'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab === 'posts' ? 'Threads' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.feed}>
          {(() => {
            const displayPosts = posts.filter((post: any) => {
              if (activeTab === 'jobs') return post.settings?.is_job === true
              if (post.settings?.is_job === true) return false
              if (activeTab === 'reposts') return post.is_repost
              if (activeTab === 'likes') return post.is_liked_tab
              if (activeTab === 'archive') return post.is_bookmarked_tab
              if (activeTab === 'media') return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && (post.image_urls && post.image_urls.length > 0)
              if (activeTab === 'replies') return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && post.parent_id
              return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab
            })
            if (displayPosts.length === 0) {
              return (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textDim }}>No {activeTab === 'posts' ? 'threads' : activeTab} found.</Text>
                </View>
              )
            }
            return displayPosts.map(post => (
              <PostItem key={`${post.id}-${post.is_repost}-${post.is_liked_tab}`} post={post as PostType} />
            ))
          })()}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  iconBtn: { padding: 4 },
  infoArea: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  infoLeft: { flex: 1, paddingRight: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  fullName: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  username: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 8 },
  bio: { fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '500' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.border },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: colors.textDim },
  insightsLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, marginBottom: 16,
  },
  insightsText: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  followersRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 20,
  },
  followersText: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  dot: { color: '#d4d4d8' },
  websiteText: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  ctaRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  btnOutline: {
    flex: 1, backgroundColor: colors.background, borderRadius: 10,
    height: 36, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  btnOutlineShare: {
    flex: 1, backgroundColor: colors.background, borderRadius: 10,
    height: 36, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  btnOutlineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  socialRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  tabsScroll: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  tabBtnTextActive: { color: colors.text },
  feed: { paddingBottom: 40 },
})
