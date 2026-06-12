import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Animated, ScrollView, Dimensions
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const ORDER_STAGES = [
  { key: 'PENDING',    label: 'Order\nPlaced',   icon: 'receipt-outline',        color: '#6366f1' },
  { key: 'PROCESSING', label: 'Being\nPrepared', icon: 'cube-outline',           color: '#f59e0b' },
  { key: 'SHIPPED',    label: 'On\nThe Way',     icon: 'bicycle-outline',        color: '#3b82f6' },
  { key: 'DELIVERED',  label: 'Delivered',       icon: 'checkmark-circle-outline', color: '#16a34a' },
]

function getStageIndex(status: string) {
  const idx = ORDER_STAGES.findIndex(s => s.key === status?.toUpperCase())
  return idx === -1 ? 0 : idx
}

type TrackingData = {
  id: string
  product_name: string
  status: string
  created_at?: string
  driver_lat: number | null
  driver_lng: number | null
}

export default function TrackingScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { id } = useLocalSearchParams()
  const supabase = createClient()
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)

  // Animated values
  const progressAnim = useRef(new Animated.Value(0)).current
  const truckAnim = useRef(new Animated.Value(0)).current
  const dotAnims = useRef(ORDER_STAGES.map(() => new Animated.Value(0))).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(40)).current

  const animateToStage = (stageIdx: number) => {
    const total = ORDER_STAGES.length - 1
    const targetProgress = stageIdx / total
    Animated.parallel([
      Animated.spring(progressAnim, { toValue: targetProgress, useNativeDriver: false, tension: 40, friction: 8 }),
      Animated.spring(truckAnim,    { toValue: targetProgress, useNativeDriver: false, tension: 40, friction: 8 }),
      ...dotAnims.map((anim, i) =>
        Animated.timing(anim, { toValue: i <= stageIdx ? 1 : 0, duration: 400, delay: i * 120, useNativeDriver: true })
      ),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }

  useEffect(() => {
    let subscription: any
    async function fetchTracking() {
      try {
        const { data: itemData, error } = await supabase
          .from('order_items')
          .select('id, product_name, status, driver_lat, driver_lng, created_at')
          .eq('id', id)
          .single()

        if (error) throw error
        setData(itemData)
        animateToStage(getStageIndex(itemData.status))

        subscription = supabase
          .channel(`tracking_${id}`)
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'order_items', filter: `id=eq.${id}` },
            (payload) => {
              setData(prev => prev ? {
                ...prev,
                driver_lat: payload.new.driver_lat,
                driver_lng: payload.new.driver_lng,
                status: payload.new.status,
              } : null)
              animateToStage(getStageIndex(payload.new.status))
            }
          )
          .subscribe()
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchTracking()
    return () => { if (subscription) supabase.removeChannel(subscription) }
  }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textDim} />
        <Text style={{ color: colors.textDim, marginTop: 12 }}>Tracking info not found.</Text>
      </View>
    )
  }

  const stageIdx = getStageIndex(data.status)
  const currentStage = ORDER_STAGES[stageIdx]

  // Track bar width
  const TRACK_WIDTH = SCREEN_WIDTH - 64

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Order Info Card ── */}
        <Animated.View style={[styles.infoCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: currentStage.color + '22' }]}>
            <Ionicons name={currentStage.icon as any} size={32} color={currentStage.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.productName} numberOfLines={2}>{data.product_name}</Text>
            <Text style={[styles.statusLabel, { color: currentStage.color }]}>{currentStage.label.replace('\n', ' ')}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: currentStage.color + '22' }]}>
            <Text style={[styles.statusPillText, { color: currentStage.color }]}>{data.status}</Text>
          </View>
        </Animated.View>

        {/* ── Timeline ── */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Delivery Progress</Text>

          {/* Progress Track */}
          <View style={styles.trackContainer}>
            {/* Background track line */}
            <View style={[styles.trackLine, { backgroundColor: colors.border }]} />

            {/* Animated filled line */}
            <Animated.View style={[styles.trackLineFill, {
              width: truckAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, TRACK_WIDTH - 16],
              }),
            }]} />

            {/* Animated truck icon */}
            <Animated.View style={[styles.truckIconWrap, {
              left: truckAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, TRACK_WIDTH - 36],
              }),
            }]}>
              <Text style={{ fontSize: 22 }}>🚚</Text>
            </Animated.View>

            {/* Stage dots */}
            <View style={styles.dotsRow}>
              {ORDER_STAGES.map((stage, i) => (
                <Animated.View
                  key={stage.key}
                  style={[styles.dotWrap, {
                    transform: [{ scale: dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
                  }]}
                >
                  <Animated.View style={[
                    styles.dot,
                    {
                      backgroundColor: dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [colors.border, stage.color] }),
                      borderColor: dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [colors.border, stage.color] }),
                    }
                  ]}>
                    {i <= stageIdx ? (
                      <Ionicons name={i < stageIdx ? "checkmark" : stage.icon as any} size={i < stageIdx ? 14 : 12} color="#fff" />
                    ) : (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border }} />
                    )}
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Stage labels */}
          <View style={styles.labelsRow}>
            {ORDER_STAGES.map((stage, i) => (
              <View key={stage.key} style={styles.labelItem}>
                <Text style={[styles.stageLabel, i <= stageIdx ? { color: stage.color, fontWeight: '700' } : { color: colors.textDim }]}>
                  {stage.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Stage detail cards ── */}
        <Animated.View style={[styles.stagesCard, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Status History</Text>
          {ORDER_STAGES.map((stage, i) => {
            const done = i <= stageIdx
            return (
              <View key={stage.key} style={styles.stageRow}>
                <View style={[styles.stageIconCircle, { backgroundColor: done ? stage.color + '22' : colors.border + '33' }]}>
                  <Ionicons name={stage.icon as any} size={18} color={done ? stage.color : colors.textDim} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.stageName, { color: done ? colors.text : colors.textDim }]}>{stage.label.replace('\n', ' ')}</Text>
                  {i === stageIdx && (
                    <Text style={[styles.stageSubtext, { color: stage.color }]}>● Current status</Text>
                  )}
                  {i < stageIdx && (
                    <Text style={styles.stageSubtext}>Completed</Text>
                  )}
                  {i > stageIdx && (
                    <Text style={styles.stageSubtext}>Pending</Text>
                  )}
                </View>
                {done && i < stageIdx && (
                  <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                )}
                {i === stageIdx && (
                  <View style={[styles.activeBadge, { backgroundColor: stage.color + '22' }]}>
                    <Text style={[styles.activeBadgeText, { color: stage.color }]}>Active</Text>
                  </View>
                )}
              </View>
            )
          })}
        </Animated.View>

        {/* ── Estimated Delivery note ── */}
        {data.status !== 'DELIVERED' && (
          <View style={styles.etaCard}>
            <Ionicons name="time-outline" size={20} color="#f59e0b" style={{ marginRight: 10 }} />
            <Text style={styles.etaText}>Your order is on its way. We'll notify you when it's delivered!</Text>
          </View>
        )}
        {data.status === 'DELIVERED' && (
          <View style={[styles.etaCard, { borderColor: '#16a34a44', backgroundColor: '#16a34a11' }]}>
            <Text style={{ fontSize: 24, marginRight: 10 }}>🎉</Text>
            <Text style={[styles.etaText, { color: '#16a34a' }]}>Your order has been delivered. Enjoy!</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.card || '#111',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },

  infoCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.card || '#111',
    borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  productName: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '800' },

  timelineCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.card || '#111',
    borderRadius: 20, padding: 20, paddingBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 0.8 },

  trackContainer: { position: 'relative', height: 60, justifyContent: 'center', marginHorizontal: 8 },
  trackLine: {
    position: 'absolute', left: 8, right: 8,
    height: 4, borderRadius: 2, top: 32,
  },
  trackLineFill: {
    position: 'absolute', left: 8,
    height: 4, borderRadius: 2, top: 32,
    backgroundColor: '#3b82f6',
  },
  truckIconWrap: {
    position: 'absolute', top: 4,
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  dotsRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 0,
  },
  dotWrap: { alignItems: 'center' },
  dot: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  labelsRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 0,
  },
  labelItem: { flex: 1, alignItems: 'center' },
  stageLabel: { fontSize: 10, textAlign: 'center', lineHeight: 14 },

  stagesCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.card || '#111',
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stageRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stageIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  stageName: { fontSize: 14, fontWeight: '700' },
  stageSubtext: { fontSize: 12, color: '#888', marginTop: 2 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  activeBadgeText: { fontSize: 11, fontWeight: '800' },

  etaCard: {
    marginHorizontal: 20, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f59e0b11',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f59e0b44',
  },
  etaText: { flex: 1, fontSize: 13, color: '#f59e0b', fontWeight: '600', lineHeight: 18 },
})
