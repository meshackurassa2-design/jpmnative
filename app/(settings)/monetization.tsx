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

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({ followers: 0, views: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('posts').select('view_count').eq('creator_id', user.id)
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    )
  }

  const earnings = profile?.monetization_earnings || 0
  const appStatus = profile?.settings?.creator_application_status
  const isApproved = appStatus === 'approved'
  const isPending = appStatus === 'pending'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageDesc}>Track your earnings and eligibility status.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Estimated Revenue</Text>
        <Text style={styles.cardValue}>${earnings.toFixed(2)}</Text>
        <View style={styles.row}>
          <Ionicons name="stats-chart-outline" size={13} color="#a1a1aa" />
          <Text style={styles.cardFooter}>Updated every 24 hours</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Eligibility Status</Text>
        <Text style={[
          styles.statusText,
          isApproved && styles.statusApproved,
          isPending && styles.statusPending,
        ]}>
          {isApproved ? 'Approved' : isPending ? 'Under Review' : 'Not Eligible'}
        </Text>
        <Text style={styles.cardDesc}>
          {isApproved
            ? 'Congratulations! You are earning from your memes.'
            : isPending
              ? 'Our team is reviewing your application. Hang tight!'
              : 'Keep posting high-quality memes to unlock monetization!'}
        </Text>
        {isApproved && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => {
            Alert.alert('Payout Requested', 'Your payout request has been submitted. Our team will process it within 3-5 business days.');
          }}>
            <Text style={styles.actionBtnText}>Request Payout</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Apply for Monetization</Text>
        <Text style={styles.cardDesc}>
          Meet our creator requirements to start earning. Post regularly, build an audience, and keep content quality high.
        </Text>

        <View style={styles.reqBlock}>
          <View style={styles.reqHeader}>
            <Text style={styles.reqTitle}>10,000 Followers</Text>
            <Text style={styles.reqValues}>{stats.followers.toLocaleString()} / 10K</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((stats.followers / 10000) * 100, 100)}%` }]} />
          </View>
        </View>

        <View style={styles.reqBlock}>
          <View style={styles.reqHeader}>
            <Text style={styles.reqTitle}>100,000 Views</Text>
            <Text style={styles.reqValues}>{stats.views.toLocaleString()} / 100K</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((stats.views / 100000) * 100, 100)}%` }]} />
          </View>
        </View>

        {!isApproved && !isPending && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.text, opacity: (stats.followers >= 10000 && stats.views >= 100000) ? 1 : 0.5 }]}
            disabled={stats.followers < 10000 || stats.views < 100000}
            onPress={async () => {
              if (!user) return;
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
            <Text style={styles.actionBtnText}>Apply Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.border },
  content: { padding: 20, paddingBottom: 60 },
  pageDesc: { fontSize: 15, color: colors.textDim, marginBottom: 20, lineHeight: 22 },
  card: { backgroundColor: colors.background, borderRadius: 16, padding: 20, marginBottom: 16, elevation: 1, shadowColor: colors.text, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { height: 1, width: 0 } },
  cardLabel: { fontSize: 12, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  cardValue: { fontSize: 40, fontWeight: '900', color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardFooter: { fontSize: 12, color: colors.textDim },
  statusText: { fontSize: 22, fontWeight: '800', color: '#52525b', marginBottom: 8 },
  statusApproved: { color: '#16a34a' },
  statusPending: { color: '#d97706' },
  cardDesc: { fontSize: 14, color: colors.textDim, lineHeight: 21, marginBottom: 16 },
  reqBlock: { marginBottom: 16 },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reqTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  reqValues: { fontSize: 13, color: colors.textDim, fontWeight: '500' },
  progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  actionBtn: { backgroundColor: '#2563eb', paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  actionBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
})
