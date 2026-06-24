// app/(settings)/monetization.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useTranslation } from '../../lib/i18n'
import { BlurView } from 'expo-blur'
import { Skeleton } from '../../components/Skeleton'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const { t } = useTranslation()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({ followers: 0, views: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('posts').select('view_count').eq('creator_id', user.id).gte('created_at', thirtyDaysAgo)
    ]).then(([profRes, folRes, postRes]) => {
      setProfile(profRes.data)
      const followers = folRes.count || 0
      const views = postRes.data ? postRes.data.reduce((sum: number, p: any) => sum + (p.view_count || 0), 0) : 0
      setStats({ followers, views })
      setLoading(false)
    })
  }, [user])

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerArea}>
          <Skeleton width={32} height={32} borderRadius={16} style={{ marginBottom: 12 }} />
          <Skeleton width={200} height={32} style={{ marginBottom: 8 }} />
          <Skeleton width="80%" height={20} />
        </View>

        <Skeleton width="100%" height={140} borderRadius={24} style={{ marginBottom: 20 }} />

        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Skeleton width={140} height={20} />
            <Skeleton width={80} height={28} borderRadius={12} />
          </View>
          <Skeleton width="100%" height={16} style={{ marginTop: 12 }} />
          <Skeleton width="70%" height={16} style={{ marginTop: 6 }} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Skeleton width={160} height={20} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={16} style={{ marginBottom: 24 }} />
          <View style={styles.reqBlock}>
            <Skeleton width="100%" height={20} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={10} borderRadius={5} />
          </View>
          <View style={styles.reqBlock}>
            <Skeleton width="100%" height={20} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={10} borderRadius={5} />
          </View>
          <Skeleton width="100%" height={50} borderRadius={16} style={{ marginTop: 12 }} />
        </View>
      </ScrollView>
    )
  }

  const earnings = profile?.monetization_earnings || 0
  const appStatus = profile?.settings?.creator_application_status
  const isApproved = appStatus === 'approved'
  const isPending = appStatus === 'pending'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerArea}>
        <Ionicons name="diamond" size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
        <Text style={[styles.pageTitle, { color: colors.text }]}>{t('monetization_title')}</Text>
        <Text style={styles.pageDesc}>{t('monetization_subtitle')}</Text>
      </View>

      <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.revenueCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.revenueTop}>
          <Text style={styles.revenueLabel}>{t('estimated_revenue')}</Text>
          <TouchableOpacity onPress={() => Alert.alert(t('estimated_revenue'), 'This is an estimate of your total earnings based on valid views and engagement over the last 30 days. Final payouts may vary based on ad performance.', [{ text: 'Got it' }])}>
            <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>
        <Text style={styles.revenueValue}>${earnings.toFixed(2)}</Text>
        <View style={styles.revenueBottom}>
          <Ionicons name="stats-chart" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.revenueFooter}>{t('updated_every_24h')}</Text>
        </View>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{t('app_status')}</Text>
          <BlurView intensity={30} tint={isApproved ? 'light' : isPending ? 'light' : 'dark'} style={[styles.statusBadge, isApproved ? styles.bgGreen : isPending ? styles.bgOrange : styles.bgGray]}>
            <Text style={[styles.statusBadgeText, isApproved ? styles.textGreen : isPending ? styles.textOrange : styles.textGray]}>
              {isApproved ? t('status_approved') : isPending ? t('status_pending') : t('status_not_eligible')}
            </Text>
          </BlurView>
        </View>
        
        <Text style={[styles.cardDesc, { color: colors.textDim }]}>
          {isApproved
            ? t('status_desc_approved')
            : isPending
              ? t('status_desc_pending')
              : t('status_desc_not_eligible')}
        </Text>

        {isApproved && (
          <TouchableOpacity style={styles.payoutBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Payout Requested', 'Your payout request has been submitted. Our team will process it within 3-5 business days.');
          }} activeOpacity={0.8}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.payoutGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="cash-outline" size={20} color="#fff" />
              <Text style={styles.payoutBtnText}>{t('request_payout')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={styles.cardTitle}>{t('eligibility_reqs')}</Text>
        <Text style={[styles.cardDesc, { color: colors.textDim, marginBottom: 24 }]}>
          {t('eligibility_desc')}
        </Text>

        <View style={styles.reqBlock}>
          <View style={styles.reqHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                <Ionicons name="people" size={16} color="#ec4899" />
              </View>
              <Text style={[styles.reqTitle, { color: colors.text }]}>{t('followers_req')}</Text>
            </View>
            <Text style={styles.reqValues}>{stats.followers.toLocaleString()} / 10K</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient 
              colors={['#ec4899', '#f43f5e']} 
              style={[styles.progressFill, { width: `${Math.min((stats.followers / 10000) * 100, 100)}%` }]} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
            />
          </View>
        </View>

        <View style={styles.reqBlock}>
          <View style={styles.reqHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="eye" size={16} color="#10b981" />
              </View>
              <Text style={[styles.reqTitle, { color: colors.text }]}>{t('views_req')}</Text>
            </View>
            <Text style={styles.reqValues}>{stats.views.toLocaleString()} / 3M</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient 
              colors={['#10b981', '#059669']} 
              style={[styles.progressFill, { width: `${Math.min((stats.views / 3000000) * 100, 100)}%` }]} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
            />
          </View>
        </View>

        {!isApproved && !isPending && (
          <TouchableOpacity 
            activeOpacity={0.8}
            disabled={stats.followers < 10000 || stats.views < 3000000}
            onPress={async () => {
              if (!user) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const { error } = await supabase.from('profiles').update({
                settings: { ...(profile.settings || {}), creator_application_status: 'pending' }
              }).eq('id', user.id);
              if (!error) {
                setProfile({ ...profile, settings: { ...(profile.settings || {}), creator_application_status: 'pending' }});
                Alert.alert('Success', 'Application submitted successfully! Our team will review your profile.');
              } else {
                Alert.alert('Error', 'Failed to submit application: ' + error.message);
              }
            }}
          >
            <LinearGradient
              colors={(stats.followers >= 10000 && stats.views >= 3000000) ? ['#3b82f6', '#2563eb'] : ['#52525b', '#3f3f46']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.applyBtnGradient}
            >
              <Text style={styles.applyBtnText}>{t('submit_application')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.border },
  content: { padding: 16, paddingBottom: 60 },
  headerArea: { paddingVertical: 20, paddingHorizontal: 8 },
  pageTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  pageDesc: { fontSize: 16, color: '#a1a1aa', lineHeight: 24, fontWeight: '500' },
  
  revenueCard: { borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { height: 4, width: 0 }, elevation: 8 },
  revenueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  revenueLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: 1 },
  revenueValue: { fontSize: 48, fontWeight: '900', color: '#fff', marginBottom: 16, letterSpacing: -1 },
  revenueBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  revenueFooter: { fontSize: 13, color: '#fff', fontWeight: '500' },
  
  card: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { height: 2, width: 0 }, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardDesc: { fontSize: 15, lineHeight: 22 },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' },
  statusBadgeText: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bgGreen: { backgroundColor: 'rgba(16, 185, 129, 0.15)' }, textGreen: { color: '#10b981' },
  bgOrange: { backgroundColor: 'rgba(245, 158, 11, 0.15)' }, textOrange: { color: '#f59e0b' },
  bgGray: { backgroundColor: 'rgba(161, 161, 170, 0.15)' }, textGray: { color: '#a1a1aa' },
  
  reqBlock: { marginBottom: 20 },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  reqTitle: { fontSize: 16, fontWeight: '700' },
  reqValues: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  progressBar: { height: 10, backgroundColor: 'rgba(161, 161, 170, 0.15)', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  
  applyBtnGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 16, marginTop: 12, gap: 8 },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  
  payoutBtn: { marginTop: 16 },
  payoutGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  payoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
