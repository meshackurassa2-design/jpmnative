import { getCdnUrl } from '../lib/cdn';
import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, Image, Dimensions, Animated, PanResponder, TouchableOpacity
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

const { width, height } = Dimensions.get('window')
const SWIPE_THRESHOLD = width * 0.25

export default function DiscoverScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const supabase = createClient()
  const { user } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const position = useRef(new Animated.ValueXY()).current
  const [heartOpacity] = useState(new Animated.Value(0))

  useEffect(() => {
    // Fetch products from all shops
    supabase.from('shops').select('id, name, products')
      .then(({ data }) => {
        if (data) {
          const allProducts: any[] = []
          data.forEach(shop => {
            if (shop.products) {
              shop.products.forEach((p: any) => {
                allProducts.push({ ...p, shop_id: shop.id, shop_name: shop.name })
              })
            }
          })
          // Shuffle and prioritize promoted
          const now = new Date().getTime()
          const sorted = allProducts.sort((a, b) => {
            const aPromoted = a.is_promoted && new Date(a.promoted_until).getTime() > now ? 1 : 0
            const bPromoted = b.is_promoted && new Date(b.promoted_until).getTime() > now ? 1 : 0
            if (aPromoted !== bPromoted) return bPromoted - aPromoted
            return 0.5 - Math.random()
          })
          setProducts(sorted)
        }
        setLoading(false)
      })
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy })
      },
      onPanResponderRelease: (event, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right')
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left')
        } else {
          resetPosition()
        }
      }
    })
  ).current

  const forceSwipe = (direction: 'right' | 'left') => {
    const x = direction === 'right' ? width * 1.5 : -width * 1.5
    Animated.timing(position, {
      toValue: { x, y: direction === 'right' ? -100 : 0 },
      duration: 250,
      useNativeDriver: false
    }).start(() => onSwipeComplete(direction))
  }

  const onSwipeComplete = (direction: 'right' | 'left') => {
    const item = products[currentIndex]
    
    if (!item) return

    if (direction === 'right') {
      // Add to wishlist
      handleLike(item)
    }

    position.setValue({ x: 0, y: 0 })
    setCurrentIndex(prev => prev + 1)
  }

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      bounciness: 15,
      useNativeDriver: false
    }).start()
  }

  const handleLike = async (item: any) => {
    if (!item || !item.id) return
    
    // Heart animation
    Animated.sequence([
      Animated.timing(heartOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(heartOpacity, { toValue: 0, duration: 300, delay: 200, useNativeDriver: true })
    ]).start()

    if (!user) return
    
    try {
      const { data } = await supabase.from('wishlists').select('id').eq('user_id', user.id).eq('product_id', item.id).single()
      if (!data) {
        await supabase.from('wishlists').insert({
          user_id: user.id,
          product_id: item.id,
          shop_id: item.shop_id,
          product_data: item
        })
      }
    } catch (e) {
      console.warn("Failed to add to wishlist", e)
    }
  }

  const renderCards = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Finding best products...</Text>
        </View>
      )
    }

    if (currentIndex >= products.length) {
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
          <Text style={styles.doneText}>You've seen everything!</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back to Marketplace</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return products.map((item, i) => {
      if (i < currentIndex) return null

      if (i === currentIndex) {
        return (
          <Animated.View
            key={item?.id || `current-${i}`}
            style={[styles.cardContainer, { 
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: position.x.interpolate({ inputRange: [-width, width], outputRange: ['-10deg', '10deg'] }) }
              ] 
            }]}
            {...panResponder.panHandlers}
          >
            {renderCard(item)}
            
            <Animated.View style={[styles.likeBadge, { opacity: position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
              <Text style={styles.likeBadgeText}>WISH</Text>
            </Animated.View>
            <Animated.View style={[styles.nopeBadge, { opacity: position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
              <Text style={styles.nopeBadgeText}>PASS</Text>
            </Animated.View>
          </Animated.View>
        )
      }

      // Next card peeking behind
      if (i === currentIndex + 1) {
        return (
          <Animated.View
            key={item?.id || `next-${i}`}
            style={[styles.cardContainer, {
              top: 10,
              transform: [{ scale: position.x.interpolate({ inputRange: [-width/2, 0, width/2], outputRange: [1, 0.95, 1], extrapolate: 'clamp' }) }]
            }]}
          >
            {renderCard(item)}
          </Animated.View>
        )
      }

      return null
    }).reverse()
  }

  const renderCard = (item: any) => {
    if (!item) return null
    const hasImage = item.image_urls && item.image_urls.length > 0
    const isPromoted = item.is_promoted && new Date(item.promoted_until).getTime() > new Date().getTime()
    return (
      <View style={styles.card}>
        {isPromoted && (
          <View style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="rocket" size={14} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800', marginLeft: 4 }}>PROMOTED</Text>
          </View>
        )}
        {hasImage ? (
          <Image source={{ uri: getCdnUrl(item.image_urls[0]) }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="cart" size={60} color={colors.textDim} />
          </View>
        )}
        <View style={styles.gradient} />
        
        <View style={styles.info}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.shopName}>{item.shop_name}</Text>
              {(item.review_count >= 10 || item.rating >= 4.5) && (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4, marginBottom: 4 }} />
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.price}>{item.price}</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Discover</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.deckContainer}>
        {renderCards()}
      </View>

      {/* Floating Heart animation on swipe right */}
      <Animated.View pointerEvents="none" style={[styles.floatingHeart, { opacity: heartOpacity }]}>
        <Ionicons name="heart" size={100} color={colors.primary} />
      </Animated.View>
      
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => forceSwipe('left')}>
          <Ionicons name="close" size={32} color="#ef4444" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={() => { forceSwipe('right'); handleLike(products[currentIndex]); }}>
          <Ionicons name="heart" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, zIndex: 10 },
  closeBtn: { padding: 8, backgroundColor: colors.border, borderRadius: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  
  deckContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  cardContainer: { position: 'absolute', width: width * 0.9, height: height * 0.65, zIndex: 1 },
  card: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  image: { width: '100%', height: '100%' },
  
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', backgroundColor: colors.isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)' },
  
  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, flexDirection: 'column', alignItems: 'flex-start' },
  shopName: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: '#ffffff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  priceTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignSelf: 'flex-start' },
  price: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  
  likeBadge: { position: 'absolute', top: 40, left: 40, zIndex: 10, borderWidth: 4, borderColor: colors.primary, borderRadius: 10, padding: 8, transform: [{ rotate: '-20deg' }] },
  likeBadgeText: { color: colors.primary, fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  
  nopeBadge: { position: 'absolute', top: 40, right: 40, zIndex: 10, borderWidth: 4, borderColor: '#ef4444', borderRadius: 10, padding: 8, transform: [{ rotate: '20deg' }] },
  nopeBadgeText: { color: '#ef4444', fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  
  floatingHeart: { position: 'absolute', top: height * 0.4, left: width * 0.5 - 50, zIndex: 100 },
  
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingBottom: 40, paddingTop: 20 },
  controlBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: colors.text, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  doneText: { color: colors.text, fontSize: 24, fontWeight: '800' },
  backBtn: { marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  backBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
})
