import { getCdnUrl } from '../lib/cdn';
// app/cart.tsx
import { useTheme } from '../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCart, CartItem } from '../lib/cart'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import uuid from 'react-native-uuid'
import { BackButton } from '../components/BackButton'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { items, removeFromCart, cartTotal, clearCart } = useCart()
  const { user } = useAuth()
  const supabase = createClient()
  const insets = useSafeAreaInsets()
  const topPadding = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 54 : Constants.statusBarHeight)

  const handleCheckout = () => {
    if (!user) {
      Alert.alert('Login Required', 'You must be logged in to checkout.')
      return
    }
    router.push('/checkout')
  }

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      {item.image_url ? (
        <Image source={{ uri: getCdnUrl(item.image_url) }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.placeholderImg]}>
          <Ionicons name="cart" size={24} color="#a1a1aa" />
        </View>
      )}
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemShop}>{item.shopName}</Text>
        <Text style={styles.itemPrice}>{item.price}</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.removeBtn}
        onPress={() => removeFromCart(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: insets.bottom || 24 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bag-handle-outline" size={64} color="#e4e4e7" />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity 
              style={styles.shopBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.shopBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>TZS {cartTotal.toLocaleString()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.checkoutBtn}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>Checkout securely</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  listContent: { padding: 16 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemImage: {
    width: 64, height: 64,
    borderRadius: 12,
    backgroundColor: colors.border,
    marginRight: 12,
  },
  placeholderImg: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  itemShop: { fontSize: 13, color: colors.textDim, marginBottom: 4 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  removeBtn: { padding: 8 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textDim, marginTop: 16 },
  shopBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.border, borderRadius: 20 },
  shopBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },

  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: { fontSize: 16, color: colors.textDim },
  totalAmount: { fontSize: 24, fontWeight: '800', color: colors.text },
  checkoutBtn: {
    height: 56,
    backgroundColor: colors.text,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutText: { color: colors.background, fontSize: 16, fontWeight: '700' },
})
