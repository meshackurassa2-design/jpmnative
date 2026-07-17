import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Animated, ScrollView, Dimensions, Image, Modal, Alert, TextInput
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
  shipping_receipt_url?: string | null
  shop_id?: string
}

export default function TrackingScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { id } = useLocalSearchParams()
  const supabase = createClient()
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)
  const [isReporting, setIsReporting] = useState(false)
  const [reportReason, setReportReason] = useState('Item delayed or not delivered')
  const [reportDetails, setReportDetails] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

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

  const handleReportProblem = async () => {
    if (!reportReason.trim()) return Alert.alert('Error', 'Please select or enter a reason.')
    if (!reporterPhone.trim()) return Alert.alert('Error', 'Please enter your contact phone number so our team can follow up.')
    setSubmittingReport(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const shopInfo = (data as any)?.shopDetails || {}
      const { error } = await supabase.from('problem_reports').insert({
        reporter_id: user?.id || null,
        target_type: 'order',
        target_id: id as string,
        target_name: data?.product_name || 'Order Issue',
        reason: reportReason,
        details: reportDetails.trim() || null,
        reporter_phone: reporterPhone.trim() || null,
        seller_phone: shopInfo.contact_phone || null,
        shop_id: shopInfo.id || data?.shop_id || null,
        shop_name: shopInfo.name || null,
        target_metadata: {
          order_id: id,
          product_name: data?.product_name,
          shop_id: shopInfo.id || data?.shop_id,
          shop_name: shopInfo.name,
          owner_id: shopInfo.owner_id,
          contact_phone: shopInfo.contact_phone,
          tra_tin: shopInfo.tra_tin,
          category: shopInfo.category,
          city: shopInfo.location_city
        }
      })
      if (error) throw error
      Alert.alert('Problem Reported', 'We have received your report and attached contact details. Nyumbani Escrow Support will investigate immediately.')
      setIsReporting(false)
      setReportDetails('')
      setReporterPhone('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingReport(false)
    }
  }

  useEffect(() => {
    let subscription: any
    async function fetchTracking() {
      try {
        const { data: itemData, error } = await supabase
          .from('order_items')
          .select('id, product_name, status, driver_lat, driver_lng, created_at, shipping_receipt_url, shop_id')
          .eq('id', id)
          .single()

        if (error) throw error
        let shopDetails = null
        if (itemData.shop_id) {
          const { data: s } = await supabase.from('shops').select('id, name, contact_phone, owner_id, tra_tin, category, location_city').eq('id', itemData.shop_id).maybeSingle()
          shopDetails = s
        }
        setData({ ...itemData, shopDetails })
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
                shipping_receipt_url: payload.new.shipping_receipt_url,
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

        {/* ── Additional Actions ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 40, gap: 12 }}>
          {data.shipping_receipt_url && (
            <TouchableOpacity 
              style={[styles.etaCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}
              onPress={() => setShowReceipt(true)}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.text} style={{ marginRight: 10 }} />
              <Text style={[styles.etaText, { color: colors.text }]}>View Shipping Receipt / Ticket</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </TouchableOpacity>
          )}
          {data.shop_id && (
            <TouchableOpacity 
              style={[styles.etaCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}
              onPress={() => router.push(`/chat/${data.shop_id}`)}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={colors.text} style={{ marginRight: 10 }} />
              <Text style={[styles.etaText, { color: colors.text }]}>Contact Seller</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.etaCard, { backgroundColor: colors.card, borderColor: 'rgba(239, 68, 68, 0.35)', marginBottom: 0 }]}
            onPress={() => setIsReporting(true)}
          >
            <Ionicons name="warning-outline" size={20} color="#ef4444" style={{ marginRight: 10 }} />
            <Text style={[styles.etaText, { color: '#ef4444', fontWeight: '700' }]}>Report a Problem / Dispute</Text>
            <Ionicons name="chevron-forward" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <Modal visible={showReceipt} transparent={true} animationType="fade" onRequestClose={() => setShowReceipt(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={() => setShowReceipt(false)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            {data.shipping_receipt_url ? (
              <Image source={{ uri: data.shipping_receipt_url }} style={{ width: '90%', height: '80%', resizeMode: 'contain' }} />
            ) : null}
          </View>
        </Modal>

        {/* Report Problem Modal */}
        <Modal visible={isReporting} transparent={true} animationType="slide" onRequestClose={() => setIsReporting(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: colors.card || '#18181b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Report a Problem</Text>
                <TouchableOpacity onPress={() => setIsReporting(false)}>
                  <Ionicons name="close" size={24} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 16 }}>
                Select what issue you are experiencing with this order:
              </Text>

              {[
                'Item delayed or not delivered',
                'Received wrong or damaged item',
                'Seller / Buyer unresponsive',
                'Escrow release dispute',
                'Other issue'
              ].map((reason, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
                    borderRadius: 10, borderWidth: 1, borderColor: reportReason === reason ? '#ef4444' : colors.border,
                    backgroundColor: reportReason === reason ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    marginBottom: 8
                  }}
                  onPress={() => setReportReason(reason)}
                >
                  <Ionicons name={reportReason === reason ? "radio-button-on" : "radio-button-off"} size={18} color={reportReason === reason ? "#ef4444" : colors.textDim} />
                  <Text style={{ marginLeft: 10, fontSize: 14, fontWeight: reportReason === reason ? '700' : '500', color: reportReason === reason ? '#ef4444' : colors.text }}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 }}>Additional Details (Optional)</Text>
              <TextInput
                style={{
                  borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
                  color: colors.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top',
                  backgroundColor: colors.background
                }}
                placeholder="Describe the issue in detail..."
                placeholderTextColor={colors.textDim}
                multiline
                numberOfLines={3}
                value={reportDetails}
                onChangeText={setReportDetails}
              />

              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 }}>Your Phone Number (Required for follow up)</Text>
              <TextInput
                style={{
                  borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
                  color: colors.text, fontSize: 14, backgroundColor: colors.background
                }}
                placeholder="e.g. +255 712 345 678"
                placeholderTextColor={colors.textDim}
                value={reporterPhone}
                onChangeText={setReporterPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={{
                  backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 12,
                  alignItems: 'center', marginTop: 16
                }}
                onPress={handleReportProblem}
                disabled={submittingReport}
              >
                {submittingReport ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
