import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Image, FlatList,
  TouchableOpacity, Dimensions, Platform, useWindowDimensions,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { Skeleton } from '../../components/Skeleton'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../lib/auth'



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

export default function ShopDetailScreen() {
  const { width } = useWindowDimensions()
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width;
  const CARD = (feedWidth - 48) / 2;

  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  // We force a dark/black theme palette for this premium shop design
  const premiumColors = {
    background: '#000000',
    card: '#111111',
    border: '#222222',
    text: '#ffffff',
    textDim: '#a1a1aa',
    accent: '#10b981' // Keep a sleek green accent
  }
  const styles = React.useMemo(() => getStyles(premiumColors), [])
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([])
  const [loading, setLoading] = useState(true)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [isSavingReview, setIsSavingReview] = useState(false)

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
          // Increment views if not the owner
          if (user?.id && user.id !== data.owner_id) {
            supabase.from('shops').update({ views: (data.views || 0) + 1 }).eq('id', id).then()
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

    // Real-time subscription to shops table for rating updates
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

  const shopRating = shop?.rating || 0

  const isFoodShop = shop?.category === 'Food & Restaurants'
  const isServiceShop = shop?.category === 'Services & Freelance'
  const isListLayout = isFoodShop || isServiceShop

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
            <View style={styles.ratingTag}>
              <Ionicons name="star" size={12} color="#fbbf24" />
              <Text style={styles.ratingTagText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
          <View style={[styles.priceTag, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
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
        <View style={[styles.headerBar, { paddingTop: insets.top + 10, paddingBottom: 10, backgroundColor: premiumColors.background }]}>
          <BackButton />
          <Skeleton width={140} height={20} />
          <View style={{ width: 40 }} />
        </View>
        <Skeleton width="100%" height={320} borderRadius={0} />
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
        <View style={[styles.headerBar, { paddingTop: insets.top + 10, paddingBottom: 10, backgroundColor: premiumColors.background }]}>
          <BackButton />
          <Text style={styles.headerTitle}>Shop</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={52} color="#444" />
          <Text style={styles.errorText}>Shop not found.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Floating Header */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 10 }]}>
        <BackButton />
        <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
        {user?.id === shop.owner_id ? (
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => router.push(`/inventory/analytics?shopId=${shop.id}`)}
          >
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => shop.owner_id && router.push(`/chat?id=${shop.owner_id}&is_shop=true`)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={shop.products || []}
        key={isFoodShop ? 'food' : 'grid'}
        keyExtractor={(item, i) => item.id ?? String(i)}
        numColumns={isFoodShop ? 1 : 2}
        renderItem={renderProduct}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={isFoodShop ? undefined : styles.columnWrapper}
        ListHeaderComponent={
          <View style={{ paddingBottom: 16 }}>
            {/* Edge to Edge Cover Image */}
            <View style={styles.coverContainer}>
              {shop.cover_image ? (
                <Image source={{ uri: getCdnUrl(shop.cover_image) }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <Image source={{ uri: getCdnUrl('https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=1000&auto=format&fit=crop') }} style={styles.coverImage} resizeMode="cover" />
              )}
              {/* Dark Overlay for text readability */}
              <View style={[styles.coverGradient, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
              
              {/* Overlapping Avatar */}
              <View style={styles.avatarWrap}>
                {shop.avatar_image ? (
                  <Image source={{ uri: getCdnUrl(shop.avatar_image) }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Image source={{ uri: getCdnUrl('https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=400&auto=format&fit=crop') }} style={styles.avatarImage} resizeMode="cover" />
                )}
              </View>
            </View>

            {/* Shop Info Block */}
            <View style={styles.shopInfoBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Text style={[styles.shopName, { marginBottom: 0 }]}>{shop.name}</Text>
                {((shop.review_count || 0) >= 10 || shopRating >= 4.5) && (
                  <Ionicons name="checkmark-circle" size={20} color="#3b82f6" style={{ marginLeft: 6 }} />
                )}
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statBadge}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.statText}>{shopRating > 0 ? shopRating.toFixed(1) : 'New'}</Text>
                </View>
                <View style={styles.statBadge}>
                  <Ionicons name="cube-outline" size={14} color={premiumColors.textDim} />
                  <Text style={styles.statText}>{shop.products?.length || 0} items</Text>
                </View>
                <View style={styles.statBadge}>
                  <Ionicons name="chatbubbles-outline" size={14} color={premiumColors.textDim} />
                  <Text style={styles.statText}>{shop.review_count || 0} reviews</Text>
                </View>
                {shop.location_city && (
                  <View style={styles.statBadge}>
                    <Ionicons name="location-outline" size={14} color={premiumColors.textDim} />
                    <Text style={styles.statText}>{shop.location_city}</Text>
                  </View>
                )}
              </View>

              {shop.description ? (
                <Text style={styles.shopDesc}>{shop.description}</Text>
              ) : null}

              {/* Manage Inventory — visible to shop owner only */}
              {user && user.id === shop.owner_id && (
                <TouchableOpacity
                  style={styles.inventoryBtn}
                  onPress={() => router.push(`/inventory?shopId=${shop.id}`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="albums-outline" size={20} color="#fff" />
                  <Text style={styles.inventoryBtnText}>Manage Inventory</Text>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              {/* Review Button — visible to non-owners */}
              {user && user.id !== shop.owner_id && (
                <TouchableOpacity
                  style={[styles.inventoryBtn, { backgroundColor: '#3f3f46', marginTop: 12 }]}
                  onPress={() => setIsReviewing(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="star-outline" size={20} color="#fff" />
                  <Text style={styles.inventoryBtnText}>Write a Review</Text>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>
              {isServiceShop ? 'Services Provided' : (isFoodShop ? 'Menu' : 'Products')}
            </Text>

            {/* Coming Soon Banner */}
            <View style={{ marginHorizontal: 16, marginBottom: 24, backgroundColor: '#f59e0b', borderRadius: 16, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🚧</Text>
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>Marketplace Coming Soon</Text>
              <Text style={{ color: '#000', fontWeight: '500', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Our payment system is being finalized. Products will be available for purchase very soon!</Text>
            </View>

            {/* Reviews Section */}
            <View style={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 }}>
              <Text style={styles.sectionLabel}>Shop Reviews</Text>
              {shopReviews.length === 0 ? (
                <Text style={styles.errorText}>No reviews yet.</Text>
              ) : (
                shopReviews.map(rev => (
                  <View key={rev.id} style={{ backgroundColor: premiumColors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: premiumColors.border }}>
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                      {[1,2,3,4,5].map(star => (
                        <Ionicons key={star} name="star" size={14} color={star <= rev.rating ? "#fbbf24" : "#444"} />
                      ))}
                    </View>
                    {rev.comment && <Text style={{ color: premiumColors.text, fontSize: 15, marginBottom: 8 }}>{rev.comment}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: premiumColors.textDim, fontSize: 13, fontWeight: '600' }}>
                        {rev.profiles?.full_name || rev.profiles?.username || 'Anonymous'}
                      </Text>
                      <Text style={{ color: premiumColors.textDim, fontSize: 12 }}>{new Date(rev.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        }
      />

      {/* Review Modal */}
      <Modal visible={isReviewing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsReviewing(false)}>
        <View style={{ flex: 1, backgroundColor: premiumColors.background }}>
          <View style={[styles.headerBar, { borderBottomWidth: 0 }]}>
            <TouchableOpacity onPress={() => setIsReviewing(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={28} color={premiumColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Review Shop</Text>
            <TouchableOpacity onPress={submitReview} disabled={isSavingReview} style={{ padding: 8 }}>
              {isSavingReview ? <ActivityIndicator color={premiumColors.text} /> : <Text style={{ color: premiumColors.accent, fontWeight: '700', fontSize: 16 }}>Submit</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: premiumColors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Rating</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[1,2,3,4,5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Ionicons name={star <= reviewRating ? "star" : "star-outline"} size={40} color="#fbbf24" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: premiumColors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Comment (Optional)</Text>
              <TextInput 
                style={{ backgroundColor: premiumColors.card, borderRadius: 12, padding: 16, color: premiumColors.text, fontSize: 16, minHeight: 120, borderWidth: 1, borderColor: premiumColors.border }}
                multiline 
                value={reviewComment} 
                onChangeText={setReviewComment} 
                textAlignVertical="top" 
                placeholder="How was your experience?" 
                placeholderTextColor={premiumColors.textDim} 
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  errorText: { fontSize: 16, color: colors.textDim },

  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  messageBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  coverContainer: { position: 'relative', width: '100%', height: 280 },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  coverGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  
  avatarWrap: {
    position: 'absolute', bottom: -48, left: '50%', marginLeft: -48,
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 4, borderColor: colors.background,
    backgroundColor: colors.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 10,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 48 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#18181b' },
  avatarInitial: { fontSize: 36, fontWeight: '900', color: colors.text },

  shopInfoBlock: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24, alignItems: 'center' },
  shopName: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statBadge: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, gap: 6 
  },
  statText: { fontSize: 14, fontWeight: '700', color: colors.text },
  shopDesc: { fontSize: 15, color: colors.textDim, lineHeight: 22, fontWeight: '400', textAlign: 'center', marginBottom: 16, paddingHorizontal: 16 },

  divider: { height: 1, backgroundColor: '#222222', marginHorizontal: 24, marginBottom: 20, marginTop: 10 },
  sectionLabel: { fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: 24, marginBottom: 16 },

  inventoryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#10b981',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    marginTop: 16,
  },
  inventoryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 },

  listContent: { paddingBottom: 60 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },

  card: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  cardImageWrap: {
    width: '100%', aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  ratingTag: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    overflow: 'hidden',
  },
  ratingTagText: { color: '#fbbf24', fontSize: 12, fontWeight: '800' },
  priceTag: {
    position: 'absolute', bottom: 8, left: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    overflow: 'hidden',
  },
  priceText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  cardInfo: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
})
