// app/(tabs)/index.tsx  ΓÇö Home Feed screen
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image, Alert,
  ScrollView, Animated, Dimensions, Platform
} from 'react-native'

const { width } = Dimensions.get('window')
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Video, ResizeMode } from 'expo-av'
import { useAuth } from '../../lib/auth'
import { StoryViewer } from '../../components/StoryViewer'
import { StoryCreator } from '../../components/StoryCreator'
import { Skeleton } from '../../components/Skeleton'
import { InFeedAd } from '../../components/InFeedAd'

type Tab = 'for_you' | 'following' | 'jobs'

type StoryGroup = { profile: any; stories: any[]; hasUnseen: boolean }

type Post = {
  id: string
  content: string
  image_urls?: string[]
  created_at: string
  creator_id: string
  likes_count?: number
  comments_count?: number
  reposts_count?: number
  is_liked?: boolean
  is_bookmarked?: boolean
  is_reposted?: boolean
  settings?: any
  profiles?: {
    id: string
    full_name: string
    username: string
    avatar_url?: string
    is_verified?: boolean
  }
  isAd?: boolean
}

type Story = {
  id: string
  creator_id: string
  image_url: string
  expires_at: string
  created_at: string
  profiles?: {
    id: string
    full_name: string
    username: string
    avatar_url?: string
  }
  hasUnseen?: boolean
}

// ΓöÇΓöÇ Stories / Highlights Bar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function StoriesBar({
  user, myProfile, onOpenViewer, onOpenCreator
}: {
  user: any; myProfile: any
  onOpenViewer: (groups: StoryGroup[], index: number) => void
  onOpenCreator: () => void
}) {
  const supabase = createClient()
  const [groups, setGroups] = useState<StoryGroup[]>([])

  const fetchStories = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select('id, creator_id, image_url, bg_color, text_content, expires_at, created_at, view_count, profiles:creator_id(id, full_name, username, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(60)

    if (!data) return

    let seenIds = new Set<string>()
    if (user) {
      const { data: views } = await supabase
        .from('story_views').select('story_id').eq('viewer_id', user.id)
      views?.forEach((v: any) => seenIds.add(v.story_id))
    }

    const map = new Map<string, any>()
    for (const s of data) {
      const cid = s.creator_id
      if (!map.has(cid)) map.set(cid, { profile: s.profiles, stories: [], hasUnseen: false })
      const g = map.get(cid)
      s.is_seen = seenIds.has(s.id)
      g.stories.push(s)
      if (!seenIds.has(s.id)) g.hasUnseen = true
    }

    const result = Array.from(map.values())
    if (user) result.sort((a, b) => (a.profile?.id === user.id ? -1 : b.profile?.id === user.id ? 1 : 0))
    setGroups(result)
  }, [user])

  useEffect(() => { fetchStories() }, [fetchStories])

  if (groups.length === 0 && !user) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.storiesBar}
      contentContainerStyle={styles.storiesContent}
    >
      {/* My story / Add story */}
      {user && (
        <TouchableOpacity
          style={styles.storyItem}
          activeOpacity={0.8}
          onPress={() => onOpenCreator()}
        >
          <View style={styles.myStoryRing}>
            {myProfile?.avatar_url ? (
              <Image source={{ uri: myProfile.avatar_url }} style={styles.storyAvatar} />
            ) : (
              <View style={[styles.storyAvatar, styles.storyAvatarFallback]}>
                <Text style={styles.storyAvatarText}>{myProfile?.full_name?.[0] || '+'}</Text>
              </View>
            )}
            <View style={styles.storyAddBadge}>
              <Ionicons name="add" size={10} color="#fff" />
            </View>
          </View>
          <Text style={styles.storyName} numberOfLines={1}>Your story</Text>
        </TouchableOpacity>
      )}

      {/* Other users */}
      {groups
        .filter(g => !user || g.profile?.id !== user.id)
        .map((group, i) => {
          const realIndex = user ? i + 1 : i
          return (
          <TouchableOpacity
            key={group.profile?.id}
            style={styles.storyItem}
            activeOpacity={0.8}
            onPress={() => onOpenViewer(groups, realIndex)}
          >
            <View style={[
              styles.storyRing,
              group.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen
            ]}>
              {group.profile?.avatar_url ? (
                <Image
                  source={{ uri: group.profile.avatar_url }}
                  style={[styles.storyAvatar, !group.hasUnseen && { opacity: 0.6 }]}
                />
              ) : (
                <View style={[styles.storyAvatar, styles.storyAvatarFallback]}>
                  <Text style={styles.storyAvatarText}>{group.profile?.full_name?.[0] || '?'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {group.profile?.full_name?.split(' ')[0] || group.profile?.username}
            </Text>
          </TouchableOpacity>
          )
        })
      }

      {groups.length === 0 && user && (
        <Text style={{ fontSize: 12, color: '#a1a1aa', paddingVertical: 8 }}>No stories yet. Be first!</Text>
      )}
    </ScrollView>
  )
}

// ΓöÇΓöÇ Jobs Card ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function JobCard({ post }: { post: Post }) {
  const s = post.settings || {}
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        {post.profiles?.avatar_url ? (
          <Image source={{ uri: post.profiles.avatar_url }} style={styles.jobAvatar} />
        ) : (
          <View style={[styles.jobAvatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle}>{s.job_title || 'Job Opportunity'}</Text>
          <Text style={styles.jobCompany}>{s.company_name || post.profiles?.full_name}</Text>
        </View>
        <View style={styles.jobTypeBadge}>
          <Text style={styles.jobTypeText}>{s.job_type || 'Full-time'}</Text>
        </View>
      </View>
      {s.location && <Text style={styles.jobMeta}>≡ƒôì {s.location}</Text>}
      {s.salary_range && <Text style={styles.jobMeta}>≡ƒÆ░ {s.salary_range}</Text>}
      {post.content && (
        <Text style={styles.jobDesc} numberOfLines={3}>{post.content}</Text>
      )}
      <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85}>
        <Text style={styles.applyBtnText}>Apply Now</Text>
      </TouchableOpacity>
    </View>
  )
}

// ΓöÇΓöÇ Main Screen ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export default function HomeScreen() {
  const { user } = useAuth()
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('for_you')
  const [myProfile, setMyProfile] = useState<any>(null)
  const underlineAnim = useRef(new Animated.Value(0)).current
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [storyViewer, setStoryViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null)
  const [showStoryCreator, setShowStoryCreator] = useState(false)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'for_you', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'jobs', label: 'Jobs' },
  ]

  // Load my profile for "What's on your mind" section
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('full_name, avatar_url, username')
      .eq('id', user.id).single()
      .then(({ data }) => setMyProfile(data))
      
    // Load cache
    AsyncStorage.getItem('home_feed_cache').then(cached => {
      if (cached) {
        try {
          setPosts(JSON.parse(cached))
          setLoading(false)
        } catch (e) {}
      }
    })
  }, [user])

  const fetchPosts = useCallback(async () => {
    if (posts.length === 0) {
      const cached = await AsyncStorage.getItem('home_feed_cache')
      if (cached) {
        try {
          setPosts(JSON.parse(cached))
          setLoading(false)
        } catch (e) {}
      } else {
        setLoading(true)
      }
    }

    if (activeTab === 'for_you') {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:creator_id(id, full_name, username, avatar_url, is_verified)')
        .or('settings->is_job.is.null,settings->is_job.eq.false')
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data && user) {
        const ids = data.map((p: any) => p.id)
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids)
        ])
        const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id))
        const bookmarkedSet = new Set((bookmarksRes.data || []).map((b: any) => b.post_id))
        const finalPosts = data.map((p: any) => ({
          ...p,
          is_liked: likedSet.has(p.id),
          is_bookmarked: bookmarkedSet.has(p.id)
        }))
        setPosts(finalPosts)
        AsyncStorage.setItem('home_feed_cache', JSON.stringify(finalPosts))
      } else if (!error && data) {
        setPosts(data)
        AsyncStorage.setItem('home_feed_cache', JSON.stringify(data))
      }
    }

    if (activeTab === 'following') {
      if (!user) { setPosts([]); setLoading(false); setRefreshing(false); return }
      const { data: followData } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id)
      const ids = followData?.map((f: any) => f.following_id) || []
      if (ids.length === 0) { setPosts([]); setLoading(false); setRefreshing(false); return }

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:creator_id(id, full_name, username, avatar_url, is_verified)')
        .in('creator_id', ids)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) setPosts(data)
    }

    if (activeTab === 'jobs') {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:creator_id(id, full_name, username, avatar_url)')
        .contains('settings', { is_job: true })
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) setPosts(data)
    }

    setLoading(false)
    setRefreshing(false)
  }, [user, activeTab])

  useFocusEffect(
    useCallback(() => {
      fetchPosts()
    }, [fetchPosts])
  )

  const switchTab = (tab: Tab, index: number) => {
    setActiveTab(tab)
    Animated.spring(underlineAnim, {
      toValue: index,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start()
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPosts()
  }, [fetchPosts])

  const toggleLike = async (post: Post) => {
    if (!user) return
    if (post.is_liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    }
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? { ...p, is_liked: !p.is_liked, likes_count: (p.likes_count || 0) + (p.is_liked ? -1 : 1) }
        : p
    ))
  }

  const toggleBookmark = async (post: Post) => {
    if (!user) return
    if (post.is_bookmarked) {
      await supabase.from('bookmarks').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('bookmarks').insert({ post_id: post.id, user_id: user.id })
    }
    setPosts(prev => prev.map(p =>
      p.id === post.id ? { ...p, is_bookmarked: !p.is_bookmarked } : p
    ))
  }

  const toggleRepost = async (post: Post) => {
    if (!user) return
    if (post.is_reposted) {
      await supabase.from('reposts').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('reposts').insert({ post_id: post.id, user_id: user.id })
    }
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? { ...p, is_reposted: !p.is_reposted, reposts_count: (p.reposts_count || 0) + (p.is_reposted ? -1 : 1) }
        : p
    ))
  }

  const timeAgo = (date: string) => {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`
    return `${Math.floor(secs / 86400)}d`
  }

  const feedData = useMemo(() => {
    if (loading) return []
    const data: Post[] = []
    posts.forEach((post, i) => {
      data.push(post)
      // Inject an ad every 4 posts (but not at the very end)
      if ((i + 1) % 4 === 0 && i !== posts.length - 1) {
        data.push({ id: `ad-${i}`, content: '', creator_id: '', created_at: '', isAd: true })
      }
    })
    return data
  }, [posts, loading])

  const renderItem = ({ item: post }: { item: Post }) => {
    if (post.isAd) return <InFeedAd />
    if (post.settings?.is_job) return <JobCard post={post} />

    const hasImage = post.image_urls && post.image_urls.length > 0
    return (
      <View style={styles.post}>
        <TouchableOpacity
          style={styles.postHeader}
          onPress={() => router.push(`/user-profile?id=${post.creator_id}`)}
          activeOpacity={0.7}
        >
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.postHeaderText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.fullName}>{post.profiles?.full_name}</Text>
              {post.profiles?.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color="#2563eb" />
              )}
            </View>
            <Text style={styles.username}>@{post.profiles?.username} ┬╖ {timeAgo(post.created_at)}</Text>
          </View>
          <TouchableOpacity style={{ padding: 4 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#a1a1aa" />
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.9}>
          {!!post.content && (
            <Text style={styles.postContent}>{post.content}</Text>
          )}
        </TouchableOpacity>

        {post.video_url && (
          <View style={{ marginBottom: 10 }}>
            <Video
              source={{ uri: post.video_url }}
              style={styles.postImage}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isLooping
            />
          </View>
        )}

        {hasImage && (
          <View>
            {post.image_urls!.length > 1 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {post.image_urls!.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.95}>
                    <Image
                      source={{ uri: url }}
                      style={[styles.postImage, { width: width - 32, marginBottom: 0 }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.95}>
                <Image
                  source={{ uri: post.image_urls![0] }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)} activeOpacity={0.7}>
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={22}
              color={post.is_liked ? '#ef4444' : '#71717a'}
            />
            {(post.likes_count || 0) > 0 && (
              <Text style={[styles.actionCount, post.is_liked && { color: '#ef4444' }]}>
                {post.likes_count}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={22} color="#71717a" />
            {(post.comments_count || 0) > 0 && (
              <Text style={styles.actionCount}>{post.comments_count}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => toggleRepost(post)}>
            <Ionicons
              name={post.is_reposted ? 'repeat' : 'repeat-outline'}
              size={22}
              color={post.is_reposted ? '#16a34a' : '#71717a'}
            />
            {(post.reposts_count || 0) > 0 && (
              <Text style={[styles.actionCount, post.is_reposted && { color: '#16a34a' }]}>
                {post.reposts_count}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleBookmark(post)} activeOpacity={0.7}>
            <Ionicons
              name={post.is_bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={post.is_bookmarked ? '#2563eb' : '#71717a'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
      </View>
    )
  }

  const ListHeader = () => (
    <>
      {/* Stories / Highlights */}
      <StoriesBar
        user={user}
        myProfile={myProfile}
        onOpenViewer={(groups, index) => setStoryViewer({ groups, index })}
        onOpenCreator={() => setShowStoryCreator(true)}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            activeOpacity={1}
            onPress={() => switchTab(tab.key, i)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* What's on your mind */}
      {user && (
        <TouchableOpacity
          style={styles.postPrompt}
          activeOpacity={0.8}
          onPress={() => router.push('/create-post')}
        >
          {myProfile?.avatar_url ? (
            <Image source={{ uri: myProfile.avatar_url }} style={styles.promptAvatar} />
          ) : (
            <View style={[styles.promptAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{myProfile?.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
          )}
          <View style={styles.promptInput}>
            <Text style={styles.promptText}>What's on your mind?</Text>
          </View>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={{ paddingHorizontal: 0 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.post, { paddingBottom: 24 }]}>
              {/* Header */}
              <View style={styles.postHeader}>
                <Skeleton width={42} height={42} borderRadius={21} />
                <View style={[styles.postHeaderText, { gap: 4, justifyContent: 'center', marginTop: 2 }]}>
                  <Skeleton width="40%" height={15} />
                  <Skeleton width="25%" height={13} />
                </View>
                <Skeleton width={20} height={20} />
              </View>
              {/* Text content */}
              <View style={{ gap: 6, marginBottom: 10 }}>
                <Skeleton width="90%" height={15} />
                <Skeleton width="60%" height={15} />
              </View>
              {/* Image */}
              <Skeleton width="100%" height={260} borderRadius={16} />
              {/* Action bar */}
              <View style={[styles.actions, { marginTop: 10 }]}>
                <Skeleton width={45} height={20} />
                <Skeleton width={45} height={20} />
                <Skeleton width={45} height={20} />
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  )

  const ListEmpty = () => {
    if (loading) return null
    if (activeTab === 'following') {
      return (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="person-add-outline" size={32} color="#a855f7" />
          </View>
          <Text style={styles.emptyText}>Follow people to see their posts</Text>
          <Text style={styles.emptySub}>When you follow someone, their posts appear here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/search')}>
            <Text style={styles.emptyBtnText}>Find people to follow</Text>
          </TouchableOpacity>
        </View>
      )
    }
    if (activeTab === 'jobs') {
      return (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="briefcase-outline" size={32} color="#2563eb" />
          </View>
          <Text style={styles.emptyText}>No jobs right now</Text>
          <Text style={styles.emptySub}>Check back later for new opportunities.</Text>
        </View>
      )
    }
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: '#f4f4f5' }]}>
          <Ionicons name="sparkles-outline" size={32} color="#a1a1aa" />
        </View>
        <Text style={styles.emptyText}>Nothing here yet</Text>
        <Text style={styles.emptySub}>Be the first to share something!</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Story Viewer */}
      {storyViewer && (
        <StoryViewer
          groups={storyViewer.groups}
          startGroupIndex={storyViewer.index}
          onClose={() => setStoryViewer(null)}
          onViewed={() => setStoryViewer(null)}
        />
      )}

      {/* Story Creator */}
      {showStoryCreator && (
        <StoryCreator
          onClose={() => setShowStoryCreator(false)}
          onCreated={() => { setShowStoryCreator(false) }}
        />
      )}

      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>JPM</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : feedData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        initialNumToRender={5}
        windowSize={5}
        maxToRenderPerBatch={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-post')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
  },
  headerLogo: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: '#000' },

  // ΓöÇΓöÇ Stories ΓöÇΓöÇ
  storiesBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  storiesContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 14, flexDirection: 'row' },
  storyItem: { alignItems: 'center', gap: 5, width: 64 },
  storyRing: { width: 62, height: 62, borderRadius: 31, padding: 2.5, justifyContent: 'center', alignItems: 'center' },
  storyRingUnseen: { backgroundColor: '#ec4899' },
  storyRingSeen: { backgroundColor: '#e4e4e7' },
  myStoryRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  storyAvatar: { width: 54, height: 54, borderRadius: 27 },
  storyAvatarFallback: { backgroundColor: '#e4e4e7', justifyContent: 'center', alignItems: 'center' },
  storyAvatarText: { fontSize: 20, fontWeight: '700', color: '#71717a' },
  storyAddBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  storyName: { fontSize: 10, fontWeight: '600', color: '#52525b', textAlign: 'center', width: 62 },

  // ΓöÇΓöÇ Tabs ΓöÇΓöÇ
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
    backgroundColor: '#fff',
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabLabel: { fontSize: 15, fontWeight: '700', color: '#a1a1aa' },
  tabLabelActive: { color: '#111' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: '50%',
    width: 40, height: 2, backgroundColor: '#111',
    marginLeft: -20, borderRadius: 2,
  },

  // ΓöÇΓöÇ Post Prompt ΓöÇΓöÇ
  postPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
    backgroundColor: '#fff',
  },
  promptAvatar: { width: 40, height: 40, borderRadius: 20 },
  promptInput: {
    flex: 1, backgroundColor: '#f4f4f5', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  promptText: { fontSize: 14, color: '#71717a', fontWeight: '500' },

  // ΓöÇΓöÇ Post ΓöÇΓöÇ
  post: { paddingHorizontal: 16, paddingTop: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: '#e4e4e7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#71717a' },
  postHeaderText: { flex: 1 },
  fullName: { fontSize: 15, fontWeight: '700', color: '#000' },
  username: { fontSize: 13, color: '#71717a', marginTop: 1 },
  postContent: { fontSize: 15, lineHeight: 22, color: '#111', marginBottom: 10 },
  postImage: { width: '100%', height: 260, borderRadius: 16, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 20, paddingBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 14, color: '#71717a', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f4f4f5' },

  // ΓöÇΓöÇ Jobs ΓöÇΓöÇ
  jobCard: {
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: '#f8fafc', borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  jobHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  jobAvatar: { width: 44, height: 44, borderRadius: 12 },
  jobTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  jobCompany: { fontSize: 13, color: '#64748b', marginTop: 2 },
  jobTypeBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  jobTypeText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  jobMeta: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  jobDesc: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 8 },
  applyBtn: {
    marginTop: 14, backgroundColor: '#000', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ΓöÇΓöÇ Empty states ΓöÇΓöÇ
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyText: { fontSize: 18, color: '#111', fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#71717a', textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ΓöÇΓöÇ FAB ΓöÇΓöÇ
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  }
})
