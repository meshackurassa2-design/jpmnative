import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Animated, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { BackButton } from '../../components/BackButton'

const { width } = Dimensions.get('window')

export default function AnalyticsScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>()
  const supabase = createClient()
  
  const [stats, setStats] = useState({
    views: 0,
    orders: 0,
    wishlisted: 0,
    revenue: 0
  })
  const [loading, setLoading] = useState(true)
  const anims = useRef([...Array(7)].map(() => new Animated.Value(0))).current

  useEffect(() => {
    if (!shopId) return
    
    // Fetch real views and orders, and simulate some chart data
    const fetchData = async () => {
      // 1. Get shop views
      const { data: shop } = await supabase.from('shops').select('views').eq('id', shopId).single()
      
      // 2. Get total orders and revenue
      const { data: orderItems } = await supabase.from('order_items').select('order_id, price, quantity').eq('shop_id', shopId)
      const totalRevenue = orderItems?.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0) || 0
      const uniqueOrders = new Set(orderItems?.map(item => item.order_id)).size
      
      // 3. Get total wishlists
      const { count: wishlistCount } = await supabase.from('wishlists').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)

      setStats({
        views: shop?.views || 0,
        orders: uniqueOrders || 0,
        wishlisted: wishlistCount || 0,
        revenue: totalRevenue
      })
      setLoading(false)

      // Trigger chart animations
      Animated.stagger(100, anims.map(anim => 
        Animated.spring(anim, {
          toValue: Math.random() * 120 + 20, // Height in pixels (max ~140)
          useNativeDriver: false,
          bounciness: 8
        })
      )).start()
    }
    
    fetchData()
  }, [shopId])

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Metric Cards */}
        <View style={styles.grid}>
          <View style={[styles.card, { borderTopColor: '#6366f1', borderTopWidth: 3 }]}>
            <Ionicons name="eye" size={24} color="#6366f1" />
            <Text style={styles.cardValue}>{loading ? '--' : stats.views}</Text>
            <Text style={styles.cardLabel}>Total Views</Text>
          </View>
          
          <View style={[styles.card, { borderTopColor: '#ec4899', borderTopWidth: 3 }]}>
            <Ionicons name="heart" size={24} color="#ec4899" />
            <Text style={styles.cardValue}>{loading ? '--' : stats.wishlisted}</Text>
            <Text style={styles.cardLabel}>Wishlisted</Text>
          </View>
          
          <View style={[styles.card, { borderTopColor: '#10b981', borderTopWidth: 3 }]}>
            <Ionicons name="cash" size={24} color="#10b981" />
            <Text style={styles.cardValue}>{loading ? '--' : `$${stats.revenue.toFixed(2)}`}</Text>
            <Text style={styles.cardLabel}>Revenue</Text>
          </View>
          
          <View style={[styles.card, { borderTopColor: '#f59e0b', borderTopWidth: 3 }]}>
            <Ionicons name="cube" size={24} color="#f59e0b" />
            <Text style={styles.cardValue}>{loading ? '--' : stats.orders}</Text>
            <Text style={styles.cardLabel}>Orders</Text>
          </View>
        </View>

        {/* Animated Chart */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Weekly Traffic</Text>
            <Text style={styles.chartSubtitle}>Simulated Data</Text>
          </View>
          
          <View style={styles.chart}>
            {days.map((day, i) => (
              <View key={day} style={styles.barWrapper}>
                <View style={styles.barBackground}>
                  <Animated.View 
                    style={[
                      styles.barFill, 
                      { height: anims[i].interpolate({ inputRange: [0, 150], outputRange: [0, 120], extrapolate: 'clamp' }) }
                    ]} 
                  />
                </View>
                <Text style={styles.dayLabel}>{day}</Text>
              </View>
            ))}
          </View>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  content: { padding: 16, gap: 24 },
  
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  card: {
    width: (width - 48) / 2,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222'
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4
  },
  cardLabel: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '600'
  },

  chartContainer: {
    paddingVertical: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32
  },
  chartTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  chartSubtitle: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150
  },
  barWrapper: {
    alignItems: 'center',
    gap: 12
  },
  barBackground: {
    width: 24,
    height: 120,
    backgroundColor: 'transparent',
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 12
  },
  dayLabel: {
    fontSize: 12,
    color: '#71717a',
    fontWeight: '600'
  }
})
