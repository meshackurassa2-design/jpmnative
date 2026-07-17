// app/(settings)/monetization.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useTranslation } from '../../lib/i18n'

const { width } = Dimensions.get('window')

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const { t } = useTranslation()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [monthlyViews, setMonthlyViews] = useState(0)
  const [totalPosts, setTotalPosts] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { data: profRes } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profRes)

      // Fetch real 30-day view count
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: postsData } = await supabase.from('posts').select('view_count').eq('creator_id', user.id).gte('created_at', startDate)
      const views = postsData?.reduce((acc, curr) => acc + (curr.view_count || 0), 0) || 0
      setMonthlyViews(views)

      // Fetch real active posts count
      const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('creator_id', user.id)
      setTotalPosts(count || 0)

      setLoading(false)
    }
    fetchData()
  }, [user])

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    )
  }

  const earnings = profile?.monetization_earnings || 0
  const appStatus = profile?.settings?.creator_application_status
  const isApproved = appStatus === 'approved'
  const isPending = appStatus === 'pending'

  if (isApproved) {
    const rpm = monthlyViews > 0 ? (earnings / (monthlyViews / 1000)) : 0;
    const progressPercent = Math.min((earnings / 50) * 100, 100);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Clean Header */}
        <View style={[styles.headerArea, { marginBottom: 24, marginTop: 16 }]}>
          <Text style={[styles.pageTitle, { fontSize: 40, letterSpacing: -1.5 }]}>${earnings.toFixed(2)}</Text>
          <Text style={[styles.pageDesc, { fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }]}>Total Net Revenue</Text>
        </View>

        {/* 2x2 Grid */}
        <View style={styles.grid2x2}>
          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="eye-outline" size={22} color={colors.textDim} style={{ marginBottom: 12 }} />
            <Text style={styles.gridValue}>{monthlyViews.toLocaleString()}</Text>
            <Text style={styles.gridLabel}>30-Day Views</Text>
          </View>
          
          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="stats-chart-outline" size={22} color={colors.textDim} style={{ marginBottom: 12 }} />
            <Text style={styles.gridValue}>${rpm.toFixed(2)}</Text>
            <Text style={styles.gridLabel}>Avg. RPM</Text>
          </View>

          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="documents-outline" size={22} color={colors.textDim} style={{ marginBottom: 12 }} />
            <Text style={styles.gridValue}>{totalPosts.toLocaleString()}</Text>
            <Text style={styles.gridLabel}>Active Posts</Text>
          </View>

          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#10b981" style={{ marginBottom: 12 }} />
            <Text style={[styles.gridValue, { color: '#10b981' }]}>Active</Text>
            <Text style={styles.gridLabel}>Status</Text>
          </View>
        </View>

        {/* Withdrawal Section */}
        <Text style={[styles.sectionHeader, { marginTop: 32 }]}>Payouts</Text>
        <View style={[styles.glassCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12, paddingVertical: 24 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>Threshold Progress</Text>
            <Text style={{ fontSize: 15, color: colors.text, fontWeight: '800' }}>${earnings.toFixed(2)} / $50.00</Text>
          </View>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          
          <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 16, lineHeight: 20 }}>
            You need to reach the $50 minimum threshold to request a payout. Payments are processed within 3-5 business days.
          </Text>

          <TouchableOpacity 
            style={[styles.withdrawBtn, earnings < 50 && styles.withdrawBtnDisabled]}
            disabled={earnings < 50}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Payout Requested', 'Your payout request is being processed.');
            }}
          >
            <Text style={[styles.withdrawBtnText, earnings < 50 && styles.withdrawBtnTextDisabled]}>Withdraw Funds</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    )
  }

  // Pending / Unregistered View
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      
      {/* Header section with premium dark gradient */}
      <View style={styles.headerArea}>
        <View style={styles.iconCircle}>
          <Ionicons name="cash" size={28} color="#10b981" />
        </View>
        <Text style={styles.pageTitle}>{t('monetization_title')}</Text>
        <Text style={styles.pageDesc}>{t('monetization_subtitle')}</Text>
      </View>

      {/* Status Card (Glassmorphism) */}
      <View style={[styles.glassCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('app_status')}</Text>
            <Text style={styles.cardSubtitle}>
              {isPending ? 'Your spot on the waitlist is secured.' : 'Join the waitlist to get started.'}
            </Text>
          </View>
          <View style={[styles.statusBadge, isPending ? styles.bgOrange : styles.bgGray]}>
            <Text style={[styles.statusBadgeText, isPending ? styles.textOrange : styles.textGray]}>
              {isPending ? 'ON WAITLIST' : 'NOT JOINED'}
            </Text>
          </View>
        </View>
      </View>

      {/* Waitlist Section */}
      <Text style={styles.sectionHeader}>Monetization Waitlist</Text>

      <View style={[styles.glassCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
        
        {/* Waitlist Info */}
        <View style={styles.reqItem}>
          <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600', marginBottom: 12, lineHeight: 24 }}>
            Join the waitlist for our Creator Monetization Program. Our team manually reviews accounts and admits creators in batches.
          </Text>
        </View>

        {/* Apply Button */}
        {!isPending && (
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={async () => {
              if (!user) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const { error } = await supabase.from('profiles').update({
                settings: { ...(profile.settings || {}), creator_application_status: 'pending' }
              }).eq('id', user.id);
              if (!error) {
                setProfile({ ...profile, settings: { ...(profile.settings || {}), creator_application_status: 'pending' }});
                Alert.alert('Waitlist Joined', 'You have successfully joined the monetization waitlist!');
              } else {
                Alert.alert('Error', error.message);
              }
            }}
            style={{ marginTop: 24 }}
          >
            <LinearGradient
              colors={['#3b82f6', '#1d4ed8']}
              style={styles.applyBtnGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.applyBtnText}>
                Join Waitlist
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  headerArea: { alignItems: 'center', marginBottom: 32, marginTop: 10 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconCircleSmall: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
  pageDesc: { fontSize: 15, color: colors.textDim, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },
  
  revenueCard: { borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  revenueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  revenueLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  revenueValue: { fontSize: 48, fontWeight: '900', color: '#fff', marginBottom: 24, letterSpacing: -1 },
  revenueBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  revenueFooter: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  payoutBtnSmall: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  payoutBtnSmallText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statBox: { flex: 1, borderRadius: 20, padding: 20, borderWidth: 1 },
  statBoxValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  statBoxLabel: { fontSize: 13, color: colors.textDim, fontWeight: '600' },

  glassCard: { borderRadius: 24, padding: 24, borderWidth: 1 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textDim, lineHeight: 18, maxWidth: 200 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  bgGreen: { backgroundColor: 'rgba(16, 185, 129, 0.15)' }, textGreen: { color: '#10b981' },
  bgOrange: { backgroundColor: 'rgba(245, 158, 11, 0.15)' }, textOrange: { color: '#f59e0b' },
  bgGray: { backgroundColor: 'rgba(100, 116, 139, 0.15)' }, textGray: { color: '#64748b' },
  
  sectionHeader: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 24, marginLeft: 4 },
  reqItem: { paddingVertical: 8 },
  applyBtnGradient: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  gridCell: { width: '48%', borderRadius: 20, padding: 20, borderWidth: 1, flexGrow: 1 },
  gridValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4, letterSpacing: -0.5 },
  gridLabel: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  progressBarBg: { height: 10, borderRadius: 5, backgroundColor: 'rgba(100,116,139,0.2)', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 5 },
  withdrawBtn: { marginTop: 24, backgroundColor: colors.text, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  withdrawBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.1)' },
  withdrawBtnText: { color: colors.background, fontWeight: '800', fontSize: 16 },
  withdrawBtnTextDisabled: { color: colors.textDim },
})
