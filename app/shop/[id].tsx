import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, Image, FlatList,
  TouchableOpacity, Dimensions, Platform, useWindowDimensions,
  Modal, TextInput, Animated, Alert, ActivityIndicator,
  ScrollView
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
  category?: string
}

interface ShopReview {
  id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
  profiles?: { full_name: string, username: string }
}

const COVER_HEIGHT = 260;

export default function ShopDetailScreen() {
  const { width } = useWindowDimensions()
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width;
  const CARD = (feedWidth - 48) / 2;

  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark])
  
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const supabase = createClient()
  const { user } = useAuth();
  
  const [shop, setShop] = useState<Shop | null>(null)
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([])
  const [shopRevenue, setShopRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState<'Products' | 'Reviews' | 'About'>('Products')
  
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [isSavingReview, setIsSavingReview] = useState(false)

  const [isReporting, setIsReporting] = useState(false)
  const [reportReason, setReportReason] = useState('Counterfeit or fake store')
  const [reportDetails, setReportDetails] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

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

  const handleReportProblem = async () => {
    if (!reportReason.trim()) return Alert.alert('Error', 'Please select a reason.')
    if (!reporterPhone.trim()) return Alert.alert('Error', 'Please enter your contact phone number so our team can follow up.')
    setSubmittingReport(true)
    try {
      const { error } = await supabase.from('problem_reports').insert({
        reporter_id: user?.id || null,
        target_type: 'shop',
        target_id: id as string,
        target_name: shop?.name || 'Shop Issue',
        reason: reportReason,
        details: reportDetails.trim() || null,
        reporter_phone: reporterPhone.trim() || null,
        seller_phone: shop?.contact_phone || null,
        shop_id: shop?.id || id as string,
        shop_name: shop?.name || 'Shop Issue',
        target_metadata: {
          shop_id: shop?.id || id,
          shop_name: shop?.name,
          owner_id: shop?.owner_id,
          contact_phone: shop?.contact_phone,
          tra_tin: shop?.tra_tin,
          category: shop?.category,
          city: shop?.location_city
        }
      })
      if (error) throw error
      Alert.alert('Report Submitted', 'Thank you. Our trust & safety team has received your report and attached phone contact.')
      setIsReporting(false)
      setReportDetails('')
      setReporterPhone('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingReport(false)
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

  // Safe import of LinearGradient
  let LinearGradient: any = View;
  try {
    LinearGradient = require('expo-linear-gradient').LinearGradient;
  } catch (e) {
    console.warn("expo-linear-gradient not found, using fallback view");
  }

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
            <Text style={[styles.foodItemPrice, item.out_of_stock && { color: '#ef4444' }]}>{item.out_of_stock ? 'Out of Stock' : item.price}</Text>
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
              <Ionicons name="cart-outline" size={32} color={colors.textDim} />
            </View>
          )}
          
          {item.rating > 0 && (
            <BlurView intensity={isDark ? 80 : 40} tint={isDark ? "dark" : "light"} style={styles.ratingGlass}>
              <Ionicons name="star" size={10} color="#fbbf24" />
              <Text style={styles.ratingTagText}>{item.rating.toFixed(1)}</Text>
            </BlurView>
          )}
          
          {LinearGradient !== View && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.cardGradient}
            />
          )}
          <View style={[styles.priceGlass, item.out_of_stock && { backgroundColor: 'rgba(239, 68, 68, 0.8)' }]}>
            <Text style={styles.priceText}>{item.out_of_stock ? 'Out of Stock' : item.price}</Text>
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
          <Ionicons name="storefront-outline" size={52} color={colors.textDim} />
          <Text style={styles.errorText}>This shop does not exist.</Text>
        </View>
      </View>
    )
  }

  const ListHeader = (
    <View style={{ paddingBottom: 16 }}>
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
        {LinearGradient !== View && (
          <LinearGradient
            colors={['transparent', colors.background]}
            style={styles.coverFade}
          />
        )}
      </Animated.View>

      {/* Profile Info Area */}
      <View style={styles.profileWrapper}>
        <View style={styles.avatarWrap}>
          <Image 
            source={{ uri: shop.avatar_image ? getCdnUrl(shop.avatar_image) : getCdnUrl('https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=400&auto=format&fit=crop') }} 
            style={styles.avatarImage} 
            resizeMode="cover" 
          />
        </View>
        
        <View style={styles.shopInfoContent}>
          <View style={styles.shopTitleRow}>
            <Text style={styles.shopName} numberOfLines={2}>{shop.name}</Text>
            {((shop.review_count || 0) >= 10 || shopRating >= 4.5) && (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={{ marginLeft: 6 }} />
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Ionicons name="star" size={16} color="#fbbf24" />
              <Text style={styles.statText}>{shopRating > 0 ? shopRating.toFixed(1) : 'New'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBadge}>
              <Ionicons name="cube" size={16} color={colors.primary} />
              <Text style={styles.statText}>{shop.products?.length || 0} items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBadge}>
              <Ionicons name="chatbubbles" size={16} color="#a855f7" />
              <Text style={styles.statText}>{shop.review_count || 0} reviews</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sticky Tabs */}
      <View style={styles.tabsRow}>
        {['Products', 'Reviews', 'About'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  const renderContent = () => {
    if (activeTab === 'Products') {
      if (!shop.products || shop.products.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyText}>No products found.</Text>
          </View>
        )
      }
      if (isListLayout) {
        return (
          <View style={{ paddingHorizontal: 16 }}>
            {shop.products.map((item, i) => <React.Fragment key={i}>{renderProduct({ item })}</React.Fragment>)}
          </View>
        )
      }
      return (
        <View style={styles.gridContainer}>
          {shop.products.map((item, i) => <React.Fragment key={i}>{renderProduct({ item })}</React.Fragment>)}
        </View>
      )
    }
    
    if (activeTab === 'Reviews') {
      if (shopReviews.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyText}>No reviews yet.</Text>
          </View>
        )
      }
      return (
        <View style={styles.reviewsSection}>
          {shopReviews.map(r => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>{r.profiles?.full_name || 'User'}</Text>
                <View style={{ flexDirection: 'row' }}>
                  {[1,2,3,4,5].map(star => (
                    <Ionicons key={star} name={star <= r.rating ? "star" : "star-outline"} size={12} color="#fbbf24" />
                  ))}
                </View>
              </View>
              {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )
    }

    if (activeTab === 'About') {
      return (
        <View style={styles.aboutSection}>
          <Text style={styles.aboutLabel}>About Shop</Text>
          <Text style={styles.aboutDesc}>{shop.description || 'No description provided.'}</Text>
          
          <View style={styles.aboutRow}>
            <View style={styles.aboutIconBox}>
              <Ionicons name="location" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.aboutRowLabel}>Location</Text>
              <Text style={styles.aboutRowText}>{shop.location_city || 'Not specified'}</Text>
            </View>
          </View>
          
          {isOwner && (
            <View style={styles.aboutRow}>
              <View style={[styles.aboutIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="cash" size={20} color="#10b981" />
              </View>
              <View>
                <Text style={styles.aboutRowLabel}>Total Revenue</Text>
                <Text style={[styles.aboutRowText, { color: '#10b981', fontWeight: '800' }]}>
                  TSH {shopRevenue.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>
      )
    }
    
    return null
  }

  return (
    <View style={styles.container}>
      {/* Animated Floating Header */}
      <Animated.View style={[
        styles.floatingHeader, 
        { 
          paddingTop: insets.top + 10,
          opacity: headerOpacity
        }
      ]}>
        <BlurView intensity={isDark ? 90 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={styles.floatingHeaderInner}>
          <BackButton />
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
          <View style={{ width: 40 }} />
        </View>
      </Animated.View>
      
      {/* Absolute Back Button */}
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
        <View style={styles.backBtnWrapper}>
          <BackButton />
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {ListHeader}
        {renderContent()}
      </Animated.ScrollView>
      
      {/* Action Buttons */}
      {user?.id === shop.owner_id ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/inventory/analytics?shopId=${shop.id}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="stats-chart" size={24} color={colors.background} />
          <Text style={[styles.fabText, { color: colors.background }]}>Analytics</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary, flex: 1, position: 'relative', right: 0, bottom: 0 }]}
            onPress={() => shop.owner_id && router.push(`/chat?id=${shop.owner_id}&is_shop=true`)}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubbles" size={24} color="#fff" />
            <Text style={[styles.fabText, { color: '#fff' }]}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reviewFab}
            onPress={() => setIsReviewing(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={24} color={colors.background} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reviewFab, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' }]}
            onPress={() => setIsReporting(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="flag" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Review Modal */}
      <Modal visible={isReviewing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Shop</Text>
              <TouchableOpacity onPress={() => setIsReviewing(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Ionicons name={star <= reviewRating ? "star" : "star-outline"} size={36} color="#fbbf24" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="How was your experience?" 
              placeholderTextColor={colors.textDim} 
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

      {/* Report Shop Modal */}
      <Modal visible={isReporting} transparent={true} animationType="slide" onRequestClose={() => setIsReporting(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.card || '#18181b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Report Shop / Seller</Text>
              <TouchableOpacity onPress={() => setIsReporting(false)}>
                <Ionicons name="close" size={24} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 16 }}>
              Why are you reporting this store or seller?
            </Text>

            {[
              'Counterfeit or fake store',
              'Seller unresponsive / order dispute',
              'Asking for off-platform escrow evasion',
              'Scam / fraudulent activity',
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
              placeholder="Describe what happened to help our team..."
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
    </View>
  )
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  staticHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border
  },
  
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 100, borderBottomWidth: 1, borderBottomColor: colors.border,
    overflow: 'hidden'
  },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10
  },
  
  absoluteBackButton: {
    position: 'absolute', left: 16, zIndex: 101,
  },
  backBtnWrapper: {
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 24, padding: 2
  },
  
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  errorText: { color: colors.textDim, fontSize: 16, marginTop: 16 },
  
  coverContainer: {
    width: '100%', height: COVER_HEIGHT,
    backgroundColor: colors.border, position: 'absolute', top: 0, left: 0, right: 0
  },
  coverImage: { width: '100%', height: '100%' },
  coverFade: {
    position: 'absolute', bottom: -1, left: 0, right: 0, height: 100,
  },

  profileWrapper: {
    marginTop: COVER_HEIGHT - 60,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 10
  },
  avatarWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.background,
    padding: 4, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 10,
    marginBottom: 16
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 46 },
  
  shopInfoContent: {
    alignItems: 'center',
    width: '100%'
  },
  shopTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  shopName: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.5, textAlign: 'center' },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  statDivider: { width: 1, height: 20, backgroundColor: colors.border },
  statText: { fontSize: 15, fontWeight: '800', color: colors.text },
  
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 20, gap: 12,
    justifyContent: 'center'
  },
  tabBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border
  },
  tabBtnActive: {
    backgroundColor: colors.text, borderColor: colors.text
  },
  tabText: {
    fontSize: 15, fontWeight: '700', color: colors.textDim
  },
  tabTextActive: {
    color: colors.background
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: colors.textDim, fontWeight: '600', marginTop: 12 },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 16, justifyContent: 'space-between' },
  
  card: { backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  cardImageWrap: { width: '100%', aspectRatio: 1, backgroundColor: colors.border },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  
  ratingGlass: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden'
  },
  ratingTagText: { color: isDark ? '#fff' : '#000', fontSize: 12, fontWeight: '800' },
  
  priceGlass: {
    position: 'absolute', bottom: 10, left: 12, right: 12,
  },
  priceText: { color: '#fff', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 3 },
  
  cardInfo: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  
  foodItemCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  foodItemInfo: { flex: 1, paddingRight: 16, justifyContent: 'center' },
  foodItemName: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  foodItemDesc: { fontSize: 13, color: colors.textDim, marginBottom: 8, lineHeight: 18 },
  foodItemPrice: { fontSize: 16, fontWeight: '900', color: colors.primary },
  foodItemImage: { width: 100, height: 100, borderRadius: 16, backgroundColor: colors.border },
  
  reviewsSection: { paddingHorizontal: 16 },
  reviewCard: { backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  reviewName: { fontSize: 16, fontWeight: '800', color: colors.text },
  reviewComment: { fontSize: 14, color: colors.textDim, marginBottom: 10, lineHeight: 22 },
  reviewDate: { fontSize: 12, color: colors.textDim, fontWeight: '600' },

  aboutSection: { paddingHorizontal: 20 },
  aboutLabel: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  aboutDesc: { fontSize: 15, color: colors.textDim, lineHeight: 24, marginBottom: 24 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  aboutIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  aboutRowLabel: { fontSize: 13, color: colors.textDim, fontWeight: '600', marginBottom: 2 },
  aboutRowText: { fontSize: 16, color: colors.text, fontWeight: '700' },
  
  bottomActions: {
    position: 'absolute', bottom: 30, left: 16, right: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center'
  },
  fab: {
    backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 24, height: 56, borderRadius: 28,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  reviewFab: {
    backgroundColor: colors.text, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8
  },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 },
  reviewInput: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    color: colors.text, fontSize: 16, height: 120, marginBottom: 24, borderWidth: 1, borderColor: colors.border
  },
  submitReviewBtn: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitReviewBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
})
