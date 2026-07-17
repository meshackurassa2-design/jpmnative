import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

type WishlistItem = {
  id: string
  product_id: string
  shop_id: string
  created_at: string
  product?: {
    id: string
    name: string
    price: string
    image_urls?: string[]
    shopName?: string
  }
}

const { width } = Dimensions.get('window')
const numColumns = 2
const itemWidth = (width - 48) / 2

export default function WishlistScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWishlist() {
      if (!user) return
      try {
        const { data: wishData, error } = await supabase
          .from('wishlists')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        if (wishData && wishData.length > 0) {
          // Extract unique shop IDs to fetch
          const shopIds = [...new Set(wishData.map(w => w.shop_id))]
          const { data: shops } = await supabase
            .from('shops')
            .select('id, name, products')
            .in('id', shopIds)

          const enriched = wishData.map(w => {
            const shop = shops?.find(s => s.id === w.shop_id)
            if (shop && shop.products) {
              const prod = (shop.products as any[]).find(p => p.id === w.product_id)
              if (prod) {
                return { ...w, product: { ...prod, shopName: shop.name } }
              }
            }
            return w
          }).filter(w => w.product) // Only keep items where the product still exists

          setItems(enriched as WishlistItem[])
        } else {
          setItems([])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchWishlist()
  }, [user])

  const renderItem = ({ item }: { item: WishlistItem }) => {
    const prod = item.product
    if (!prod) return null
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push(`/product/${prod.id}?shopId=${item.shop_id}`)}
        activeOpacity={0.8}
      >
        {prod.image_urls && prod.image_urls.length > 0 ? (
          <Image source={{ uri: getCdnUrl(prod.image_urls[0]) }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={32} color={colors.textDim} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.price}>{prod.price}</Text>
          <Text style={styles.name} numberOfLines={1}>{prod.name}</Text>
          {prod.shopName && <Text style={styles.shopName} numberOfLines={1}>{prod.shopName}</Text>}
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        numColumns={numColumns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptyText}>Tap the heart icon on products to save them for later.</Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)/marketplace')}>
              <Text style={styles.shopBtnText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  listContent: { padding: 16, paddingBottom: 60 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: {
    width: itemWidth,
    backgroundColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden'
  },
  image: { width: '100%', height: itemWidth, backgroundColor: colors.border },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardInfo: { padding: 12, backgroundColor: colors.background },
  price: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  name: { fontSize: 13, color: colors.textDim, marginBottom: 2 },
  shopName: { fontSize: 11, color: '#2563eb', fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 8 },
  emptyText: { fontSize: 15, color: colors.textDim, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  shopBtn: { backgroundColor: colors.text, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
  shopBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' }
})
