import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, Image, FlatList,
  TouchableOpacity, Dimensions, Platform, useWindowDimensions,
  Modal, TextInput, Animated, Alert, ActivityIndicator
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { Skeleton } from '../../components/Skeleton'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../lib/auth'
import { BlurView } from 'expo-blur'

interface Shop {
  id: string
  name: string
  description?: string
  location_city?: string
  cover_image?: string
  avatar_image?: string
  owner_id: string
  products: any[]
  rating?: number
  review_count?: number
}

interface ShopReview {
  id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
}

const COVER_HEIGHT = 280;

export default function ShopDetailScreen() {
  const { width } = useWindowDimensions()
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width;
  const CARD = (feedWidth - 48) / 2;

  const { isDark } = useTheme();
  const { user } = useAuth();
  
  // Premium Dark Mode palette
  const premiumColors = {
    background: '#0a0a0a',
    card: '#141414',
    border: '#2a2a2a',
    text: '#ffffff',
    textDim: '#a1a1aa',
    accent: '#3b82f6',
    gold: '#fbbf24'
  }
  
  const styles = React.useMemo(() => getStyles(premiumColors), [])
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const supabase = createClient()
  
  const [shop, setShop] = useState<Shop | null>(null)
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([])
  const [shopRevenue, setShopRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [isSavingReview, setIsSavingReview] = useState(false)

  const scrollY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!id) return
    supabase
      .from('shops')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setShop(data)
          if (user?.id && user.id !== data.owner_id) {
            supabase.from('shops').update({ views: (data.views || 0) + 1 }).eq('id', id).then()
          } else if (user?.id === data.owner_id) {
            supabase.from('order_items').select('price, quantity').eq('shop_id', id).then(({ data: items }) => {
              if (items) {
                const total = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0)
                setShopRevenue(total)
              }
            })
          }
        }
        setLoading(false)
      })

    const fetchReviews = async () => {
      const { data } = await supabase.from('shop_reviews')
        .select('*, profiles(full_name, username)')
        .eq('shop_id', id)
        .order('created_at', { ascending: false })
      if (data) setShopReviews(data)
    }
    fetchReviews()

    const channel = supabase.channel(`shop_${id}_${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops', filter: `id=eq.${id}` }, (payload) => {
        setShop(prev => prev ? { ...prev, ...payload.new } : null)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_reviews', filter: `shop_id=eq.${id}` }, () => {
        fetchReviews()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, user])

  const submitReview = async () => {
    if (!user) return Alert.alert('Error', 'Please log in to leave a review.')
    setIsSavingReview(true)
    try {
      const { error } = await supabase.from('shop_reviews').insert({
        shop_id: id,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment
      })
      if (error) throw error
      Alert.alert('Success', 'Thank you for your review!')
      setIsReviewing(false)
      setReviewComment('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setIsSavingReview(false)
    }
  }

  const isOwner = Boolean(user?.id && shop?.owner_id && user.id === shop.owner_id)
  const shopRating = shop?.rating || 0
  const isFoodShop = shop?.category === 'Food & Restaurants'
  const isServiceShop = shop?.category === 'Services & Freelance'
  const isListLayout = isFoodShop || isServiceShop

  const coverTranslateY = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0, COVER_HEIGHT],
    outputRange: [-COVER_HEIGHT / 2, 0, COVER_HEIGHT * 0.75],
    extrapolate: 'clamp'
  })
  
  const coverScale = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0],
    outputRange: [2, 1],
    extrapolate: 'clamp'
  })

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT - 100, COVER_HEIGHT - 50],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp'
  })

  const renderProduct = ({ item }: { item: any }) => {
    const hasImage = item.image_urls && item.image_urls.length > 0
    
    if (isListLayout) {
      return (
        <TouchableOpacity
          style={styles.foodItemCard}
          onPress={() => router.push(`/product/${item.id}?shopId=${id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.foodItemInfo}>
            <Text style={styles.foodItemName} numberOfLines={2}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.foodItemDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <Text style={styles.foodItemPrice}>{item.price}</Text>
          </View>
          {hasImage && (
            <Image source={{ uri: getCdnUrl(item.image_urls[0]) }} style={styles.foodItemImage} resizeMode="cover" />
          )}
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD }]}
        onPress={() => router.push(`/product/${item.id}?shopId=${id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardImageWrap}>
          {hasImage ? (
            <Image source={{ uri: getCdnUrl(item.image_urls[0]) }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImage, styles.cardPlaceholder]}>
              <Ionicons name="cart-outline" size={32} color="#444" />
            </View>
          )}
          
          {item.rating > 0 && (
            <BlurView intensity={80} tint="dark" style={styles.ratingGlass}>
              <Ionicons name="star" size={10} color={premiumColors.gold} />
              <Text style={styles.ratingTagText}>{item.rating.toFixed(1)}</Text>
            </BlurView>
          )}
          
          <BlurView intensity={80} tint="dark" style={styles.priceGlass}>
            <Text style={styles.priceText}>{item.price}</Text>
          </BlurView>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.staticHeader, { paddingTop: insets.top + 10 }]}>
          <BackButton />
          <Skeleton width={140} height={20} />
          <View style={{ width: 40 }} />
        </View>
        <Skeleton width="100%" height={COVER_HEIGHT} borderRadius={0} />
        <View style={{ padding: 24, gap: 12 }}>
          <Skeleton width={160} height={28} />
          <Skeleton width={100} height={16} />
          <Skeleton width="90%" height={16} />
        </View>
      </View>
    )
  }

  if (!shop) {
    return (
      <View style={styles.container}>
        <View style={[styles.staticHeader, { paddingTop: insets.top + 10 }]}>
          <BackButton />
          <Text style={styles.headerTitle}>Shop Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={52} color="#444" />
          <Text style={styles.errorText}>This shop does not exist.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Animated Floating Header (Appears on scroll) */}
      <Animated.View style={[
        styles.floatingHeader, 
        { 
          paddingTop: insets.top + 10,
          opacity: headerOpacity
        }
      ]}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.floatingHeaderInner}>
          <BackButton />
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
          <View style={{ width: 40 }} />
        </View>
      </Animated.View>
      
      {/* Back Button (Always visible at top when not scrolled) */}
      <Animated.View style={[
        styles.absoluteBackButton,
        { 
          top: insets.top + 10,
          opacity: scrollY.interpolate({
            inputRange: [0, COVER_HEIGHT - 100],
            outputRange: [1, 0],
            extrapolate: 'clamp'
          })
        }
      ]}>
        <BackButton />
      </Animated.View>

      <Animated.FlatList
        data={shop.products || []}
        key={isFoodShop ? 'food' : 'grid'}
        keyExtractor={(item, i) => item.id ?? String(i)}
        numColumns={isFoodShop ? 1 : 2}
        renderItem={renderProduct}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={isFoodShop ? undefined : styles.columnWrapper}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={{ paddingBottom: 24 }}>
            
            {/* Parallax Cover Image */}
            <Animated.View style={[
              styles.coverContainer,
              {
                transform: [
                  { translateY: coverTranslateY },
                  { scale: coverScale }
                ]
              }
            ]}>
              <Image 
                source={{ uri: shop.cover_image ? getCdnUrl(shop.cover_image) : getCdnUrl('https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=1000&auto=format&fit=crop') }} 
                style={styles.coverImage} 
                resizeMode="cover" 
              />
              {/* Fade out bottom of cover */}
              <View style={styles.coverFade} />
            </Animated.View>

            {/* Glassmorphic Info Card */}
            <View style={styles.glassCardWrapper}>
              <View style={{ position: 'relative' }}>
                <BlurView intensity={70} tint="dark" style={styles.glassCard}>
                  
                  <View style={styles.shopInfoContent}>
                    <View style={styles.shopTitleRow}>
                      <Text style={styles.shopName} numberOfLines={2}>{shop.name}</Text>
                      {((shop.review_count || 0) >= 10 || shopRating >= 4.5) && (
                        <Ionicons name="checkmark-circle" size={22} color={premiumColors.accent} style={{ marginLeft: 6 }} />
                      )}
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statBadge}>
                        <Ionicons name="star" size={14} color={premiumColors.gold} />
                        <Text style={styles.statText}>{shopRating > 0 ? shopRating.toFixed(1) : 'New'}</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statBadge}>
                        <Ionicons name="cube" size={14} color={premiumColors.accent} />
                        <Text style={styles.statText}>{shop.products?.length || 0} items</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statBadge}>
                        <Ionicons name="chatbubbles" size={14} color="#8b5cf6" />
                        <Text style={styles.statText}>{shop.review_count || 0} reviews</Text>
                      </View>
                      {isOwner && (
                        <>
                          <View style={styles.statDivider} />
                          <View style={styles.statBadge}>
                            <Ionicons name="cash" size={14} color="#10b981" />
                            <Text style={styles.statText}>TSH {shopRevenue.toLocaleString()}</Text>
                          </View>
                        </>
                      )}
                    </View>

                    {shop.description && (
                      <Text style={styles.shopDesc}>{shop.description}</Text>
                    )}
                    {shop.location_city && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={14} color={premiumColors.textDim} />
                        <Text style={styles.locationText}>{shop.location_city}</Text>
                      </View>
                    )}
                  </View>
                </BlurView>
                
                {/* Floating Avatar - Outside BlurView to avoid overflow: hidden clipping */}
                <View style={styles.avatarWrap}>
                  <Image 
                    source={{ uri: shop.avatar_image ? getCdnUrl(shop.avatar_image) : getCdnUrl('https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=400&auto=format&fit=crop') }} 
                    style={styles.avatarImage} 
                    resizeMode="cover" 
                  />
                </View>
              </View>
            </View>

            {/* Section Divider */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Products</Text>
              <View style={styles.sectionLine} />
            </View>

          </View>
        }
        ListFooterComponent={
          shopReviews.length > 0 ? (
            <View style={styles.reviewsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <View style={styles.sectionLine} />
              </View>
              {shopReviews.map(r => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{(r as any).profiles?.full_name || 'User'}</Text>
                    <View style={{ flexDirection: 'row' }}>
                      {[1,2,3,4,5].map(star => (
                        <Ionicons key={star} name={star <= r.rating ? "star" : "star-outline"} size={12} color={premiumColors.gold} />
                      ))}
                    </View>
                  </View>
                  {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                  <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          ) : <View style={{ height: 80 }} />
        }
      />
      
      {/* Massive Bold Floating Action Button */}
      {user?.id === shop.owner_id ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/inventory/analytics?shopId=${shop.id}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="stats-chart" size={24} color="#fff" />
          <Text style={styles.fabText}>Analytics</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: premiumColors.accent }]}
          onPress={() => shop.owner_id && router.push(`/chat?id=${shop.owner_id}&is_shop=true`)}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles" size={24} color="#fff" />
          <Text style={styles.fabText}>Message Shop</Text>
        </TouchableOpacity>
      )}

      {/* Review Floating Button (If Not Owner) */}
      {user?.id !== shop.owner_id && (
        <TouchableOpacity
          style={styles.reviewFab}
          onPress={() => setIsReviewing(true)}
        >
          <Ionicons name="pencil" size={20} color="#000" />
        </TouchableOpacity>
      )}

      <Modal visible={isReviewing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Shop</Text>
              <TouchableOpacity onPress={() => setIsReviewing(false)}>
                <Ionicons name="close" size={24} color={premiumColors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Ionicons name={star <= reviewRating ? "star" : "star-outline"} size={36} color={premiumColors.gold} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="How was your experience?" 
              placeholderTextColor={premiumColors.textDim} 
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.submitReviewBtn} onPress={submitReview} disabled={isSavingReview}>
              {isSavingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitReviewBtnText}>Submit Review</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const getStyles = (premiumColors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: premiumColors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  staticHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: premiumColors.background,
    borderBottomWidth: 1, borderBottomColor: premiumColors.border
  },
  
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 100, borderBottomWidth: 1, borderBottomColor: premiumColors.border,
    overflow: 'hidden'
  },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10
  },
  
  absoluteBackButton: {
    position: 'absolute', left: 16, zIndex: 101,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20
  },
  
  headerTitle: { fontSize: 18, fontWeight: '800', color: premiumColors.text },
  errorText: { color: premiumColors.textDim, fontSize: 16, marginTop: 16 },
  
  listContent: { paddingBottom: 100 },
  
  coverContainer: {
    width: '100%', height: COVER_HEIGHT,
    backgroundColor: '#0a0a0a', position: 'absolute', top: 0, left: 0, right: 0
  },
  coverImage: { width: '100%', height: '100%' },
  coverFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(10,10,10,0.7)',
  },

  glassCardWrapper: {
    paddingHorizontal: 16,
    marginTop: COVER_HEIGHT - 60,
  },
  glassCard: {
    borderRadius: 24, padding: 20, paddingTop: 40,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  
  avatarWrap: {
    position: 'absolute', top: -40, left: 24,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: premiumColors.background,
    padding: 3, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 37 },
  
  shopInfoContent: {
    marginTop: 10
  },
  shopTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  shopName: { fontSize: 24, fontWeight: '900', color: premiumColors.text, letterSpacing: -0.5, flexShrink: 1 },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start', padding: 8, borderRadius: 12, marginBottom: 16 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  statDivider: { width: 1, height: 12, backgroundColor: premiumColors.textDim, opacity: 0.5 },
  statText: { fontSize: 14, fontWeight: '700', color: premiumColors.text },
  
  shopDesc: { fontSize: 15, color: premiumColors.textDim, lineHeight: 22, marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 14, color: premiumColors.textDim, fontWeight: '500' },
  
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: premiumColors.text, marginRight: 12 },
  sectionLine: { flex: 1, height: 1, backgroundColor: premiumColors.border },
  
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  
  card: { backgroundColor: premiumColors.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: premiumColors.border },
  cardImageWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#0a0a0a' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  
  ratingGlass: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden'
  },
  ratingTagText: { color: premiumColors.text, fontSize: 12, fontWeight: '800' },
  
  priceGlass: {
    position: 'absolute', bottom: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden'
  },
  priceText: { color: premiumColors.text, fontSize: 13, fontWeight: '900' },
  
  cardInfo: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '600', color: premiumColors.text, lineHeight: 20 },
  
  foodItemCard: { flexDirection: 'row', backgroundColor: premiumColors.card, borderRadius: 20, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: premiumColors.border },
  foodItemInfo: { flex: 1, paddingRight: 16 },
  foodItemName: { fontSize: 16, fontWeight: '700', color: premiumColors.text, marginBottom: 6 },
  foodItemDesc: { fontSize: 13, color: premiumColors.textDim, marginBottom: 12, lineHeight: 18 },
  foodItemPrice: { fontSize: 16, fontWeight: '900', color: premiumColors.text },
  foodItemImage: { width: 90, height: 90, borderRadius: 16, backgroundColor: '#0a0a0a' },
  
  reviewsSection: { paddingHorizontal: 16, paddingBottom: 80 },
  reviewCard: { backgroundColor: premiumColors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: premiumColors.border },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewName: { fontSize: 15, fontWeight: '700', color: premiumColors.text },
  reviewComment: { fontSize: 14, color: premiumColors.textDim, marginBottom: 8, lineHeight: 20 },
  reviewDate: { fontSize: 12, color: premiumColors.textDim, opacity: 0.5 },
  
  fab: {
    position: 'absolute', bottom: 30, right: 24,
    backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 16, borderRadius: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  reviewFab: {
    position: 'absolute', bottom: 30, right: 190,
    backgroundColor: '#fff', width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6
  },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: premiumColors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: premiumColors.text },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 },
  reviewInput: {
    backgroundColor: premiumColors.background, borderRadius: 16, padding: 16,
    color: premiumColors.text, fontSize: 16, height: 120, marginBottom: 24, borderWidth: 1, borderColor: premiumColors.border
  },
  submitReviewBtn: { backgroundColor: premiumColors.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitReviewBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
})
