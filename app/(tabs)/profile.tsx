import { getCdnUrl } from '../../lib/cdn';
// app/(tabs)/profile.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Image, ScrollView, ActivityIndicator, Linking, Modal, TextInput
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PostItem, PostType } from '../../components/PostItem'
import { VibeBadge } from '../../components/VibeBadge'
import { Skeleton } from '../../components/Skeleton'

export default function () {
  const PRESET_VIBES = [
    { icon: 'headset', color: '#06b6d4', text: 'Listening to music' }, // Cyan
    { icon: 'game-controller', color: '#8b5cf6', text: 'Gaming' }, // Purple
    { icon: 'moon', color: '#6366f1', text: 'Sleepy' }, // Indigo
    { icon: 'fast-food', color: '#f59e0b', text: 'Eating' }, // Amber
    { icon: 'airplane', color: '#3b82f6', text: 'Traveling' }, // Blue
    { icon: 'laptop', color: '#10b981', text: 'Working' }, // Emerald
    { icon: 'car', color: '#ef4444', text: 'Driving' }, // Red
    { icon: 'film', color: '#ec4899', text: 'Watching a movie' }, // Pink
    { icon: 'book', color: '#eab308', text: 'Studying' }, // Yellow
    { icon: 'medkit', color: '#14b8a6', text: 'Sick' }, // Teal
    { icon: 'sparkles', color: '#f43f5e', text: 'Partying' }, // Rose
  ]
  const PRESET_TEAMS = [
    { id: 'simba', name: 'Simba SC', color: '#ef4444' }, // Red
    { id: 'yanga', name: 'Young Africans', color: '#10b981' }, // Green
    { id: 'azam', name: 'Azam FC', color: '#3b82f6' }, // Blue
    { id: 'coastal', name: 'Coastal Union', color: '#dc2626' }, // Dark Red
    { id: 'dodoma', name: 'Dodoma Jiji', color: '#8b5cf6' }, // Purple
    { id: 'mtibwa', name: 'Mtibwa Sugar', color: '#22c55e' }, // Green
    { id: 'kmc', name: 'KMC FC', color: '#f97316' }, // Orange
    { id: 'namungo', name: 'Namungo FC', color: '#14b8a6' }, // Teal
    { id: 'singida', name: 'Singida BS', color: '#ec4899' }, // Pink
  ]
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
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'reposts' | 'likes' | 'archive'>('posts')
  const [unreadCount, setUnreadCount] = useState(0)
  const [vibeModalVisible, setVibeModalVisible] = useState(false)
  const [teamModalVisible, setTeamModalVisible] = useState(false)
  const [customVibeText, setCustomVibeText] = useState('')

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

      const channel = supabase.channel(`public:follows:${user.id}_${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${user.id}` }, () => {
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id)
            .then(({ count }) => isActive && setFollowersCount(count || 0))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${user.id}` }, () => {
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id)
            .then(({ count }) => isActive && setFollowingCount(count || 0))
        })
        .subscribe()

      const postsChannel = supabase.channel(`public:posts:analytics:${user.id}_${Date.now()}`)
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
    const ch = supabase.channel(`notif_badge_${user.id}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  const handleSetVibe = async (vibe: any) => {
    if (!user || !profile) return
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const newVibe = { ...vibe, expires_at }
    const newSettings = { ...profile.settings, vibe: newVibe }
    setProfile({ ...profile, settings: newSettings })
    setVibeModalVisible(false)
    setCustomVibeText('')
    await supabase.from('profiles').update({ settings: newSettings }).eq('id', user.id)
  }

  const handleCustomVibe = () => {
    if (!customVibeText.trim()) return
    handleSetVibe({ icon: 'chatbubble-ellipses', color: '#a855f7', text: customVibeText.trim() })
  }

  const handleClearVibe = async () => {
    setVibeModalVisible(false)
    const newSettings = { ...profile?.settings }
    delete newSettings.vibe
    setProfile({ ...profile, settings: newSettings })
    await supabase.from('profiles').update({ settings: newSettings }).eq('id', user?.id)
  }

  const handleSetTeam = async (team: any) => {
    setTeamModalVisible(false)
    const newSettings = { ...profile?.settings, football_team: team }
    setProfile({ ...profile, settings: newSettings })
    await supabase.from('profiles').update({ settings: newSettings }).eq('id', user?.id)
  }

  const handleClearTeam = async () => {
    setTeamModalVisible(false)
    const newSettings = { ...profile?.settings }
    delete newSettings.football_team
    setProfile({ ...profile, settings: newSettings })
    await supabase.from('profiles').update({ settings: newSettings }).eq('id', user?.id)
  }

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
              {profile?.settings?.account_type === 'news' && (
                <Ionicons name="newspaper" size={18} color="#eab308" />
              )}
            </View>
            <Text style={styles.username}>@{profile?.username || 'user'}</Text>
            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            {/* Vibe Status Pill */}
            {profile?.settings?.vibe ? (
              <TouchableOpacity 
                onPress={() => setVibeModalVisible(true)} 
                activeOpacity={0.7}
                style={{ alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center' }}
              >
                {profile.settings.vibe.icon ? (
                  <Ionicons name={profile.settings.vibe.icon as any} size={16} color={profile.settings.vibe.color || "#a855f7"} style={{ marginRight: 6 }} />
                ) : (
                  <Text style={{ fontSize: 16, marginRight: 6 }}>{profile.settings.vibe.emoji}</Text>
                )}
                <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }} numberOfLines={1}>{profile.settings.vibe.text}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={() => setVibeModalVisible(true)} 
                activeOpacity={0.7}
                style={{ alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center' }}
              >
                <Ionicons name="add" size={16} color="#a1a1aa" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, color: '#a1a1aa', fontWeight: '700' }}>Set Vibe</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.avatarWrap}>
            <View style={[profile?.settings?.football_team && { padding: 4, borderRadius: 45, borderWidth: 2, borderColor: profile.settings.football_team.color }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: getCdnUrl(profile.avatar_url) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{profile?.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
            {profile?.settings?.football_team && (
              <View style={{ position: 'absolute', bottom: -4, alignSelf: 'center', backgroundColor: profile.settings.football_team.color, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: '#18181b', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="football" size={10} color="#fff" style={{ marginRight: 2 }} />
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{profile.settings.football_team.id.toUpperCase()}</Text>
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
          <TouchableOpacity style={styles.btnOutlineShare} onPress={() => setVibeModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="sparkles" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.btnOutlineText}>Vibe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutlineShare} onPress={() => setTeamModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="football" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.btnOutlineText}>Team</Text>
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
          {(() => {
            const hasSportsCodes = posts.some((p: any) => p.settings?.is_betting_code === true && !p.is_repost && !p.is_liked_tab && !p.is_bookmarked_tab);
            const availableTabs = ['posts', ...(hasSportsCodes ? ['sports'] : []), 'replies', 'media', 'reposts', 'likes', 'archive'];
            return availableTabs.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab as any)}
              >
                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                  {tab === 'posts' ? 'Threads' : tab === 'sports' ? 'Sports Codes' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ));
          })()}
        </ScrollView>

        <View style={styles.feed}>
          {(() => {
            const displayPosts = posts.filter((post: any) => {
              if (post.settings?.is_job === true) return false
              if (activeTab === 'sports') return post.settings?.is_betting_code === true && !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab
              if (activeTab === 'reposts') return post.is_repost
              if (activeTab === 'likes') return post.is_liked_tab
              if (activeTab === 'archive') return post.is_bookmarked_tab
              if (activeTab === 'media') return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && (post.image_urls && post.image_urls.length > 0)
              if (activeTab === 'replies') return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && post.parent_id
              
              // Default fallback for 'posts' (Threads tab)
              return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && !post.settings?.is_betting_code
            })
            if (displayPosts.length === 0) {
              return (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textDim }}>No {activeTab === 'posts' ? 'threads' : activeTab} found.</Text>
                </View>
              )
            }
            if (activeTab === 'media') {
              return (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2 }}>
                  {displayPosts.map((post: any) => {
                    const mediaUrl = (post.image_urls && post.image_urls.length > 0) ? post.image_urls[0] : post.video_url
                    if (!mediaUrl) return null
                    return (
                      <TouchableOpacity 
                        key={`${post.id}-${post.is_repost}`} 
                        style={{ width: (Dimensions.get('window').width - 8) / 3, aspectRatio: 1, backgroundColor: colors.border }}
                        onPress={() => router.push(`/post/${post.id}`)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: getCdnUrl(mediaUrl) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                        {post.video_url && (
                          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                            <Ionicons name="play" size={14} color="#fff" />
                          </View>
                        )}
                        {(post.image_urls && post.image_urls.length > 1) && (
                          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                            <Ionicons name="images" size={14} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            }

            return displayPosts.map((post: any) => (
              <PostItem key={`${post.id}-${post.is_repost}-${post.is_liked_tab}`} post={post as PostType} compact={true} />
            ))
          })()}
        </View>
      </ScrollView>

      {/* Vibe Modal */}
      <Modal
        visible={vibeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVibeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set your Vibe</Text>
              <TouchableOpacity onPress={() => setVibeModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Your vibe disappears in 24 hours.</Text>
            
            {/* Custom Vibe Input */}
            <View style={styles.customVibeContainer}>
              <View style={styles.customVibeInputWrap}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#a855f7" />
                <TextInput
                  style={styles.customVibeInput}
                  placeholder="What's your vibe right now?"
                  placeholderTextColor={colors.textDim}
                  value={customVibeText}
                  onChangeText={setCustomVibeText}
                  maxLength={40}
                  onSubmitEditing={handleCustomVibe}
                />
              </View>
              {customVibeText.trim().length > 0 && (
                <TouchableOpacity style={styles.customVibeBtn} onPress={handleCustomVibe}>
                  <Text style={styles.customVibeBtnText}>Set</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.vibeGrid}>
              {PRESET_VIBES.map((vibe, idx) => {
                const isActive = profile?.settings?.vibe?.icon === vibe.icon || profile?.settings?.vibe?.emoji === (vibe as any).emoji
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.vibeItem, isActive && { borderColor: '#3f3f46', borderWidth: 1 }]}
                    onPress={() => handleSetVibe(vibe)}
                  >
                    {vibe.icon ? (
                      <Ionicons name={vibe.icon as any} size={28} color={vibe.color} />
                    ) : (
                      <Text style={styles.vibeEmoji}>{(vibe as any).emoji}</Text>
                    )}
                    <Text style={styles.vibeText}>{vibe.text}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            
            {profile?.settings?.vibe && (
              <TouchableOpacity style={styles.clearVibeBtn} onPress={handleClearVibe}>
                <Text style={styles.clearVibeBtnText}>Clear Vibe</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Team Selection Modal */}
      <Modal visible={teamModalVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTeamModalVisible(false)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Team ⚽</Text>
            <TouchableOpacity onPress={() => setTeamModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>Show your allegiance! Your avatar will get a glowing ring in your team's colors.</Text>

          <View style={styles.vibeGrid}>
            {PRESET_TEAMS.map((team, idx) => {
              const isActive = profile?.settings?.football_team?.id === team.id
              return (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.vibeItem, { width: '45%' }, isActive && { borderColor: team.color, borderWidth: 1 }]}
                  onPress={() => handleSetTeam(team)}
                >
                  <Ionicons name="football" size={28} color={team.color} />
                  <Text style={styles.vibeText}>{team.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {profile?.settings?.football_team && (
            <TouchableOpacity style={styles.clearVibeBtn} onPress={handleClearTeam}>
              <Text style={styles.clearVibeBtnText}>Remove Team Badge</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
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
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row'
  },
  btnOutlineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  socialRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  tabsScroll: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  tabBtnTextActive: { color: colors.text },
  feed: { paddingBottom: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 14, color: colors.textDim, marginBottom: 20 },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  vibeItem: { width: '30%', backgroundColor: 'transparent', padding: 12, borderRadius: 16, alignItems: 'center', gap: 6 },
  vibeItemActive: {},
  vibeEmoji: { fontSize: 28 },
  vibeText: { fontSize: 11, fontWeight: '600', color: colors.textDim, textAlign: 'center' },
  vibeTextActive: { color: '#2563eb' },
  customVibeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  customVibeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border, paddingHorizontal: 12, borderRadius: 16, height: 48, gap: 8 },
  customVibeInput: { flex: 1, color: colors.text, fontSize: 15 },
  customVibeBtn: { backgroundColor: '#2563eb', height: 48, paddingHorizontal: 20, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  customVibeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  clearVibeBtn: { marginTop: 24, backgroundColor: '#fee2e2', padding: 14, borderRadius: 12, alignItems: 'center' },
  clearVibeBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
})
