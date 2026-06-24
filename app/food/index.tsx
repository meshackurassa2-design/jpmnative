import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { Skeleton } from '../../components/Skeleton'

const { width } = Dimensions.get('window');

export default function FoodHubScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [restaurants, setRestaurants] = useState<any[]>([])

  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('status', 'active')
        .eq('category', 'Food & Restaurants')
        .order('rating', { ascending: false })

      if (data && !error) {
        setRestaurants(data)
      }
      setLoading(false)
    }
    fetchRestaurants()
  }, [])

  const renderRestaurant = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.restaurantCard}
      activeOpacity={0.8}
      onPress={() => router.push(`/shop/${item.id}`)}
    >
      <View style={styles.imageContainer}>
        {item.banner_url ? (
          <Image source={{ uri: getCdnUrl(item.banner_url) }} style={styles.bannerImage} />
        ) : (
          <View style={[styles.bannerImage, styles.placeholderImg]}>
            <Ionicons name="restaurant-outline" size={40} color="#a1a1aa" />
          </View>
        )}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#fbbf24" />
          <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : 'New'}</Text>
        </View>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.shopDesc} numberOfLines={1}>{item.description || 'Delicious food delivered to you'}</Text>
        
        <View style={styles.footerRow}>
          <View style={styles.infoPill}>
            <Ionicons name="time-outline" size={12} color={colors.textDim} />
            <Text style={styles.infoPillText}>20-30 min</Text>
          </View>
          {item.location_city ? (
            <View style={styles.infoPill}>
              <Ionicons name="location-outline" size={12} color={colors.textDim} />
              <Text style={styles.infoPillText}>{item.location_city}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ marginBottom: 20 }}>
              <Skeleton width="100%" height={160} borderRadius={16} style={{ marginBottom: 12 }} />
              <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
              <Skeleton width="40%" height={16} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={item => item.id}
          renderItem={renderRestaurant}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🍽️</Text>
              <Text style={styles.emptyTitle}>No Restaurants Yet</Text>
              <Text style={styles.emptyDesc}>
                Be the first to open a food shop! Go to the marketplace and tap "Open a Shop".
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  listContent: { padding: 16, paddingBottom: 40 },
  
  restaurantCard: {
    backgroundColor: colors.card || '#111',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  imageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: colors.border,
    position: 'relative'
  },
  bannerImage: { width: '100%', height: '100%' },
  placeholderImg: { justifyContent: 'center', alignItems: 'center' },
  ratingBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3
  },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  infoContainer: { padding: 16 },
  shopName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  shopDesc: { fontSize: 14, color: colors.textDim, marginBottom: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8
  },
  infoPillText: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: colors.textDim, textAlign: 'center', lineHeight: 22 }
})
