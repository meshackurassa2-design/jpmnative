import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Modal, TouchableWithoutFeedback } from 'react-native'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/auth'
import { createClient } from '../lib/supabase'
import { PostItem } from '../components/PostItem'

const { width } = Dimensions.get('window')
const supabase = createClient()

type TimeFrame = 7 | 30 | 90 | 365

export default function AnalyticsScreen() {
  const { user } = useAuth()
  
  const [timeframe, setTimeframe] = useState<TimeFrame>(30)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [currentViews, setCurrentViews] = useState(0)
  const [previousViews, setPreviousViews] = useState(0)
  const [interactions, setInteractions] = useState(0)
  const [followers, setFollowers] = useState(0)
  const [topPost, setTopPost] = useState<any>(null)
  
  useEffect(() => {
    if (!user) return
    let isActive = true
    
    const fetchAnalytics = async () => {
      setLoading(true)
      
      const now = new Date()
      const startDate = new Date(now.getTime() - timeframe * 24 * 60 * 60 * 1000).toISOString()
      const previousStartDate = new Date(now.getTime() - timeframe * 2 * 24 * 60 * 60 * 1000).toISOString()
      
      try {
        const postSel = 'id, content, image_urls, created_at, creator_id, parent_id, settings, view_count, profiles:creator_id(id, full_name, username, avatar_url, is_verified), likes(count), comments(count), reposts(count)'
        
        const [
          { data: currentPosts, error: currErr },
          { data: previousPosts, error: prevErr },
          { count: newFollowers }
        ] = await Promise.all([
          supabase.from('posts').select(postSel).eq('creator_id', user.id).gte('created_at', startDate),
          supabase.from('posts').select('view_count').eq('creator_id', user.id).gte('created_at', previousStartDate).lt('created_at', startDate),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id).gte('created_at', startDate)
        ])
        
        if (!isActive) return
        
        let cViews = 0
        let cInteractions = 0
        let maxEngagement = -1
        let bestPost = null
        
        currentPosts?.forEach((post: any) => {
          cViews += post.view_count || 0
          
          const likes = post.likes?.[0]?.count || 0
          const comments = post.comments?.[0]?.count || 0
          const reposts = post.reposts?.[0]?.count || 0
          
          const engagement = likes + comments + reposts
          cInteractions += engagement
          
          if (engagement + (post.view_count || 0) > maxEngagement) {
            maxEngagement = engagement + (post.view_count || 0)
            bestPost = post
          }
        })
        
        let pViews = 0
        previousPosts?.forEach((post: any) => {
          pViews += post.view_count || 0
        })
        
        setCurrentViews(cViews)
        setPreviousViews(pViews)
        setInteractions(cInteractions)
        setFollowers(newFollowers || 0)
        setTopPost(bestPost)
        
      } catch (err) {
        console.error('Analytics error:', err)
      } finally {
        if (isActive) setLoading(false)
      }
    }
    
    fetchAnalytics()
    return () => { isActive = false }
  }, [user, timeframe])

  const maxChartValue = Math.max(currentViews, previousViews, 2)
  const currentHeightPercent = (currentViews / maxChartValue) * 100
  const previousHeightPercent = (previousViews / maxChartValue) * 100

  // Format label correctly
  const getTimeframeLabel = () => {
    if (timeframe === 365) return '1 year'
    return `${timeframe} days`
  }

  const getLatestLabel = () => {
    if (timeframe === 365) return 'LATEST 1Y'
    return `LATEST ${timeframe}D`
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: false
        }} 
      />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={styles.headerBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insights</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { alignItems: 'flex-end' }]}>
          <Text style={[styles.headerBtnText, { fontWeight: '600' }]}>Done</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Summary Header */}
        <View style={styles.summaryHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Ionicons name="information-circle-outline" size={18} color="#a1a1aa" style={{ marginLeft: 6 }} />
          </View>
          
          <TouchableOpacity 
            style={styles.dropdownBtn}
            onPress={() => setShowDropdown(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dropdownBtnText}>{getTimeframeLabel()}</Text>
            <Ionicons name="chevron-down" size={16} color="#fff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <>
            {/* Views Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Views</Text>
                <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
              </View>
              <Text style={[styles.bigNumber, { fontSize: 48, marginTop: 8 }]}>{currentViews.toLocaleString()}</Text>
              
              <View style={styles.chartArea}>
                {/* Horizontal Grid Lines */}
                <View style={[styles.gridLine, { bottom: '0%' }]} />
                <View style={[styles.gridLine, { bottom: '25%' }]} />
                <View style={[styles.gridLine, { bottom: '50%' }]} />
                <View style={[styles.gridLine, { bottom: '75%' }]} />
                <View style={[styles.gridLine, { bottom: '100%' }]} />
                
                {/* Y-Axis Labels */}
                <Text style={[styles.yAxisLabel, { bottom: '0%' }]}>0</Text>
                <Text style={[styles.yAxisLabel, { bottom: '25%' }]}>{(maxChartValue * 0.25).toFixed(1).replace('.0', '')}</Text>
                <Text style={[styles.yAxisLabel, { bottom: '50%' }]}>{(maxChartValue * 0.5).toFixed(1).replace('.0', '')}</Text>
                <Text style={[styles.yAxisLabel, { bottom: '75%' }]}>{(maxChartValue * 0.75).toFixed(1).replace('.0', '')}</Text>
                <Text style={[styles.yAxisLabel, { bottom: '100%' }]}>{maxChartValue.toFixed(1).replace('.0', '')}</Text>
                
                {/* Bars */}
                <View style={styles.barsContainer}>
                  {/* Previous Bar */}
                  <View style={styles.barWrapper}>
                    <View style={[styles.bar, { height: `${Math.max(previousHeightPercent, 1)}%`, backgroundColor: '#27272a' }]} />
                    <Text style={styles.barLabel}>PREVIOUS</Text>
                  </View>
                  
                  {/* Current Bar */}
                  <View style={styles.barWrapper}>
                    <View style={[styles.bar, { height: `${Math.max(currentHeightPercent, 1)}%`, backgroundColor: '#fff' }]} />
                    <Text style={styles.barLabel}>{getLatestLabel()}</Text>
                  </View>
                </View>
              </View>
            </View>
            
            {/* Small Cards Row */}
            <View style={styles.smallCardsRow}>
              <View style={styles.smallCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Interactions</Text>
                  <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
                </View>
                <Text style={styles.bigNumber}>{interactions.toLocaleString()}</Text>
              </View>
              
              <View style={styles.smallCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Followers</Text>
                  <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
                </View>
                <Text style={styles.bigNumber}>{followers.toLocaleString()}</Text>
              </View>
            </View>
            
            {/* Top Content */}
            <View style={styles.topContentHeader}>
              <Text style={styles.topContentTitle}>Top content</Text>
              <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
            </View>
            
            {topPost ? (
              <View style={{ marginHorizontal: -16 }}>
                <PostItem post={topPost} />
              </View>
            ) : (
              <View style={styles.emptyPost}>
                <Text style={styles.emptyPostText}>No posts in this period.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Dropdown Modal */}
      <Modal visible={showDropdown} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.dropdownMenu}>
              {[
                { label: '7 days', value: 7 },
                { label: '30 days', value: 30 },
                { label: '90 days', value: 90 },
                { label: '1 year', value: 365 },
              ].map(opt => (
                <TouchableOpacity 
                  key={opt.value} 
                  style={styles.dropdownOption}
                  onPress={() => {
                    setTimeframe(opt.value as TimeFrame)
                    setShowDropdown(false)
                  }}
                >
                  <Text style={[styles.dropdownOptionText, timeframe === opt.value && { color: '#fff', fontWeight: 'bold' }]}>
                    {opt.label}
                  </Text>
                  {timeframe === opt.value && <Ionicons name="checkmark" size={20} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50, // safe area approx
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dropdownBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#151517',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  bigNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  chartArea: {
    height: 180,
    position: 'relative',
    marginTop: 10,
    marginBottom: 40,
  },
  gridLine: {
    position: 'absolute',
    left: 30,
    right: 0,
    height: 1,
    backgroundColor: '#27272a',
    borderStyle: 'dashed',
  },
  yAxisLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 11,
    color: '#52525b',
    transform: [{ translateY: 5 }],
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginLeft: 30,
  },
  barWrapper: {
    alignItems: 'center',
    width: 80,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 70,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  barLabel: {
    position: 'absolute',
    top: '100%',
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
    textAlign: 'center',
    width: 80,
  },
  smallCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  smallCard: {
    backgroundColor: '#151517',
    borderRadius: 20,
    padding: 16,
    flex: 1,
  },
  topContentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  topContentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  emptyPost: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#151517',
    borderRadius: 16,
  },
  emptyPostText: {
    color: '#a1a1aa',
    fontSize: 15,
  },
  loader: {
    paddingTop: 100,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 120,
    paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    width: 160,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  dropdownOptionText: {
    color: '#a1a1aa',
    fontSize: 16,
  },
})
