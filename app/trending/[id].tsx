import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { createClient } from '../../lib/supabase';
import { PostItem } from '../../components/PostItem';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrendingDetailScreen() {
  const { id, category } = useLocalSearchParams();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient();
  
  const [topicPost, setTopicPost] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Top' | 'Latest'>('Top');

  useEffect(() => {
    fetchTopicData();
  }, [id, activeTab]);

  const fetchTopicData = async () => {
    setLoading(true);
    const { data: mainPost } = await supabase
      .from('posts')
      .select('content')
      .eq('id', id)
      .single();
      
    if (mainPost) setTopicPost(mainPost);

    // Build the query
    let query = supabase
      .from('posts')
      .select('id, content, image_urls, video_url, created_at, creator_id, parent_id, settings, profiles:creator_id(id, full_name, username, avatar_url, is_verified), likes(count), comments(count)')
      .limit(30);

    // If category is provided and is not 'For You' or 'Trending', filter by it
    if (category && category !== 'For You' && category !== 'Trending') {
       query = query.contains('settings', { category });
    }

    const { data: relatedPosts } = await query;

    if (relatedPosts) {
      if (activeTab === 'Latest') {
        relatedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        // Top: sort by engagement (likes + comments)
        relatedPosts.sort((a, b) => {
          const scoreA = (a.likes?.[0]?.count || 0) + (a.comments?.[0]?.count || 0);
          const scoreB = (b.likes?.[0]?.count || 0) + (b.comments?.[0]?.count || 0);
          return scoreB - scoreA;
        });
      }
      setPosts(relatedPosts);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => {
            import('react-native').then(({ Alert }) => {
              Alert.alert('Report', 'Thank you for your report. We will review this topic.');
            });
          }}>
            <Ionicons name="flag-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => {
            import('react-native').then(({ Share }) => {
              Share.share({
                message: `Check out the latest on "${topicPost?.content?.substring(0, 50) || 'this trending topic'}" on Dapaz!`,
              });
            });
          }}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostItem post={item} />}
        ListHeaderComponent={
          <View style={styles.topicHeaderContainer}>
            <Text style={styles.topicTitle}>{topicPost?.content?.substring(0, 80) || 'Trending Topic'}...</Text>
            <Text style={styles.topicSummary}>
              This story is a summary of posts on Dapaz and may evolve over time. Our algorithms can make mistakes, verify outputs.
            </Text>
            
            <View style={styles.tabsContainer}>
              <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Top')}>
                <Text style={[styles.tabText, activeTab === 'Top' && styles.tabTextActive]}>Top</Text>
                {activeTab === 'Top' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('Latest')}>
                <Text style={[styles.tabText, activeTab === 'Latest' && styles.tabTextActive]}>Latest</Text>
                {activeTab === 'Latest' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            </View>
          </View>
        }
        ListFooterComponent={
          loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRight: { flexDirection: 'row', gap: 16 },
  iconBtn: { padding: 4 },
  topicHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topicTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 32,
  },
  topicSummary: {
    fontSize: 14,
    color: colors.textDim,
    lineHeight: 20,
    marginBottom: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDim,
  },
  tabTextActive: {
    color: colors.text,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    width: 60,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
