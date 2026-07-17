import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Platform, useWindowDimensions,
  Modal, TextInput, Switch
} from 'react-native'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCart } from '../../lib/cart'
import { createClient } from '../../lib/supabase'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../lib/auth'
import * as ImagePicker from 'expo-image-picker'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { PhotoEditor } from '../../components/PhotoEditor'
import * as FileSystem from 'expo-file-system/legacy'


interface Product {
  id: string
  name: string
  price: string
  description?: string
  image_urls?: string[]
  category?: string
  size?: string
  condition?: string
  shopId: string
  shopName: string
  shopCity: string
  owner_id: string
  settings?: any
  rating?: number
  review_count?: number
}

interface Review {
  id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
}

const FlashSaleCountdown = () => {
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999) // Flash sale ends at midnight
    return Math.floor((end.getTime() - now.getTime()) / 1000)
  })

  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const h = Math.floor(timeLeft / 3600)
  const m = Math.floor((timeLeft % 3600) / 60)
  const s = timeLeft % 60
  const format = (n: number) => n.toString().padStart(2, '0')

  return (
    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>
      Ends in {format(h)}:{format(m)}:{format(s)}
    </Text>
  )
}

export default function ProductDetailScreen() {
  const { width } = useWindowDimensions();
  const feedWidth = Platform.OS === 'web' && width >= 768 ? Math.min(width, 600) : width;
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { id, shopId, review } = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const supabase = createClient()
  const { items, addToCart } = useCart()
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const [isMakingOffer, setIsMakingOffer] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')

  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [isWishlisted, setIsWishlisted] = useState(false)

  const [isReporting, setIsReporting] = useState(false)
  const [reportReason, setReportReason] = useState('Fraudulent / Scam listing')
  const [reportDetails, setReportDetails] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  useEffect(() => {
    if (review === 'true') setIsReviewing(true)
  }, [review])

  const isOwner = user?.id === product?.owner_id

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editFreeDelivery, setEditFreeDelivery] = useState(false)
  const [editLocalFee, setEditLocalFee] = useState('5000')
  const [editMikoaniFee, setEditMikoaniFee] = useState('15000')
  const [editImages, setEditImages] = useState<string[]>([])
  const [editFlashSale, setEditFlashSale] = useState(false)
  const [editMysteryBox, setEditMysteryBox] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<string | null>(null)

  const openEditModal = () => {
    if (!product) return
    setEditName(product.name)
    setEditPrice(product.price)
    setEditDesc(product.description || '')
    setEditFreeDelivery(product.settings?.free_delivery || false)
    setEditLocalFee(product.settings?.delivery_fee_local?.toString() || '5000')
    setEditMikoaniFee(product.settings?.delivery_fee_mikoani?.toString() || '15000')
    setEditImages([...(product.image_urls || [])])
    setEditFlashSale((product as any).is_flash_sale || false)
    setEditMysteryBox((product as any).is_mystery_box || false)
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!product) return
    setIsSaving(true)
    try {
      const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
      if (!shop) throw new Error('Shop not found')

      const products = shop.products || []
      const updatedProducts = products.map((p: any) => {
        if (p.id === product.id) {
          return {
            ...p,
            name: editName,
            price: editPrice,
            description: editDesc,
            image_urls: editImages,
            is_flash_sale: editFlashSale,
            is_mystery_box: editMysteryBox,
            settings: {
              ...p.settings,
              free_delivery: editFreeDelivery,
              delivery_fee_local: parseInt(editLocalFee) || 5000,
              delivery_fee_mikoani: parseInt(editMikoaniFee) || 15000
            }
          }
        }
        return p
      })

      const { error } = await supabase.from('shops').update({ products: updatedProducts }).eq('id', shopId)
      if (error) throw error

      setProduct(prev => prev ? {
        ...prev,
        name: editName,
        price: editPrice,
        description: editDesc,
        image_urls: editImages,
        is_flash_sale: editFlashSale,
        is_mystery_box: editMysteryBox,
        settings: {
          ...prev.settings,
          free_delivery: editFreeDelivery,
          delivery_fee_local: parseInt(editLocalFee) || 5000,
          delivery_fee_mikoani: parseInt(editMikoaniFee) || 15000
        }
      } : null)
      
      setIsEditing(false)
      Alert.alert('Success', 'Product updated successfully!')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true, // We still request base64 in case we need it, but PhotoEditor will generate a new URI
    })

    if (!result.canceled) {
      setEditingPhoto(result.assets[0].uri)
    }
  }

  const handleFilteredPhotoSave = async (newUri: string) => {
    setEditingPhoto(null)
    setIsSaving(true)
    try {
      const base64 = await FileSystem.readAsStringAsync(newUri, { encoding: 'base64' })
      const ext = newUri.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
      
      const { error } = await supabase.storage.from('memes').upload(fileName, decode(base64), { contentType: `image/${ext}` })
      if (error) {
        Alert.alert('Upload Error', error.message)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('memes').getPublicUrl(fileName)
      setEditImages(prev => [...prev, publicUrl])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    const fetchProduct = async () => {
      // Find the shop
      const { data: shopData, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single()

      if (shopData && !error) {
        const prod = (shopData.products || []).find((p: any) => p.id === id)
        if (prod) {
          setProduct({
            ...prod,
            shopId: shopData.id,
            shopName: shopData.name,
            shopCity: shopData.location_city,
            owner_id: shopData.owner_id,
            shopContactPhone: shopData.contact_phone,
            shopTraTin: shopData.tra_tin,
            shopCategory: shopData.category
          })
          
          const { data: revData } = await supabase.from('product_reviews').select('*').eq('product_id', id).order('created_at', { ascending: false })
          if (revData) setReviews(revData)
          
          if (user) {
            const { data: wishData } = await supabase.from('wishlists').select('*').eq('product_id', id).eq('user_id', user.id).single()
            if (wishData) setIsWishlisted(true)
          }
        }
      }
      setLoading(false)
    }
    fetchProduct()
  }, [id, shopId, user])

  const submitReview = async () => {
    if (!user) return Alert.alert('Error', 'You must be logged in to review.')
    if (!product) return
    setIsSaving(true)
    try {
      const { error } = await supabase.from('product_reviews').insert({
        shop_id: shopId,
        product_id: id,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment
      })
      if (error) throw error
      
      const newReviewCount = (product.review_count || 0) + 1
      const newRating = ((product.rating || 0) * (product.review_count || 0) + reviewRating) / newReviewCount
      
      const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
      const products = shop?.products || []
      const updatedProducts = products.map((p:any) => {
         if(p.id === id) return { ...p, rating: newRating, review_count: newReviewCount }
         return p
      })
      await supabase.from('shops').update({ products: updatedProducts }).eq('id', shopId)
      
      Alert.alert('Success', 'Review added!')
      setIsReviewing(false)
      
      const { data: revData } = await supabase.from('product_reviews').select('*').eq('product_id', id).order('created_at', { ascending: false })
      if (revData) setReviews(revData)
      setProduct(prev => prev ? { ...prev, rating: newRating, review_count: newReviewCount } : null)
      
    } catch(e:any) {
      Alert.alert('Error', e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePromote = async () => {
    Alert.alert(
      'Coming Soon',
      'Direct payment gateway integration is currently in progress. You will soon be able to promote products.'
    )
  }

  const handleMessageSeller = () => {
    if (!product) return
    router.push(`/chat?id=${product.owner_id}&is_shop=true`)
  }

  const submitOffer = () => {
    if (!product || !user) {
      router.push('/(auth)/login')
      return
    }
    const amt = parseFloat(offerAmount)
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }
    setIsMakingOffer(false)
    router.push(`/chat?id=${product.owner_id}&is_shop=true&make_offer=${amt}&product_id=${product.id}&product_name=${encodeURIComponent(product.name)}`)
  }

  const handleWishlistToggle = async () => {
    if (!user) return Alert.alert('Error', 'Please login to save items.')
    if (!product) return
    try {
      if (isWishlisted) {
        await supabase.from('wishlists').delete().eq('product_id', id).eq('user_id', user.id)
        setIsWishlisted(false)
      } else {
        await supabase.from('wishlists').insert({ user_id: user.id, product_id: id, shop_id: product.shopId })
        setIsWishlisted(true)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  const handleReportProblem = async () => {
    if (!reportReason.trim()) return Alert.alert('Error', 'Please select a reason.')
    if (!reporterPhone.trim()) return Alert.alert('Error', 'Please enter your contact phone number so our team can follow up.')
    setSubmittingReport(true)
    try {
      const { error } = await supabase.from('problem_reports').insert({
        reporter_id: user?.id || null,
        target_type: 'product',
        target_id: id as string,
        target_name: product?.name || 'Product Listing',
        reason: reportReason,
        details: reportDetails.trim() || null,
        reporter_phone: reporterPhone.trim() || null,
        seller_phone: (product as any)?.shopContactPhone || null,
        shop_id: product?.shopId || shopId as string,
        shop_name: product?.shopName || 'Shop Issue',
        target_metadata: {
          product_id: id,
          product_name: product?.name,
          product_price: product?.price,
          shop_id: product?.shopId || shopId,
          shop_name: product?.shopName,
          owner_id: product?.owner_id,
          contact_phone: (product as any)?.shopContactPhone,
          tra_tin: (product as any)?.shopTraTin,
          category: (product as any)?.shopCategory,
          city: product?.shopCity
        }
      })
      if (error) throw error
      Alert.alert('Report Received', 'Thank you. Our safety & escrow team will investigate immediately using attached contacts.')
      setIsReporting(false)
      setReportDetails('')
      setReporterPhone('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmittingReport(false)
    }
  }

  const handleAddToCart = () => {
    if (!product) return
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_urls?.[0],
      shopId: product.shopId,
      shopName: product.shopName,
      shopCity: product.shopCity,
      sellerId: product.owner_id,
      settings: product.settings
    })
    Alert.alert('Added to Cart', `${product.name} has been added to your cart.`)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    )
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#d4d4d8" />
        <Text style={styles.errorText}>Product not found.</Text>
      </View>
    )
  }

  const hasImages = product.image_urls && product.image_urls.length > 0;

  const formatPrice = (priceStr: string | number) => {
    if (priceStr === undefined || priceStr === null) return 'TZS —';
    const str = String(priceStr);
    // If it's just a raw number (like "20000"), format it
    if (/^\d+(\.\d+)?$/.test(str.trim())) {
      return `TZS ${Number(str).toLocaleString()}`;
    }
    return str;
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Modern Image Header */}
        <View style={[styles.imageCarousel, { width: width, height: width * 1.3 }]}>
          {hasImages ? (
            <ScrollView
              horizontal
              pagingEnabled
              snapToInterval={width}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width)
                setActiveImageIndex(idx)
              }}
            >
              {product.image_urls!.map((url, idx) => (
                <View key={idx} style={{ width: width, height: width * 1.3 }}>
                  <Image source={{ uri: getCdnUrl(url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.placeholderImg, { width: width, height: width * 1.3 }]}>
              <Ionicons name="image-outline" size={80} color={colors.textDim} />
            </View>
          )}

          {/* Dots Indicator */}
          {hasImages && product.image_urls!.length > 1 && (
            <View style={styles.dotsContainer}>
              {product.image_urls!.map((_, idx) => (
                <View 
                  key={idx} 
                  style={[styles.dot, activeImageIndex === idx && styles.activeDot]} 
                />
              ))}
            </View>
          )}

          {/* Top Actions Overlay */}
          <View style={[styles.topActionsOverlay, { top: Math.max(insets.top, 16) }]}>
            <BlurView intensity={30} tint="dark" style={styles.glassBtn}>
              <BackButton style={{ backgroundColor: 'transparent', shadowOpacity: 0 }} iconColor="#fff" />
            </BlurView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {!isOwner && (
                <TouchableOpacity onPress={() => setIsReporting(true)}>
                  <BlurView intensity={30} tint="dark" style={[styles.glassBtn, { backgroundColor: 'rgba(239, 68, 68, 0.4)' }]}>
                    <Ionicons name="flag" size={18} color="#fff" />
                  </BlurView>
                </TouchableOpacity>
              )}
              {isOwner && (
                <>
                  <TouchableOpacity onPress={handlePromote}>
                    <BlurView intensity={30} tint="dark" style={[styles.glassBtn, { backgroundColor: 'rgba(59, 130, 246, 0.4)' }]}>
                      <Ionicons name="rocket" size={20} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openEditModal}>
                    <BlurView intensity={30} tint="dark" style={styles.glassBtn}>
                      <Ionicons name="pencil" size={20} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Product Details Content */}
        <View style={styles.detailsContainer}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          <Text style={styles.name}>{product.name}</Text>
          
          {(product as any).is_flash_sale && (
            <LinearGradient colors={['#ec4899', '#f43f5e']} style={styles.flashSaleBanner} start={{x: 0, y: 0}} end={{x: 1, y: 0}}>
              <View style={styles.flashSaleIconBg}>
                <Ionicons name="flash" size={20} color="#ec4899" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>FLASH SALE</Text>
                <FlashSaleCountdown />
              </View>
            </LinearGradient>
          )}

          {(product as any).is_mystery_box && (
            <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.flashSaleBanner} start={{x: 0, y: 0}} end={{x: 1, y: 0}}>
              <View style={styles.flashSaleIconBg}>
                <Ionicons name="cube" size={24} color="#8b5cf6" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>MYSTERY BOX</Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' }}>Contents revealed after purchase!</Text>
              </View>
            </LinearGradient>
          )}

          <View style={styles.tagsRow}>
            {product.category && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{product.category}</Text>
              </View>
            )}
            {product.size && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Size: {product.size}</Text>
              </View>
            )}
            {product.condition && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{product.condition}</Text>
              </View>
            )}
          </View>

          {product.description && (
            <Text style={styles.description}>{product.description}</Text>
          )}

          {/* Premium Shop Card */}
          <TouchableOpacity
            style={styles.shopCard}
            onPress={() => router.push(`/shop/${product.shopId}`)}
            activeOpacity={0.85}
          >
            <View style={styles.shopIcon}>
              <Ionicons name="storefront" size={26} color="#3b82f6" />
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{product.shopName}</Text>
              <View style={styles.shopCityRow}>
                <Ionicons name="location" size={12} color={colors.textDim} />
                <Text style={styles.shopCity}>{product.shopCity}</Text>
              </View>
            </View>
            <View style={styles.shopVisitBtn}>
              <Text style={styles.shopVisitText}>Visit</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewsTitle}>Reviews ({product.review_count || 0})</Text>
              {product.rating && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
            
            {user && !isOwner && (
              <TouchableOpacity style={styles.writeReviewBtn} onPress={() => setIsReviewing(true)}>
                <Text style={styles.writeReviewText}>Write a Review</Text>
              </TouchableOpacity>
            )}

            {reviews.length === 0 ? (
              <Text style={styles.noReviews}>No reviews yet.</Text>
            ) : (
              reviews.map(rev => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewStars}>
                    {[1,2,3,4,5].map(star => (
                      <Ionicons key={star} name="star" size={14} color={star <= rev.rating ? "#fbbf24" : colors.border} />
                    ))}
                  </View>
                  <Text style={styles.reviewComment}>{rev.comment}</Text>
                  <Text style={styles.reviewDate}>{new Date(rev.created_at).toLocaleDateString()}</Text>
                </View>
              ))
            )}

            {!isOwner && (
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 24, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }} 
                onPress={() => setIsReporting(true)}
              >
                <Ionicons name="flag-outline" size={18} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Report Problem with this Listing</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Bar (Minimalist) */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 32 }]}>
        <View style={styles.bottomBarActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleWishlistToggle}>
            <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={26} color={isWishlisted ? "#ef4444" : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleMessageSeller}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.offerBtn, product.out_of_stock && { opacity: 0.5 }]} onPress={product.out_of_stock ? undefined : () => setIsMakingOffer(true)} activeOpacity={product.out_of_stock ? 1 : 0.7}>
            <Text style={styles.offerBtnText}>Offer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addCartBtn, product.out_of_stock && { backgroundColor: colors.border }]} onPress={product.out_of_stock ? undefined : handleAddToCart} activeOpacity={product.out_of_stock ? 1 : 0.8}>
            <Text style={[styles.addCartText, product.out_of_stock && { color: colors.textDim }]}>{product.out_of_stock ? 'Out of Stock' : 'Add to Cart'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Cart Button */}
      {items.length > 0 && (
        <TouchableOpacity
          style={styles.cartFab}
          activeOpacity={0.8}
          onPress={() => router.push('/cart')}
        >
          <Ionicons name="bag-handle" size={24} color={colors.background} />
          <View style={styles.cartFabBadge}>
            <Text style={styles.cartFabBadgeText}>{items.length}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Make Offer Modal */}
      <Modal visible={isMakingOffer} animationType="fade" transparent onRequestClose={() => setIsMakingOffer(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: colors.background, borderRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Make an Offer</Text>
            <Text style={{ color: colors.textDim, marginBottom: 20 }}>Negotiate a price with the seller for {product?.name}</Text>
            
            <View style={[styles.inputGroup, { marginBottom: 24 }]}>
              <Text style={styles.label}>Your Offer (TZS)</Text>
              <TextInput 
                style={styles.input}
                placeholder="e.g. 50000"
                placeholderTextColor={colors.border}
                keyboardType="numeric"
                value={offerAmount}
                onChangeText={setOfferAmount}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.border, alignItems: 'center' }} onPress={() => setIsMakingOffer(false)}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center' }} onPress={submitOffer}>
                <Text style={{ color: colors.background, fontWeight: '700' }}>Send Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal visible={isReviewing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsReviewing(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setIsReviewing(false)} style={styles.backBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Write Review</Text>
            <TouchableOpacity onPress={submitReview} disabled={isSaving} style={styles.saveBtn}>
              {isSaving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveBtnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rating</Text>
              <View style={styles.starSelectRow}>
                {[1,2,3,4,5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Ionicons name={star <= reviewRating ? "star" : "star-outline"} size={40} color="#fbbf24" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Comment</Text>
              <TextInput style={[styles.input, { height: 120 }]} multiline value={reviewComment} onChangeText={setReviewComment} textAlignVertical="top" placeholder="How was this product?" placeholderTextColor={colors.textDim} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditing(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.backBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Product</Text>
            <TouchableOpacity onPress={handleSaveEdit} disabled={isSaving} style={styles.saveBtn}>
              {isSaving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price (TZS/etc)</Text>
              <TextInput style={styles.input} value={editPrice} onChangeText={setEditPrice} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 100 }]} multiline value={editDesc} onChangeText={setEditDesc} textAlignVertical="top" />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Delivery Settings</Text>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Free Delivery</Text>
                <Switch value={editFreeDelivery} onValueChange={setEditFreeDelivery} />
              </View>
              {!editFreeDelivery && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Local Delivery Fee (TZS)</Text>
                    <TextInput style={styles.input} value={editLocalFee} onChangeText={setEditLocalFee} keyboardType="numeric" />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mikoani Delivery Fee (TZS)</Text>
                    <TextInput style={styles.input} value={editMikoaniFee} onChangeText={setEditMikoaniFee} keyboardType="numeric" />
                  </View>
                </>
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Premium Features</Text>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Flash Sale</Text>
                <Switch value={editFlashSale} onValueChange={setEditFlashSale} trackColor={{ true: '#ec4899' }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Mystery Box</Text>
                <Switch value={editMysteryBox} onValueChange={setEditMysteryBox} trackColor={{ true: '#8b5cf6' }} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingTop: 8 }}>
                {editImages.map((img, idx) => (
                  <View key={idx} style={styles.editImgWrap}>
                    <Image source={{ uri: getCdnUrl(img) }} style={styles.editImg} />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={24} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
                  <Ionicons name="add" size={32} color={colors.textDim} />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Report Listing Modal */}
      <Modal visible={isReporting} transparent={true} animationType="slide" onRequestClose={() => setIsReporting(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.card || '#18181b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Report Listing</Text>
              <TouchableOpacity onPress={() => setIsReporting(false)}>
                <Ionicons name="close" size={24} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 16 }}>
              Why are you reporting this product or seller?
            </Text>

            {[
              'Fraudulent / Scam listing',
              'Counterfeit or illegal item',
              'Misleading description or price',
              'Seller asking for payments off-platform',
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
              placeholder="Provide more info to help our safety team..."
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

      <PhotoEditor
        visible={!!editingPhoto}
        imageUri={editingPhoto || ''}
        onCancel={() => setEditingPhoto(null)}
        onSave={handleFilteredPhotoSave}
      />
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.textDim, marginTop: 12 },
  
  imageCarousel: {
    backgroundColor: colors.border,
    position: 'relative',
  },
  placeholderImg: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.border,
  },
  topActionsOverlay: {
    position: 'absolute',
    left: 16, right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glassBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 24,
  },

  detailsContainer: {
    padding: 24,
    backgroundColor: colors.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -32, // overlap the image
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
    color: '#3b82f6', // Nice vibrant blue
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 30,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  flashSaleBanner: {
    padding: 16, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 12,
  },
  flashSaleIconBg: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDim,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textDim,
    marginBottom: 32,
  },
  
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  shopIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  shopCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopCity: {
    fontSize: 13,
    color: colors.textDim,
    fontWeight: '600',
  },
  shopVisitBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20,
  },
  shopVisitText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: colors.background, // changed from black to themed
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomBarActions: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
  },
  iconBtn: {
    width: 52, height: 52,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerBtn: {
    flex: 0.8, height: 52,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  offerBtnText: {
    color: colors.text, fontWeight: '800', fontSize: 16,
  },
  addCartBtn: {
    flex: 1.2, height: 52,
    borderRadius: 16,
    backgroundColor: colors.text,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.text, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  addCartText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },

  /* Modals and Forms below (kept relatively identical) */
  modalHeaderBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  backBtn: { width: 40, alignItems: 'flex-start' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.text, borderRadius: 20 },
  saveBtnText: { color: colors.background, fontWeight: '700' },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDim, marginBottom: 8 },
  sectionLabel: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12, marginTop: 8 },
  input: {
    backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: colors.text,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  
  editImgWrap: { width: 80, height: 80, marginRight: 12, position: 'relative' },
  editImg: { width: 80, height: 80, borderRadius: 12, backgroundColor: colors.border },
  removeImgBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.background, borderRadius: 12 },
  addImgBtn: { width: 80, height: 80, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.textDim, borderStyle: 'dashed' },

  reviewsSection: { marginTop: 32, paddingTop: 32, borderTopWidth: 1, borderTopColor: colors.border },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  reviewsTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  ratingText: { color: '#d97706', fontWeight: '900', fontSize: 15 },
  writeReviewBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  writeReviewText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  noReviews: { color: colors.textDim, fontStyle: 'italic', marginTop: 8, fontSize: 15 },
  reviewCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 20, marginBottom: 12 },
  reviewStars: { flexDirection: 'row', marginBottom: 12, gap: 2 },
  reviewComment: { color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: 12 },
  reviewDate: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  starSelectRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 20 },
})
