import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../lib/theme'

const { width } = Dimensions.get('window')
const supabase = createClient()

export default function PostAnalyticsScreen() {
  const { colors } = useTheme()
  const styles = React.useMemo(() => getStyles(colors), [colors])
  
  const { postId } = useLocalSearchParams()
  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<any>(null)
  const [dailyViews, setDailyViews] = useState<any[]>([])
  const [videoRetention, setVideoRetention] = useState<any>(null)
  const [isMonetized, setIsMonetized] = useState(false)
  const [realRPM, setRealRPM] = useState(0)

  useEffect(() => {
    if (!postId) return
    let isActive = true
    
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        // Fetch post details and engagement
        const { data: postData } = await supabase
          .from('posts')
          .select('id, view_count, likes(count), comments(count), video_url, creator_id')
          .eq('id', postId)
          .single()
        
        if (postData) {
          if (isActive) setPost(postData)
          
          // Fetch monetization status and lifetime views to compute Real RPM
          const [
            { data: profileData },
            { data: allLifetimePosts }
          ] = await Promise.all([
            supabase.from('profiles').select('monetization_enabled, monetization_earnings').eq('id', postData.creator_id).single(),
            supabase.from('posts').select('view_count').eq('creator_id', postData.creator_id)
          ])
            
          if (isActive) {
            const totalEarnings = profileData?.monetization_earnings || 0
            const totalLifetimeViews = (allLifetimePosts || []).reduce((acc: number, p: any) => acc + (p.view_count || 0), 0)
            const calculatedRPM_usd = totalLifetimeViews > 0 ? (totalEarnings / (totalLifetimeViews / 1000)) : 0
            const cappedRPM_usd = Math.min(calculatedRPM_usd, 0.01)
            const rpm_tsh = cappedRPM_usd * 2600
            
            setRealRPM(rpm_tsh)
            setIsMonetized(!!profileData?.monetization_enabled)
          }
          
          // Fetch daily views for Shelf Life chart
          const { data: dailyData } = await supabase
            .from('post_analytics_daily')
            .select('date, views')
            .eq('post_id', postId)
            .order('date', { ascending: true })
            .limit(14)
          
          if (isActive) setDailyViews(dailyData || [])
          
          // If video, fetch retention
          if (postData.video_url) {
            const { data: retentionData } = await supabase
              .from('video_retention')
              .select('*')
              .eq('post_id', postId)
              .single()
            if (isActive && retentionData) setVideoRetention(retentionData)
          }
        }
      } catch (e) {
        console.error('Post analytics fetch error:', e)
      } finally {
        if (isActive) setLoading(false)
      }
    }
    fetchAnalytics()
    return () => { isActive = false }
  }, [postId])

  const renderDailyChart = () => {
    if (!dailyViews.length) return <Text style={styles.emptyText}>Not enough daily data yet.</Text>
    
    const maxViews = Math.max(...dailyViews.map(d => d.views), 10)
    
    return (
      <View style={styles.chartArea}>
        {dailyViews.map((day, idx) => {
          const heightPercent = (day.views / maxViews) * 100
          const dateStr = new Date(day.date).getDate()
          return (
            <View key={idx} style={styles.barWrapper}>
              <Text style={styles.barValue}>{day.views}</Text>
              <View style={[styles.bar, { height: `${Math.max(heightPercent, 5)}%`, backgroundColor: '#3b82f6' }]} />
              <Text style={styles.barLabel}>{dateStr}</Text>
            </View>
          )
        })}
      </View>
    )
  }

  const renderRetentionFunnel = () => {
    if (!videoRetention) return <Text style={styles.emptyText}>Not enough video data yet.</Text>
    
    const start = videoRetention.views_start || 1
    const p25 = Math.min((videoRetention.views_25 / start) * 100, 100).toFixed(0)
    const p50 = Math.min((videoRetention.views_50 / start) * 100, 100).toFixed(0)
    const p75 = Math.min((videoRetention.views_75 / start) * 100, 100).toFixed(0)
    const p100 = Math.min((videoRetention.views_100 / start) * 100, 100).toFixed(0)
    
    return (
      <View style={styles.funnelContainer}>
        <View style={styles.funnelStep}>
          <Text style={styles.funnelLabel}>Started</Text>
          <View style={styles.funnelTrack}><View style={[styles.funnelFill, { width: '100%' }]} /></View>
          <Text style={styles.funnelValue}>100%</Text>
        </View>
        <View style={styles.funnelStep}>
          <Text style={styles.funnelLabel}>25%</Text>
          <View style={styles.funnelTrack}><View style={[styles.funnelFill, { width: `${p25}%` }]} /></View>
          <Text style={styles.funnelValue}>{p25}%</Text>
        </View>
        <View style={styles.funnelStep}>
          <Text style={styles.funnelLabel}>50%</Text>
          <View style={styles.funnelTrack}><View style={[styles.funnelFill, { width: `${p50}%` }]} /></View>
          <Text style={styles.funnelValue}>{p50}%</Text>
        </View>
        <View style={styles.funnelStep}>
          <Text style={styles.funnelLabel}>75%</Text>
          <View style={styles.funnelTrack}><View style={[styles.funnelFill, { width: `${p75}%` }]} /></View>
          <Text style={styles.funnelValue}>{p75}%</Text>
        </View>
        <View style={styles.funnelStep}>
          <Text style={styles.funnelLabel}>Finished</Text>
          <View style={styles.funnelTrack}><View style={[styles.funnelFill, { width: `${p100}%` }]} /></View>
          <Text style={styles.funnelValue}>{p100}%</Text>
        </View>
      </View>
    )
  }

  const renderEngagementFunnel = () => {
    if (!post) return null
    const views = post.view_count || 1
    const likes = post.likes?.[0]?.count || 0
    const comments = post.comments?.[0]?.count || 0
    
    const likeRate = ((likes / views) * 100).toFixed(1)
    const commentRate = ((comments / views) * 100).toFixed(1)
    
    return (
      <View style={styles.engagementRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Views</Text>
          <Text style={styles.metricValue}>{views.toLocaleString()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#3f3f46" />
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Likes</Text>
          <Text style={styles.metricValue}>{likes.toLocaleString()}</Text>
          <Text style={styles.metricRate}>{likeRate}%</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#3f3f46" />
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Comments</Text>
          <Text style={styles.metricValue}>{comments.toLocaleString()}</Text>
          <Text style={styles.metricRate}>{commentRate}%</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }} 
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.headerBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Insights</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 100 }} size="large" color={colors.text} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Engagement Funnel</Text>
            <Text style={styles.sectionDesc}>See how many viewers actually interacted with this post.</Text>
            {renderEngagementFunnel()}
          </View>

          {isMonetized && post && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Financial Performance</Text>
              <Text style={styles.sectionDesc}>Calculated using your actual account RPM ({Math.round(realRPM).toLocaleString()} TSH).</Text>
              <View style={[styles.engagementRow, { justifyContent: 'flex-start', gap: 24 }]}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Real Earnings</Text>
                  <Text style={[styles.metricValue, { color: '#10b981' }]}>
                    {Math.round(((post.view_count || 0) / 1000) * realRPM).toLocaleString()} TSH
                  </Text>
                </View>
                <View style={[styles.metricBox, { alignItems: 'flex-start' }]}>
                  <Text style={styles.metricLabel}>Qualifying Views</Text>
                  <Text style={styles.metricValue}>{(post.view_count || 0).toLocaleString()}</Text>
                </View>
              </View>
            </View>
          )}

          {post?.video_url && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Audience Retention</Text>
              <Text style={styles.sectionDesc}>When are viewers scrolling away from your video?</Text>
              {renderRetentionFunnel()}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traffic Shelf-Life</Text>
            <Text style={styles.sectionDesc}>Daily views for the last 14 days.</Text>
            {renderDailyChart()}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 60 },
  headerBtnText: { color: colors.text, fontSize: 16 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 60 },
  section: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sectionDesc: { color: colors.textDim, fontSize: 13, marginBottom: 20 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricBox: { alignItems: 'center', flex: 1 },
  metricLabel: { color: colors.textDim, fontSize: 12, marginBottom: 4 },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  metricRate: { color: '#10b981', fontSize: 12, fontWeight: '600', marginTop: 4 },
  chartArea: { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 20 },
  barWrapper: { alignItems: 'center', width: 24, height: '100%', justifyContent: 'flex-end' },
  barValue: { color: colors.textDim, fontSize: 10, marginBottom: 4 },
  bar: { width: 16, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { color: colors.textDim, fontSize: 10, marginTop: 8 },
  emptyText: { color: colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: 20 },
  funnelContainer: { gap: 12 },
  funnelStep: { flexDirection: 'row', alignItems: 'center' },
  funnelLabel: { color: colors.text, width: 60, fontSize: 12, fontWeight: '600' },
  funnelTrack: { flex: 1, height: 12, backgroundColor: colors.border, borderRadius: 6, marginHorizontal: 12, overflow: 'hidden' },
  funnelFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 6 },
  funnelValue: { color: colors.textDim, width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700' }
})
