import { getCdnUrl } from '../lib/cdn';
// app/profile.tsx — Public profile screen (view any user by ?id=)
import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, FlatList, ActivityIndicator, Dimensions, Alert, ScrollView, Linking, Modal, TextInput
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useUI } from '../lib/ui'
import { PostItem, PostType } from '../components/PostItem'
import { VibeBadge } from '../components/VibeBadge'
import { Skeleton } from '../components/Skeleton'
import { JobCard } from '../components/JobCard'
import { BackButton } from '../components/BackButton'

const { width } = Dimensions.get('window')
const GRID_SIZE = (width - 3) / 3

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
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showActionSheet, showToast } = useUI()
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)
  const [userShop, setUserShop] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowsMe, setIsFollowsMe] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'reposts' | 'likes' | 'jobs' | 'archive'>('posts')
  const [vibeModalVisible, setVibeModalVisible] = useState(false)
  const [teamModalVisible, setTeamModalVisible] = useState(false)
  const [customVibeText, setCustomVibeText] = useState('')

  const isOwnProfile = user?.id === id

  const fetchProfile = useCallback(async () => {
    if (!id) return
    setLoading(true)

    try {
      const postSel = 'id, content, image_urls, video_url, created_at, creator_id, parent_id, settings, is_ghost, profiles:creator_id(id, full_name, username, avatar_url, is_verified), likes(count), comments(count), reposts(count)'
      
      const promises: any[] = [
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('posts').select(postSel).eq('creator_id', id).or('is_ghost.is.null,is_ghost.eq.false').order('created_at', { ascending: false }).limit(20),
        supabase.from('reposts').select(`created_at, user_id, post:posts(${postSel})`).eq('user_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('likes').select(`created_at, post:posts(${postSel})`).eq('user_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('bookmarks').select(`created_at, post:posts(${postSel})`).eq('user_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('shops').select('id, name, status').eq('owner_id', id).eq('status', 'active').maybeSingle()
      ]
      
      if (user) {
        promises.push(supabase.from('profiles').select('is_admin').eq('id', user.id).single())
      }

      const results = await Promise.all(promises)
      const [
        { data: profileRes, error: profErr },
        { count: followersCountRes },
        { count: followingCountRes },
        { data: postsRes, error: postsErr },
        { data: repostsRes, error: repErr },
        { data: likesRes, error: likesErr },
        { data: bookmarksRes, error: bookErr },
        { data: shopRes }
      ] = results

      const currentUserProfileRes = user ? results[8]?.data : null

      if (profErr) console.error('Profile fetch error:', profErr)
      if (postsErr) console.error('Posts fetch error:', postsErr)
      if (repErr) console.error('Reposts fetch error:', repErr)
      if (likesErr) console.error('Likes fetch error:', likesErr)
      if (bookErr) console.error('Bookmarks fetch error:', bookErr)

      setProfile(profileRes)
      setCurrentUserProfile(currentUserProfileRes)
      setUserShop(shopRes)
      setFollowersCount(followersCountRes || 0)
      setFollowingCount(followingCountRes || 0)

      // Merge unified feed
      let combinedFeed: any[] = []

      if (postsRes) {
        combinedFeed = [...combinedFeed, ...postsRes.map((p: any) => ({
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
      
      // Deduplicate
      const uniqueFeed = combinedFeed.filter((v: any, i: number, a: any[]) => 
        a.findIndex(t => t.id === v.id && t.is_repost === v.is_repost && t.is_liked_tab === v.is_liked_tab && t.is_bookmarked_tab === v.is_bookmarked_tab) === i
      )

      setPosts(uniqueFeed)

      // Check if current user follows this profile
      if (user && id !== user.id) {
        const { data: followCheck } = await supabase
          .from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).maybeSingle()
        setIsFollowing(!!followCheck)

        const { data: followsMeCheck } = await supabase
          .from('follows').select('follower_id').eq('follower_id', id).eq('following_id', user.id).maybeSingle()
        setIsFollowsMe(!!followsMeCheck)
      }
    } catch (error) {
      console.error('Error in public profile fetch:', error)
    } finally {
      setLoading(false)
    }
  }, [id, user])

  useEffect(() => { 
    fetchProfile() 
    if (!id) return

    const channel = supabase.channel(`public:follows:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${id}` }, () => {
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id)
          .then(({ count }) => setFollowersCount(count || 0))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${id}` }, () => {
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id)
          .then(({ count }) => setFollowingCount(count || 0))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchProfile, id])

  const toggleFollow = async () => {
    if (!user) { router.push('/(auth)/login'); return }
    setFollowLoading(true)
    if (isFollowing) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
      if (error) {
        showToast('Failed to unfollow', 'error')
      } else {
        setIsFollowing(false)
        setFollowersCount(c => Math.max(0, c - 1))
      }
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
      if (error) {
        if (error.code === '23505') {
          // Duplicate key means they are already following, just sync UI
          setIsFollowing(true)
        } else {
          console.error('Follow error:', error)
          showToast('Failed to follow user', 'error')
        }
      } else {
        setIsFollowing(true)
        setFollowersCount(c => c + 1)
      }
    }
    setFollowLoading(false)
  }

  const handleToggleVerify = async () => {
    if (!id || !profile) return
    const newStatus = !profile.is_verified
    const { error } = await supabase.from('profiles').update({ is_verified: newStatus }).eq('id', id)
    if (!error) {
      setProfile({ ...profile, is_verified: newStatus })
    }
  }

  const handleReport = () => {
    if (isOwnProfile) return
    showActionSheet('Why are you reporting this user?', [
      { text: 'Spam or scam', onPress: () => submitUserReport('Spam') },
      { text: 'Inappropriate content', onPress: () => submitUserReport('Inappropriate content') },
      { text: 'Impersonation', onPress: () => submitUserReport('Impersonation') },
      { text: 'Harassment or bullying', onPress: () => submitUserReport('Harassment') },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const handleSetVibe = async (vibe: any) => {
    if (!id || !profile) return
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const newVibe = { ...vibe, expires_at }
    const newSettings = { ...profile.settings, vibe: newVibe }
    setProfile({ ...profile, settings: newSettings })
    setVibeModalVisible(false)
    setCustomVibeText('')
    await supabase.from('profiles').update({ settings: newSettings }).eq('id', id)
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

  const handleOptions = () => {
    if (isOwnProfile) return
    showActionSheet('Profile Options', [
      { text: 'Block User', style: 'destructive', icon: 'ban', onPress: async () => {
        if (!user || !id) return
        const { error } = await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: id })
        if (!error) {
          showToast('User blocked successfully.', 'success')
          router.back()
        } else {
          showToast('Could not block user.', 'error')
        }
      }},
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Nav Bar Skeleton */}
        <View style={styles.navBar}>
          <BackButton />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Skeleton width={120} height={20} />
          </View>
          <View style={styles.navBtn} />
        </View>

        {/* Info Area Skeleton */}
        <View style={styles.infoArea}>
          <View style={styles.infoLeft}>
            <View style={{ marginBottom: 8 }}>
              <Skeleton width={160} height={28} />
            </View>
            <View style={{ marginBottom: 16 }}>
              <Skeleton width={100} height={18} />
            </View>
            <View style={{ gap: 6 }}>
              <Skeleton width="90%" height={16} />
              <Skeleton width="70%" height={16} />
            </View>
          </View>
          <View style={styles.avatarWrap}>
            <Skeleton width={80} height={80} borderRadius={40} />
          </View>
        </View>

        {/* Followers Skeleton */}
        <View style={styles.followersRow}>
          <Skeleton width={100} height={16} />
        </View>

        {/* CTA Buttons Skeleton */}
        <View style={styles.ctaRow}>
          <Skeleton width="48%" height={36} borderRadius={10} />
          <Skeleton width="48%" height={36} borderRadius={10} />
        </View>
      </SafeAreaView>
    )
  }

  const Header = () => (
    <View>
      {/* Top nav bar */}
      <View style={styles.navBar}>
        <BackButton />
        <Text style={styles.navTitle} numberOfLines={1}>
          @{profile?.username || 'profile'}
        </Text>
        {!isOwnProfile && (
          <TouchableOpacity style={styles.navBtn} activeOpacity={0.7} onPress={handleOptions}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Info Area */}
      <View style={styles.infoArea}>
        {/* Left: Name, Username, Bio */}
        <View style={styles.infoLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.fullName}>{profile?.full_name}</Text>
            {profile?.is_verified && (
              <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
            )}
            {currentUserProfile?.is_admin && (
              <TouchableOpacity onPress={handleToggleVerify} style={styles.verifyBtnAdmin}>
                <Text style={styles.verifyBtnAdminText}>{profile?.is_verified ? 'UNVERIFY' : 'VERIFY'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.username}>@{profile?.username || 'user'}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          
          {/* Vibe Status Pill */}
          {profile?.settings?.vibe ? (
            <TouchableOpacity 
              onPress={() => isOwnProfile ? setVibeModalVisible(true) : null} 
              activeOpacity={isOwnProfile ? 0.7 : 1}
              style={{ alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center' }}
            >
              {profile.settings.vibe.icon ? (
                <Ionicons name={profile.settings.vibe.icon as any} size={16} color={profile.settings.vibe.color || "#a855f7"} style={{ marginRight: 6 }} />
              ) : (
                <Text style={{ fontSize: 16, marginRight: 6 }}>{profile.settings.vibe.emoji}</Text>
              )}
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }} numberOfLines={1}>{profile.settings.vibe.text}</Text>
            </TouchableOpacity>
          ) : isOwnProfile ? (
            <TouchableOpacity 
              onPress={() => setVibeModalVisible(true)} 
              activeOpacity={0.7}
              style={{ alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="add" size={16} color="#a1a1aa" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 13, color: '#a1a1aa', fontWeight: '700' }}>Set Vibe</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Right: Avatar */}
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

      {/* Followers & Following & Website */}
      <View style={styles.followersRow}>
        <TouchableOpacity 
          onPress={() => router.push(`/connections?userId=${id}&initialTab=followers`)}
          activeOpacity={0.7}
        >
          <Text style={styles.followersText}>{followersCount} followers</Text>
        </TouchableOpacity>
        <Text style={styles.dot}>•</Text>
        <TouchableOpacity 
          onPress={() => router.push(`/connections?userId=${id}&initialTab=following`)}
          activeOpacity={0.7}
        >
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

      {/* Action Buttons */}
      <View style={styles.ctaRow}>
        {isOwnProfile ? (
          <>
            <View style={{flexDirection: 'row', gap: 10, flex: 1}}>
              <TouchableOpacity style={[styles.btnOutline, {flex: 1.2}]} onPress={() => router.push('/(settings)/edit-profile')} activeOpacity={0.7}>
                <Text style={styles.btnOutlineText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, {flex: 1, flexDirection: 'row'}]} onPress={() => setVibeModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="sparkles" size={16} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={styles.btnOutlineText}>Vibe</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, {flex: 1, flexDirection: 'row'}]} onPress={() => setTeamModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="football" size={16} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={styles.btnOutlineText}>Team</Text>
              </TouchableOpacity>
            </View>
            {userShop && (
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.push(`/shop/${userShop.id}`)} activeOpacity={0.7}>
                <Ionicons name="storefront" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.btnFollow, isFollowing && styles.btnFollowing, {flex: 1}]}
              onPress={toggleFollow}
              disabled={followLoading}
              activeOpacity={0.85}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? colors.text : colors.background} />
              ) : (
                <Text style={[styles.btnFollowText, isFollowing && { color: colors.text }]}>
                  {isFollowing ? 'Following' : (isFollowsMe ? 'Follow Back' : 'Follow')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnOutline, {flex: 1}]}
              onPress={() => router.push(`/chat?id=${id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnOutlineText}>Message</Text>
            </TouchableOpacity>
            {userShop && (
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.push(`/shop/${userShop.id}`)} activeOpacity={0.7}>
                <Ionicons name="storefront" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Social links */}
      {(profile?.instagram_url || profile?.tiktok_url || profile?.facebook_url) ? (
        <View style={styles.socialRow}>
          {profile?.instagram_url ? (
            <TouchableOpacity onPress={() => {
              let url = profile.instagram_url;
              if (!url.startsWith('http')) url = 'https://' + url;
              Linking.openURL(url).catch(() => {});
            }}>
              <Ionicons name="logo-instagram" size={22} color="#a1a1aa" />
            </TouchableOpacity>
          ) : null}
          {profile?.tiktok_url ? (
            <TouchableOpacity onPress={() => {
              let url = profile.tiktok_url;
              if (!url.startsWith('http')) url = 'https://' + url;
              Linking.openURL(url).catch(() => {});
            }}>
              <Ionicons name="logo-tiktok" size={22} color="#a1a1aa" />
            </TouchableOpacity>
          ) : null}
          {profile?.facebook_url ? (
            <TouchableOpacity onPress={() => {
              let url = profile.facebook_url;
              if (!url.startsWith('http')) url = 'https://' + url;
              Linking.openURL(url).catch(() => {});
            }}>
              <Ionicons name="logo-facebook" size={22} color="#a1a1aa" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Dynamic Tabs */}
      {isOwnProfile || !profile?.is_private || isFollowing ? (
        <View>
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
        </View>
      ) : null}
    </View>
  )

  const canViewPosts = isOwnProfile || !profile?.is_private || isFollowing

  const displayPosts = canViewPosts ? posts.filter((post: any) => {
    if (activeTab === 'jobs') return post.settings?.is_job === true
    if (post.settings?.is_job === true) return false
    
    if (activeTab === 'reposts') return post.is_repost
    if (activeTab === 'likes') return post.is_liked_tab
    if (activeTab === 'archive') return post.is_bookmarked_tab
    if (activeTab === 'media') return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && (post.image_urls && post.image_urls.length > 0)
    if (activeTab === 'replies') return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab && post.parent_id
    
    return !post.is_repost && !post.is_liked_tab && !post.is_bookmarked_tab
  }) : []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={displayPosts}
        keyExtractor={item => item.id}
        ListHeaderComponent={Header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        ListEmptyComponent={
          !canViewPosts ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: '#111' }]}>
                <Ionicons name="lock-closed-outline" size={32} color="#a1a1aa" />
              </View>
              <Text style={styles.emptyText}>This account is private</Text>
              <Text style={[styles.emptySub, { paddingHorizontal: 40 }]}>
                Follow this account to see their photos and videos.
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: '#111' }]}>
                <Ionicons name="images-outline" size={32} color="#a1a1aa" />
              </View>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          )
        }
        renderItem={({ item: post }) => {
          if (post.settings?.is_job) {
            return <JobCard key={`${post.id}-${post.is_repost}-${post.is_liked_tab}`} post={post as PostType} isAdmin={user?.id === id} />
          }
          return <PostItem key={`${post.id}-${post.is_repost}-${post.is_liked_tab}`} post={post as PostType} />
        }}
      />

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

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text },

  infoArea: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  infoLeft: { flex: 1, paddingRight: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  fullName: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  username: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 8 },
  bio: { fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '500' },
  
  verifyBtnAdmin: {
    backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12
  },
  verifyBtnAdminText: {
    color: '#3b82f6', fontSize: 10, fontWeight: '700', letterSpacing: 0.5
  },
  
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.border },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: colors.textDim },

  followersRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 20,
  },
  followersText: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  dot: { color: '#d4d4d8' },
  websiteText: { fontSize: 14, color: colors.textDim, fontWeight: '600' },

  socialRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },

  ctaRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  btnFollow: {
    flex: 1, backgroundColor: colors.text, borderRadius: 10,
    height: 36, justifyContent: 'center', alignItems: 'center',
  },
  btnFollowing: { backgroundColor: colors.border, borderWidth: 1, borderColor: colors.border },
  btnFollowText: { fontSize: 14, fontWeight: '700', color: colors.background },
  btnOutline: {
    flex: 1, backgroundColor: colors.border, borderRadius: 10,
    height: 36, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 6,
  },
  btnOutlineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  shopBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#10b981',
    justifyContent: 'center', alignItems: 'center',
  },

  tabsScroll: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  tabBtnTextActive: { color: colors.text },

  empty: { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: colors.text, fontWeight: '700' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textDim, textAlign: 'center' },

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
