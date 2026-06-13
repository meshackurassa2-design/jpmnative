import { getCdnUrl } from '../../lib/cdn';
// app/(tabs)/index.tsx  — Home Feed screen
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image, Alert,
  ScrollView, Animated, Dimensions, Platform, InteractionManager, useWindowDimensions
} from 'react-native'

const { width } = Dimensions.get('window')
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Video, ResizeMode } from 'expo-av'
import { useAuth } from '../../lib/auth'
import { StoryViewer } from '../../components/StoryViewer'
import { StoryCreator } from '../../components/StoryCreator'
import { Skeleton } from '../../components/Skeleton'
import { JobCard } from '../../components/JobCard'
import { PostItem } from '../../components/PostItem'
import { VibeBadge } from '../../components/VibeBadge'
import { useTheme } from '../../lib/theme';
import { useUI } from '../../lib/ui'
import { BlurView } from 'expo-blur'
import * as StoreReview from 'expo-store-review'

type Tab = 'for_you' | 'following' | 'tea'

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
  is_ghost?: boolean
  settings?: any
  profiles?: {
    id: string
    full_name: string
    username: string
    avatar_url?: string
    is_verified?: boolean
    settings?: any
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

// ── Stories / Highlights Bar ─────────────────────────────────────────────────
function StoriesBar({
  user, myProfile, onOpenViewer, onOpenCreator
}: {
  user: any; myProfile: any
  onOpenViewer: (groups: StoryGroup[], index: number) => void
  onOpenCreator: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()
  const [groups, setGroups] = useState<StoryGroup[]>([])

  const fetchStories = useCallback(async () => {
    let query = supabase
      .from('stories')
      .select('id, creator_id, image_url, bg_color, text_content, expires_at, created_at, view_count, profiles:creator_id(id, full_name, username, avatar_url, settings)')
      .gt('expires_at', new Date().toISOString())

    if (user) {
      // Get list of people the user follows
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      
      const followingIds = follows ? follows.map(f => f.following_id) : []
      followingIds.push(user.id) // Always include user's own stories
      
      if (followingIds.length > 0) {
        query = query.in('creator_id', followingIds)
      }
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(60)

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
    <View style={styles.storiesBar}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContent}
        data={user ? [{ isMyStory: true }, ...groups.filter(g => g.profile?.id !== user.id)] : groups}
        keyExtractor={(item, idx) => item.isMyStory ? 'my-story' : (item.profile?.id || idx.toString())}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        renderItem={({ item, index }) => {
          if (item.isMyStory) {
            const myGroup = groups.find(g => g.profile?.id === user?.id);
            const hasMyStory = myGroup && myGroup.stories.length > 0;

            return (
              <TouchableOpacity
                style={styles.storyItem}
                activeOpacity={0.8}
                onPress={() => {
                  if (hasMyStory) {
                    onOpenViewer(groups, 0); // User group is always at index 0
                  } else {
                    onOpenCreator();
                  }
                }}
              >
                <View style={hasMyStory ? [styles.storyRing, myGroup.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen] : styles.myStoryRing}>
                  {myProfile?.avatar_url ? (
                    <Image source={{ uri: getCdnUrl(myProfile.avatar_url) }} style={[styles.storyAvatar, hasMyStory && !myGroup.hasUnseen && { opacity: 0.6 }]} />
                  ) : (
                    <View style={[styles.storyAvatar, styles.storyAvatarFallback]}>
                      <Text style={styles.storyAvatarText}>{myProfile?.full_name?.[0] || '+'}</Text>
                    </View>
                  )}
                  {!hasMyStory && (
                    <View style={styles.storyAddBadge}>
                      <Ionicons name="add" size={10} color="#fff" />
                    </View>
                  )}
                  <VibeBadge vibe={myProfile?.settings?.vibe} size={14} style={{ position: 'absolute', bottom: -2, right: -2 }} />
                </View>
                <Text style={styles.storyName} numberOfLines={1}>Your story</Text>
              </TouchableOpacity>
            )
          }

          const group = item;
          return (
            <TouchableOpacity
              style={styles.storyItem}
              activeOpacity={0.8}
              onPress={() => onOpenViewer(groups, index)}
            >
              <View style={[
                styles.storyRing,
                group.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen
              ]}>
                {group.profile?.avatar_url ? (
                  <Image
                    source={{ uri: getCdnUrl(group.profile.avatar_url) }}
                    style={[styles.storyAvatar, !group.hasUnseen && { opacity: 0.6 }]}
                  />
                ) : (
                  <View style={[styles.storyAvatar, styles.storyAvatarFallback]}>
                    <Text style={styles.storyAvatarText}>{group.profile?.full_name?.[0] || '?'}</Text>
                  </View>
                )}
                <VibeBadge vibe={group.profile?.settings?.vibe} size={14} style={{ position: 'absolute', bottom: -2, right: -2 }} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {group.profile?.full_name?.split(' ')[0] || group.profile?.username}
              </Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          groups.length === 0 && user ? (
            <Text style={{ fontSize: 12, color: colors.textDim, paddingVertical: 8, paddingHorizontal: 16 }}>No stories yet. Be first!</Text>
          ) : null
        }
      />
    </View>
  )
}

// ── Jobs Card ───────────────────────────────────────────────────────────────


// ── Direct Ad Card ─────────────────────────────────────────────────────────
function DirectAdCard({ ad, isAdmin, onDelete }: { ad: any, isAdmin?: boolean, onDelete?: () => void }) {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  return (
    <View style={styles.adContainer}>
      <View style={styles.adHeader}>
        <View style={[styles.adIcon, { backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="megaphone" size={18} color={colors.primary} />
        </View>
        <View style={styles.adHeaderText}>
          <Text style={styles.adAdvertiser}>{ad.title}</Text>
          <Text style={styles.adSponsored}>Sponsored</Text>
        </View>
        {isAdmin && onDelete && (
          <TouchableOpacity onPress={onDelete} style={{ padding: 8 }}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.adMediaContainer}>
        {ad.image_url ? (
          <Image source={{ uri: getCdnUrl(ad.image_url) }} style={styles.adMedia} resizeMode="cover" />
        ) : (
          <View style={[styles.adMedia, { backgroundColor: colors.border }]} />
        )}
      </View>

      <View style={styles.adFooter}>
        <Text style={styles.adHeadline} numberOfLines={1}>{ad.title}</Text>
        <Text style={styles.adBody} numberOfLines={2}>{ad.description}</Text>
        
        <TouchableOpacity style={styles.adCta} activeOpacity={0.85}>
          <Text style={styles.adCtaText}>LEARN MORE</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Daily Verse Card ─────────────────────────────────────────────────────────
function DailyVerseCard() {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()
  const [verse, setVerse] = useState<any>(null)
  const [sourceFilter, setSourceFilter] = useState<'zote' | 'biblia' | 'kurani'>('zote')
  const [loading, setLoading] = useState(true)

  const fetchVerse = useCallback(async () => {
    setLoading(true)
    const p_source = sourceFilter === 'zote' ? null : sourceFilter
    const { data, error } = await supabase.rpc('get_daily_verse', { p_source })
    if (!error && data && data.length > 0) {
      setVerse(data[0])
    }
    setLoading(false)
  }, [sourceFilter])

  useEffect(() => {
    fetchVerse()
  }, [fetchVerse])

  if (!verse && !loading) return null;

  return (
    <View style={styles.verseCard}>
      <View style={styles.verseHeader}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['zote', 'biblia', 'kurani'] as const).map(f => (
            <TouchableOpacity 
              key={f} 
              onPress={() => setSourceFilter(f)}
              style={[
                styles.verseFilterBtn, 
                sourceFilter === f && styles.verseFilterBtnActive
              ]}
            >
              <Text style={[
                styles.verseFilterText,
                sourceFilter === f && styles.verseFilterTextActive
              ]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={fetchVerse} disabled={loading} style={styles.verseRefresh}>
          {loading ? <ActivityIndicator size="small" color="#a1a1aa" /> : <Ionicons name="refresh" size={18} color="#a1a1aa" />}
        </TouchableOpacity>
      </View>

      <View style={{ paddingVertical: 12, alignItems: 'center' }}>
        {verse && (
          <>
            <View style={[styles.verseBadge, verse.source === 'kurani' ? { backgroundColor: '#166534', borderColor: '#14532d' } : { backgroundColor: '#3f3f46', borderColor: '#52525b' }]}>
              <Text style={styles.verseBadgeText}>{verse.source === 'biblia' ? 'Biblia' : 'Kurani'}</Text>
            </View>
            <Text style={styles.verseText}>"{verse.text}"</Text>
            <Text style={styles.verseRef}>— {verse.reference}</Text>
          </>
        )}
      </View>
    </View>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { setTabBarVisible, showActionSheet, showToast } = useUI()
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [directAds, setDirectAds] = useState<any[]>([])
  const isFocused = useIsFocused()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('for_you')
  const [myProfile, setMyProfile] = useState<any>(null)
  const underlineAnim = useRef(new Animated.Value(0)).current
  const fabAnim = useRef(new Animated.Value(1)).current
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [storyViewer, setStoryViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null)
  const [showStoryCreator, setShowStoryCreator] = useState(false)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())

  const submitReport = async (post: any, reason: string) => {
    if (!user || !post) return
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id, post_id: post.id, reason
    })
    if (!error) showToast('Post reported for review.', 'success')
    else showToast('Could not submit report.', 'error')
  }

  const handlePostOptions = (post: any) => {
    if (!user || !post) return
    if (user.id === post.creator_id) return
    showActionSheet('Post Options', [
      { text: 'Report Post', style: 'destructive', icon: 'flag', onPress: () => {
        setTimeout(() => {
          showActionSheet('Why are you reporting this post?', [
            { text: 'It is spam', onPress: () => submitReport(post, 'Spam') },
            { text: 'Hate speech or symbols', onPress: () => submitReport(post, 'Hate speech') },
            { text: 'Nudity or sexual activity', onPress: () => submitReport(post, 'Nudity') },
            { text: 'Bullying or harassment', onPress: () => submitReport(post, 'Harassment') },
            { text: 'Cancel', style: 'cancel', onPress: () => {} }
          ])
        }, 400)
      }},
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const lastScrollY = useRef(0)
  
  const handleScroll = (e: any) => {
    const currentY = e.nativeEvent.contentOffset.y
    
    if (currentY <= 0) {
      setTabBarVisible(true)
      Animated.timing(fabAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    } else if (currentY > lastScrollY.current + 10) {
      // scrolling down
      setTabBarVisible(false)
      Animated.timing(fabAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start()
    } else if (currentY < lastScrollY.current - 10) {
      // scrolling up
      setTabBarVisible(true)
      Animated.timing(fabAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    }
    lastScrollY.current = currentY
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const visible = new Set<string>()
    viewableItems.forEach((v: any) => visible.add(v.item.id))
    setVisibleItems(visible)
  }).current

  const TABS: { key: Tab; label: string }[] = [
    { key: 'for_you', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'tea', label: 'Whispers' },
  ]

  // Load my profile for "What's on your mind" section
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('full_name, avatar_url, username, is_admin, settings')
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
      if (activeTab === 'for_you') {
        const cached = await AsyncStorage.getItem('home_feed_cache')
        if (cached) {
          try {
            setPosts(JSON.parse(cached))
            setLoading(false)
          } catch (e) {}
        } else {
          setLoading(true)
        }
      } else {
        setLoading(true)
      }
    }

    const resolveAndSetPosts = async (postsToResolve: any[]) => {
      const coAuthorIds = [...new Set(postsToResolve.map(p => p.settings?.co_author_id).filter(Boolean))] as string[];
      if (coAuthorIds.length > 0) {
        const { data: coAuthors } = await supabase.from('profiles').select('id, full_name, username, avatar_url, is_verified').in('id', coAuthorIds);
        if (coAuthors) {
          const coAuthorMap = new Map(coAuthors.map((c: any) => [c.id, c]));
          postsToResolve.forEach(p => {
            if (p.settings?.co_author_id) {
              p.co_author_profile = coAuthorMap.get(p.settings.co_author_id);
            }
          });
        }
      }
      setPosts(postsToResolve);
      return postsToResolve;
    }

    if (activeTab === 'for_you') {
      const [postsRes, adsRes] = await Promise.all([
        supabase
          .from('posts')
          .select('*, profiles:creator_id(id, full_name, username, avatar_url, is_verified, settings), likes(count), comments(count)')
          .or('settings->is_job.is.null,settings->is_job.eq.false')
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('direct_ads').select('*').order('created_at', { ascending: false }).limit(10)
      ])

      if (adsRes.data) setDirectAds(adsRes.data)
      const { data, error } = postsRes

      if (!error && data) {
        // Filter out news posts
        const nonNewsData = data.filter((p: any) => p.profiles?.settings?.account_type !== 'news');

        // Algorithmic Sorting: (Likes * 1) + (Comments * 13)
        const scoredPosts = nonNewsData.map((p: any) => {
          const likesCount = p.likes?.[0]?.count || 0;
          const commentsCount = p.comments?.[0]?.count || 0;
          const score = (likesCount * 1) + (commentsCount * 13);
          return { ...p, score };
        });
        
        scoredPosts.sort((a, b) => b.score - a.score);
        const topPosts = scoredPosts.slice(0, 30);
        
        if (user) {
          const ids = topPosts.map((p: any) => p.id)
          const [likesRes, bookmarksRes] = await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
            supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids)
          ])
          const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id))
          const bookmarkedSet = new Set((bookmarksRes.data || []).map((b: any) => b.post_id))
          const finalPosts = topPosts.map((p: any) => ({
            ...p,
            is_liked: likedSet.has(p.id),
            is_bookmarked: bookmarkedSet.has(p.id)
          }))
          await resolveAndSetPosts(finalPosts)
          AsyncStorage.setItem('home_feed_cache', JSON.stringify(finalPosts.slice(0, 15)))
        } else {
          await resolveAndSetPosts(topPosts)
          AsyncStorage.setItem('home_feed_cache', JSON.stringify(topPosts.slice(0, 15)))
        }
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
        .select('*, profiles:creator_id(id, full_name, username, avatar_url, is_verified, settings)')
        .in('creator_id', ids)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        const nonNewsData = data.filter((p: any) => p.profiles?.settings?.account_type !== 'news');
        await resolveAndSetPosts(nonNewsData)
      }
    }

    if (activeTab === 'tea') {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:creator_id(id, full_name, username, avatar_url, is_verified, settings)')
        .eq('settings->is_anonymous', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        // Shuffle or add some random delay if needed, but for now chronological is fine
        await resolveAndSetPosts(data)
      }
    }

    setLoading(false)
    setRefreshing(false)
  }, [user, activeTab])

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') {
        fetchPosts()
        return
      }
      const task = InteractionManager.runAfterInteractions(() => {
        fetchPosts()
      })
      return () => task.cancel()
    }, [fetchPosts])
  )

  const switchTab = (tab: Tab, index: number) => {
    if (tab === activeTab) return
    setPosts([])
    setLoading(true)
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
    const data: any[] = []
    let directAdIndex = 0

    posts.forEach((post, i) => {
      data.push(post)
      
      // Inject Daily Verse Card every 100 posts
      if ((i + 1) % 100 === 0) {
        data.push({ id: `daily-verse-card-${i}`, isVerseCard: true })
      }
      
      // Inject Direct Ads every 3 posts
      if ((i + 1) % 3 === 0 && directAds.length > 0) {
        data.push({ ...directAds[directAdIndex % directAds.length], isDirectAd: true })
        directAdIndex++
      } 
    })
    return data
  }, [posts, directAds, loading])

  const handleDeleteJob = (id: string) => {
    Alert.alert('Delete Job', 'Are you sure you want to permanently delete this job posting?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('posts').delete().eq('id', id)
        setPosts(prev => prev.filter(p => p.id !== id))
      }}
    ])
  }

  const handleDeleteDirectAd = (id: string) => {
    Alert.alert('Delete Ad', 'Are you sure you want to permanently delete this direct ad?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('direct_ads').delete().eq('id', id)
        setDirectAds(prev => prev.filter(a => a.id !== id))
      }}
    ])
  }

  const renderItem = ({ item }: { item: any }) => {
    if (item.isVerseCard) return <DailyVerseCard />

    if (item.isDirectAd) return <DirectAdCard ad={item} isAdmin={myProfile?.is_admin} onDelete={() => handleDeleteDirectAd(item.id)} />
    if (item.settings?.is_job) return <JobCard post={item} isAdmin={myProfile?.is_admin} onDelete={() => handleDeleteJob(item.id)} />

    const post = item as Post

    const hasImage = post.image_urls && post.image_urls.length > 0
    return (
      <View style={styles.post}>
        <TouchableOpacity
          style={styles.postHeader}
          onPress={() => router.push(`/user-profile?id=${post.creator_id}`)}
          activeOpacity={0.7}
        >
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={[styles.avatar, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]}>
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
            <Text style={styles.username}>
              @{post.profiles?.username} · {timeAgo(post.created_at)}
              {post.is_ghost && <Text style={{ color: '#f59e0b' }}>  👻 24h</Text>}
            </Text>
          </View>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => handlePostOptions(post)}>
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
              source={{ uri: getCdnUrl(post.video_url) }}
              style={styles.postImage}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isLooping
              shouldPlay={isFocused && visibleItems.has(post.id)}
            />
          </View>
        )}

        {hasImage && (
          <View>
            {post.image_urls!.length > 1 ? (
              <ScrollView 
                horizontal 
                pagingEnabled 
                snapToInterval={feedWidth}
                snapToAlignment="center"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false} 
                style={{ marginBottom: 10 }}
              >
                {post.image_urls!.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.95} style={{ width: feedWidth }}>
                    <Image
                      source={{ uri: getCdnUrl(url) }}
                      style={[styles.postImage, { marginBottom: 0 }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.95}>
                <Image
                  source={{ uri: getCdnUrl(post.image_urls![0]) }}
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

  const listHeader = (
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
          <View style={{ position: 'relative' }}>
            {myProfile?.avatar_url ? (
              <Image source={{ uri: getCdnUrl(myProfile.avatar_url) }} style={styles.promptAvatar} />
            ) : (
              <View style={[styles.promptAvatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{myProfile?.full_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
            )}
            <VibeBadge vibe={myProfile?.settings?.vibe} size={14} style={{ position: 'absolute', bottom: 0, right: -2 }} />
          </View>
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
              <View style={[styles.postHeader, { paddingHorizontal: 16 }]}>
                <Skeleton width={42} height={42} borderRadius={21} />
                <View style={[styles.postHeaderText, { gap: 4, justifyContent: 'center', marginTop: 2 }]}>
                  <Skeleton width="40%" height={15} />
                  <Skeleton width="25%" height={13} />
                </View>
                <Skeleton width={20} height={20} />
              </View>
              {/* Text content */}
              <View style={{ gap: 6, marginBottom: 10, paddingHorizontal: 16 }}>
                <Skeleton width="90%" height={15} />
                <Skeleton width="60%" height={15} />
              </View>
              {/* Image */}
              <Skeleton width={feedWidth} height={feedWidth * 1.1} />
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
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={32} color="#a1a1aa" />
        </View>
        <Text style={styles.emptyText}>Nothing here yet</Text>
        <Text style={styles.emptySub}>Be the first to share something!</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Story Viewer - always mounted to prevent home re-render flicker */}
      <StoryViewer
        groups={storyViewer?.groups ?? []}
        startGroupIndex={storyViewer?.index ?? 0}
        visible={!!storyViewer}
        onClose={() => setStoryViewer(null)}
        onViewed={() => setStoryViewer(null)}
      />

      {/* Story Creator */}
      {showStoryCreator && (
        <StoryCreator
          onClose={() => setShowStoryCreator(false)}
          onCreated={() => { setShowStoryCreator(false) }}
        />
      )}

      {storyViewer && (
        <StoryViewer
          groups={storyViewer.groups}
          initialIndex={storyViewer.index}
          onClose={() => setStoryViewer(null)}
          onRefresh={() => { /* Can trigger a fetchStories if needed */ }}
        />
      )}

      {/* Top Header */}
      <View style={styles.header}>
        <Text style={[styles.headerLogo, { color: colors.text }]}>JPM</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : feedData}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyExtractor={(item, index) => item.isDirectAd ? `directad-${item.id}-${index}` : item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        initialNumToRender={5}
        windowSize={5}
        maxToRenderPerBatch={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      />

      {/* Floating Action Button */}
      <Animated.View style={[
        styles.fabWrapper,
        { opacity: fabAnim }
      ]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/create-post')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLogo: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: colors.primary },

  // ── Stories ──
  storiesBar: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  storiesContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 14, flexDirection: 'row' },
  storyItem: { alignItems: 'center', gap: 5, width: 64 },
  storyRing: { width: 62, height: 62, borderRadius: 31, padding: 2.5, justifyContent: 'center', alignItems: 'center' },
  storyRingUnseen: { backgroundColor: '#ec4899' },
  storyRingSeen: { backgroundColor: colors.border },
  myStoryRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  storyAvatar: { width: 54, height: 54, borderRadius: 27 },
  storyAvatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  storyAvatarText: { fontSize: 20, fontWeight: '700', color: colors.textDim },
  storyAddBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  storyName: { fontSize: 10, fontWeight: '600', color: colors.textDim, textAlign: 'center', width: 62 },

  // ── Tabs ──
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabLabel: { fontSize: 15, fontWeight: '700', color: colors.textDim },
  tabLabelActive: { color: colors.text },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: '50%',
    width: 40, height: 2, backgroundColor: colors.text,
    marginLeft: -20, borderRadius: 2,
  },

  // ── Post Prompt ──
  postPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  promptAvatar: { width: 40, height: 40, borderRadius: 20 },
  promptInput: {
    flex: 1, backgroundColor: colors.border, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  promptText: { fontSize: 14, color: colors.textDim, fontWeight: '500' },

  // ── Post ──
  post: { paddingTop: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 16 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: '#e4e4e7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.textDim },
  postHeaderText: { flex: 1 },
  fullName: { fontSize: 15, fontWeight: '700', color: colors.text },
  username: { fontSize: 13, color: colors.textDim, marginTop: 1 },
  postContent: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 10, paddingHorizontal: 16 },
  postImage: { width: '100%', aspectRatio: 1 / 1.1, marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },

  // ── Native Ad Styled Elements (Direct Ads) ──
  adContainer: {
    backgroundColor: colors.background, marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  adHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  adIcon: { width: 38, height: 38, borderRadius: 19, marginRight: 12, backgroundColor: colors.border },
  adHeaderText: { flex: 1, justifyContent: 'center' },
  adAdvertiser: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  adSponsored: { fontSize: 12, color: colors.textDim },
  adMediaContainer: { width: '100%', aspectRatio: 1, backgroundColor: colors.border },
  adMedia: { flex: 1, width: '100%', height: '100%' },
  adFooter: { padding: 14 },
  adHeadline: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  adBody: { fontSize: 14, color: colors.textDim, marginBottom: 16, lineHeight: 20 },
  adCta: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  adCtaText: { color: '#ffffff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // ── Empty states ──
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyText: { fontSize: 18, color: colors.text, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, backgroundColor: colors.text, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  emptyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  verseCard: {
    marginBottom: 16,
    backgroundColor: '#18181b',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  verseFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#27272a',
  },
  verseFilterBtnActive: {
    backgroundColor: '#fff',
  },
  verseFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
  },
  verseFilterTextActive: {
    color: '#000',
  },
  verseRefresh: {
    padding: 6,
    backgroundColor: '#27272a',
    borderRadius: 12,
  },
  verseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  verseBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  verseText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  verseRef: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '500',
  },

  // ── FAB ──
  fabWrapper: {
    position: 'absolute', bottom: 100, right: 24,
    width: 64, height: 64,
    zIndex: 100,
  },
  fab: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  }
})
