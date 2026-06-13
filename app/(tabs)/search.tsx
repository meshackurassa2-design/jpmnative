import { getCdnUrl } from '../../lib/cdn';
// app/(tabs)/search.tsx
import { useTheme } from '../../lib/theme';
import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator, Dimensions, Platform, useWindowDimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { Skeleton } from '../../components/Skeleton'
import { PostItem } from '../../components/PostItem'
import { JobCard } from '../../components/JobCard'
import { VibeBadge } from '../../components/VibeBadge'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width;
  const gridItemSize = feedWidth / 3;
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [postResults, setPostResults] = useState<any[]>([])
  const [explorePosts, setExplorePosts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const [exploreLoading, setExploreLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'Explore' | 'News' | 'Jobs'>('Explore')
  const [newsPosts, setNewsPosts] = useState<any[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [jobsPosts, setJobsPosts] = useState<any[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchExplore()
    fetchNews()
    fetchJobs()
  }, [])

  const fetchExplore = async () => {
    setExploreLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('id, image_urls, video_url, likes(count), comments(count)')
      .or('image_urls.not.is.null,video_url.not.is.null')
      .or('settings->is_job.is.null,settings->is_job.eq.false')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) console.error('Explore fetch error:', error)
    
    if (data) {
      const scoredPosts = data.map((p: any) => {
        const likesCount = p.likes?.[0]?.count || 0;
        const commentsCount = p.comments?.[0]?.count || 0;
        const score = (likesCount * 2) + (commentsCount * 3);
        return { ...p, score };
      });
      
      const validPosts = scoredPosts.filter(p => p.video_url || (p.image_urls && p.image_urls.length > 0));
      validPosts.sort((a, b) => b.score - a.score);
      
      setExplorePosts(validPosts.slice(0, 30));
    }
    setExploreLoading(false)
  }

  const fetchNews = async () => {
    setNewsLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, image_urls, video_url, created_at, creator_id, parent_id, settings, is_ghost, profiles:creator_id!inner(id, full_name, username, avatar_url, is_verified, settings), likes(count), comments(count)')
      .eq('profiles.settings->>account_type', 'news')
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (error) console.error('News fetch error:', error)
    if (data) setNewsPosts(data)
    setNewsLoading(false)
  }

  const fetchJobs = async () => {
    setJobsLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, image_urls, video_url, created_at, creator_id, parent_id, settings, profiles:creator_id(id, full_name, username, avatar_url)')
      .contains('settings', { is_job: true })
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (error) console.error('Jobs fetch error:', error)
    if (data) setJobsPosts(data)
    setJobsLoading(false)
  }

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { 
      setResults([]); 
      setPostResults([]);
      return 
    }
    
    setLoading(true)
    
    if (q.startsWith('#')) {
      // Hashtag search -> search posts
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_urls, video_url, created_at, creator_id, parent_id, settings, profiles:creator_id(id, full_name, username, avatar_url, is_verified), likes(count), comments(count)')
        .ilike('content', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) console.error('Hashtag search error:', error)
      setPostResults(data || [])
      setResults([])
    } else {
      // People search
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_verified, bio, settings')
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20)
      
      if (error) console.error('Search error:', error)
      setResults(data || [])
      setPostResults([])
    }
    
    setLoading(false)
  }, [])

  const renderExploreItem = ({ item }: { item: any }) => {
    const hasImage = item.image_urls && item.image_urls.length > 0;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/post/${item.id}`)}
        style={{ width: gridItemSize, height: gridItemSize, padding: 1, position: 'relative' }}
      >
        {hasImage ? (
          <Image
            source={{ uri: getCdnUrl(item.image_urls[0]) }}
            style={{ flex: 1, backgroundColor: colors.border }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="play" size={32} color="#fff" />
          </View>
        )}
        {item.video_url && (
          <View style={{ position: 'absolute', top: 8, right: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.5, shadowRadius: 2, elevation: 3 }}>
            <Ionicons name="play" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const renderSearchItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/user-profile?id=${item.id}`)}
    >
      <View style={{ position: 'relative' }}>
        {item.avatar_url ? (
          <Image source={{ uri: getCdnUrl(item.avatar_url) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{item.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <VibeBadge vibe={item.settings?.vibe} size={14} style={{ position: 'absolute', bottom: 0, right: -2 }} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.name}>{item.full_name}</Text>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={14} color="#2563eb" />
          )}
        </View>
        <Text style={styles.username}>@{item.username}</Text>
        {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'Explore' && styles.tabActive]} onPress={() => setActiveTab('Explore')}>
          <Text style={[styles.tabText, activeTab === 'Explore' && styles.tabTextActive]}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'News' && styles.tabActive]} onPress={() => setActiveTab('News')}>
          <Text style={[styles.tabText, activeTab === 'News' && styles.tabTextActive]}>News 📰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'Jobs' && styles.tabActive]} onPress={() => setActiveTab('Jobs')}>
          <Text style={[styles.tabText, activeTab === 'Jobs' && styles.tabTextActive]}>Jobs 💼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#a1a1aa" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="Search people or #hashtags..."
          placeholderTextColor="#a1a1aa"
          value={query}
          onChangeText={search}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]) }}>
            <Ionicons name="close-circle" size={18} color="#a1a1aa" />
          </TouchableOpacity>
        )}
      </View>

      {query.length === 0 ? (
        activeTab === 'Explore' ? (
          // Explore Grid
          exploreLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.text} />
            </View>
          ) : (
            <FlatList
              key="explore-grid"
              data={explorePosts}
              keyExtractor={item => item.id}
              numColumns={3}
              renderItem={renderExploreItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )
        ) : activeTab === 'News' ? (
          // News Feed
          newsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.text} />
            </View>
          ) : (
            <FlatList
              key="news-feed"
              data={newsPosts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <PostItem post={item} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No news articles found.</Text>
                </View>
              }
            />
          )
        ) : (
          // Jobs Feed
          jobsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.text} />
            </View>
          ) : (
            <FlatList
              key="jobs-feed"
              data={jobsPosts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <JobCard post={item} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={[styles.emptyIcon, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="briefcase-outline" size={32} color="#2563eb" />
                  </View>
                  <Text style={[styles.emptyText, { marginTop: 12 }]}>No jobs right now</Text>
                </View>
              }
            />
          )
        )
      ) : (
        // Search Results
        <>
          {loading && (
            <View style={{ paddingTop: 12 }}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={styles.row}>
                  <Skeleton width={50} height={50} borderRadius={25} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="50%" height={15} />
                    <Skeleton width="30%" height={13} />
                  </View>
                </View>
              ))}
            </View>
          )}
          {query.startsWith('#') ? (
            <FlatList
              key="hashtag-list"
              data={postResults}
              keyExtractor={item => item.id}
              numColumns={3}
              renderItem={renderExploreItem}
              ListEmptyComponent={
                query.length >= 2 && !loading ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No posts found for "{query}"</Text>
                  </View>
                ) : null
              }
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          ) : (
            <FlatList
              key="search-list"
              data={results}
              keyExtractor={item => item.id}
              renderItem={renderSearchItem}
              ListEmptyComponent={
                query.length >= 2 && !loading ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No results for "{query}"</Text>
                  </View>
                ) : null
              }
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  tabsRow: { 
    flexDirection: 'row', 
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: colors.border,
    borderRadius: 20,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 16 },
  tabActive: { backgroundColor: colors.background, shadowColor: colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: colors.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 16, color: colors.text },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.textDim },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  username: { fontSize: 13, color: colors.textDim },
  bio: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 15 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
})
