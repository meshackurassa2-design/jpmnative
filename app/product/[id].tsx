import { getCdnUrl } from '../../lib/cdn';
// app/product/[id].tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Platform, useWindowDimensions
} from 'react-native'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCart } from '../../lib/cart'
import { createClient } from '../../lib/supabase'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../lib/auth'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { Modal, TextInput, Switch } from 'react-native'
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
    if (!user || !product) return
    Alert.alert(
      'Promote Product',
      'Boost this product to the top of the Discover feed for 24 hours? This costs 500 Coins.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Promote (500 Coins)',
          onPress: async () => {
            setIsSaving(true)
            try {
              // Check wallet balance
              const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
              if (!profile || (profile.wallet_balance || 0) < 500) {
                 Alert.alert('Insufficient Balance', 'You need 500 coins to promote a product.')
                 setIsSaving(false)
                 return
              }
              // Deduct coins
              const { error: walletErr } = await supabase.rpc('receive_coins', { p_user_id: user.id, p_amount: -500 })
              if (walletErr) throw walletErr

              // Update shop JSON
              const { data: shopData } = await supabase.from('shops').select('products').eq('id', shopId).single()
              const updatedProducts = (shopData?.products || []).map((p: any) => {
                if (p.id === id) {
                   return { ...p, is_promoted: true, promoted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
                }
                return p
              })
              const { error: shopErr } = await supabase.from('shops').update({ products: updatedProducts }).eq('id', shopId)
              if (shopErr) throw shopErr

              // Update local state
              setProduct((prev: any) => prev ? { ...prev, is_promoted: true, promoted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() } : null)
              Alert.alert('Success', 'Product promoted successfully!')
            } catch(e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setIsSaving(false)
            }
          }
        }
      ]
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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Image Carousel */}
        <View style={[styles.imageCarousel, { width: feedWidth, height: feedWidth * 1.2 }]}>
          {hasImages ? (
            <ScrollView
              horizontal
              pagingEnabled
              snapToInterval={feedWidth}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / feedWidth)
                setActiveImageIndex(idx)
              }}
            >
              {product.image_urls!.map((url, idx) => (
                <Image key={idx} source={{ uri: getCdnUrl(url) }} style={[styles.carouselImage, { width: feedWidth, height: feedWidth * 1.2 }]} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.carouselImage, styles.placeholderImg, { width: feedWidth, height: feedWidth * 1.2 }]}>
              <Ionicons name="cart-outline" size={64} color="#a1a1aa" />
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

          {/* Close Button overlay */}
          <BackButton style={[styles.closeBtnOverlay, { top: insets.top + 10 }]} />

          {/* Edit Button overlay */}
          {isOwner && (
            <>
              <TouchableOpacity 
                style={[styles.editBtnOverlay, { top: insets.top + 10, right: 60, backgroundColor: '#3b82f6' }]} 
                onPress={handlePromote}
              >
                <Ionicons name="rocket" size={20} color={colors.background} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editBtnOverlay, { top: insets.top + 10 }]} 
                onPress={openEditModal}
              >
                <Ionicons name="pencil" size={20} color={colors.background} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Product Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.price}>{product.price}</Text>
          <Text style={styles.name}>{product.name}</Text>
          
          {(product as any).is_flash_sale && (
            <View style={{ backgroundColor: '#ec4899', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
              <Ionicons name="flash" size={20} color="#fff" />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>FLASH SALE</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>Ends in 02:45:10</Text>
              </View>
            </View>
          )}


          {(product as any).is_mystery_box && (
            <View style={{ backgroundColor: '#8b5cf6', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
              <Ionicons name="cube" size={24} color="#fff" />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Mystery Box</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>Contents revealed after purchase!</Text>
              </View>
            </View>
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

          {/* Shop Card */}
          <TouchableOpacity
            style={styles.shopCard}
            onPress={() => router.push(`/shop/${product.shopId}`)}
            activeOpacity={0.8}
          >
            <View style={styles.shopIcon}>
              <Ionicons name="storefront-outline" size={24} color="#2563eb" />
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{product.shopName}</Text>
              <Text style={styles.shopCity}>{product.shopCity}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
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
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.messageBtn} onPress={handleWishlistToggle}>
          <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={24} color={isWishlisted ? "#ef4444" : colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.messageBtn} onPress={handleMessageSeller}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.offerBtn} onPress={() => setIsMakingOffer(true)}>
          <Text style={styles.offerBtnText}>Offer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addCartBtn} onPress={handleAddToCart}>
          <Text style={styles.addCartText}>Add to Cart</Text>
        </TouchableOpacity>
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
  carouselImage: {
  },
  placeholderImg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnOverlay: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  editBtnOverlay: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: colors.background,
    width: 24,
  },

  detailsContainer: {
    padding: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 28,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.border,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDim,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textDim,
    marginBottom: 32,
  },
  
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  shopIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  shopCity: {
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  messageBtn: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  offerBtn: {
    height: 56, paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  offerBtnText: {
    color: colors.text, fontWeight: '800', fontSize: 15,
  },
  addCartBtn: {
    flex: 1, height: 56,
    borderRadius: 28,
    backgroundColor: colors.text,
    justifyContent: 'center', alignItems: 'center',
  },
  addCartText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  cartFab: {
    position: 'absolute', bottom: 100, right: 24,
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.text,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.text, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  cartFabBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#ef4444', minWidth: 20, height: 20,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.text,
    paddingHorizontal: 4,
  },
  cartFabBadgeText: {
    color: colors.background, fontSize: 10, fontWeight: '800',
  },

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

  reviewsSection: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reviewsTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  ratingText: { color: '#92400e', fontWeight: '800', fontSize: 14 },
  writeReviewBtn: { backgroundColor: colors.text, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  writeReviewText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  noReviews: { color: colors.textDim, fontStyle: 'italic', marginTop: 8 },
  reviewCard: { backgroundColor: colors.border, padding: 16, borderRadius: 16, marginBottom: 12 },
  reviewStars: { flexDirection: 'row', marginBottom: 8, gap: 2 },
  reviewComment: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  reviewDate: { color: colors.textDim, fontSize: 12 },
  starSelectRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
})
