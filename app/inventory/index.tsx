// app/inventory/index.tsx — Shop Inventory Management Screen
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { useUI } from '../../lib/ui'

type InventoryItem = {
  id: string
  shop_id: string
  name: string
  category: string | null
  quantity: number
  unit: string
  min_stock: number
  cost_price: number | null
  selling_price: number | null
  expiry_date: string | null
  barcode: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type FilterType = 'all' | 'low_stock' | 'expiring'

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function StatusBadge({ item, colors }: { item: InventoryItem; colors: any }) {
  const days = daysUntilExpiry(item.expiry_date)
  const isLowStock = item.quantity <= item.min_stock
  const isExpired = days !== null && days < 0
  const isExpiringSoon = days !== null && days >= 0 && days <= 30

  if (isExpired) return (
    <View style={[styles.badge, { backgroundColor: '#7f1d1d' }]}>
      <Text style={styles.badgeText}>EXPIRED</Text>
    </View>
  )
  if (isLowStock && isExpiringSoon) return (
    <View style={[styles.badge, { backgroundColor: '#7c2d12' }]}>
      <Text style={styles.badgeText}>LOW + EXPIRING</Text>
    </View>
  )
  if (isLowStock) return (
    <View style={[styles.badge, { backgroundColor: '#dc2626' }]}>
      <Text style={styles.badgeText}>LOW STOCK</Text>
    </View>
  )
  if (isExpiringSoon) return (
    <View style={[styles.badge, { backgroundColor: '#d97706' }]}>
      <Text style={styles.badgeText}>EXPIRING {days === 0 ? 'TODAY' : `IN ${days}D`}</Text>
    </View>
  )
  return (
    <View style={[styles.badge, { backgroundColor: '#15803d' }]}>
      <Text style={styles.badgeText}>OK</Text>
    </View>
  )
}

export default function InventoryScreen() {
  const { colors } = useTheme()
  const s = useMemo(() => getStyles(colors), [colors])
  const { user } = useAuth()
  const supabase = createClient()
  const { showToast, showActionSheet } = useUI()

  const [shopId, setShopId] = useState<string | null>(null)
  const [shopStatus, setShopStatus] = useState<string | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // Summary stats
  const stats = useMemo(() => {
    const lowStock = items.filter(i => i.quantity <= i.min_stock).length
    const expiringSoon = items.filter(i => {
      const d = daysUntilExpiry(i.expiry_date)
      return d !== null && d >= 0 && d <= 30
    }).length
    const expired = items.filter(i => {
      const d = daysUntilExpiry(i.expiry_date)
      return d !== null && d < 0
    }).length
    
    const totalCost = items.reduce((sum, item) => sum + (item.quantity * (item.cost_price || 0)), 0)
    const potentialRevenue = items.reduce((sum, item) => sum + (item.quantity * (item.selling_price || 0)), 0)
    const projectedProfit = potentialRevenue - totalCost

    return { total: items.length, lowStock, expiringSoon, expired, totalCost, potentialRevenue, projectedProfit }
  }, [items])

  const fetchShop = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('shops')
      .select('id, status')
      .eq('owner_id', user.id)
      .single()
    if (data) {
      setShopId(data.id)
      setShopStatus(data.status)
    }
  }, [user])

  const fetchInventory = useCallback(async (sid?: string) => {
    const id = sid || shopId
    if (!id) return
    const { data, error } = await supabase
      .from('shop_inventory')
      .select('*')
      .eq('shop_id', id)
      .order('name', { ascending: true })
    if (!error && data) setItems(data)
    setLoading(false)
    setRefreshing(false)
  }, [shopId])

  useEffect(() => {
    fetchShop().then(() => fetchInventory())
  }, [user])

  useFocusEffect(
    useCallback(() => {
      if (shopId) fetchInventory()
    }, [shopId, fetchInventory])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchInventory()
  }

  const handlePromote = async (item: InventoryItem) => {
    Alert.alert(
      'Promote Product',
      'Boost this product to the top of the Discover feed for 24 hours? This costs 500 Coins.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Promote (500 Coins)',
          onPress: async () => {
            try {
              // Check wallet balance
              const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
              if (!profile || (profile.wallet_balance || 0) < 500) {
                 Alert.alert('Insufficient Balance', 'You need 500 coins to promote a product.')
                 return
              }
              // Deduct coins
              const { error: walletErr } = await supabase.rpc('receive_coins', { p_user_id: user.id, p_amount: -500 })
              if (walletErr) throw walletErr

              // Update shop JSON
              const { data: shopData } = await supabase.from('shops').select('products').eq('id', shopId).single()
              const updatedProducts = (shopData?.products || []).map((p: any) => {
                if (p.id === item.id) {
                   return { ...p, is_promoted: true, promoted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
                }
                return p
              })
              const { error: shopErr } = await supabase.from('shops').update({ products: updatedProducts }).eq('id', shopId)
              if (shopErr) throw shopErr

              Alert.alert('Success', 'Product promoted successfully!')
            } catch(e: any) {
              Alert.alert('Error', e.message)
            }
          }
        }
      ]
    )
  }

  const handleDelete = (item: InventoryItem) => {
    showActionSheet(`Delete "${item.name}"?`, [
      {
        text: 'Delete',
        style: 'destructive',
        icon: 'trash',
        onPress: async () => {
          const { error } = await supabase.from('shop_inventory').delete().eq('id', item.id)
          if (error) {
            showToast('Failed to delete item', 'error')
          } else {
            // Delete from JSON
            const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
            if (shop) {
               const prods = shop.products || []
               const updated = prods.filter((p: any) => p.id !== item.id)
               await supabase.from('shops').update({ products: updated }).eq('id', shopId)
            }

            setItems(prev => prev.filter(i => i.id !== item.id))
            showToast('Item deleted', 'success')
          }
        }
      },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const handleBatchDelete = () => {
    if (selectedItems.length === 0) return
    showActionSheet(`Delete ${selectedItems.length} items?`, [
      {
        text: 'Delete Selected',
        style: 'destructive',
        icon: 'trash',
        onPress: async () => {
          const { error } = await supabase.from('shop_inventory').delete().in('id', selectedItems)
          if (error) {
            showToast('Failed to delete items', 'error')
          } else {
            const { data: shop } = await supabase.from('shops').select('products').eq('id', shopId).single()
            if (shop) {
               const prods = shop.products || []
               const updated = prods.filter((p: any) => !selectedItems.includes(p.id))
               await supabase.from('shops').update({ products: updated }).eq('id', shopId)
            }
            setItems(prev => prev.filter(i => !selectedItems.includes(i.id)))
            setSelectedItems([])
            setIsSelectionMode(false)
            showToast(`Deleted ${selectedItems.length} items`, 'success')
          }
        }
      },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItems.map(i => i.id))
    }
  }

  const filteredItems = useMemo(() => {
    let result = items
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.category?.toLowerCase().includes(q)) ||
        (i.barcode?.includes(q))
      )
    }
    if (filter === 'low_stock') {
      result = result.filter(i => i.quantity <= i.min_stock)
    } else if (filter === 'expiring') {
      result = result.filter(i => {
        const d = daysUntilExpiry(i.expiry_date)
        return d !== null && d <= 30
      })
    }
    return result
  }, [items, search, filter])

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const days = daysUntilExpiry(item.expiry_date)
    const isLowStock = item.quantity <= item.min_stock
    const cardBorder = isLowStock
      ? '#dc2626'
      : (days !== null && days <= 30 ? '#d97706' : colors.border)

    return (
      <TouchableOpacity
        style={[s.itemCard, { borderLeftColor: cardBorder, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center' }]}
        activeOpacity={0.8}
        onPress={() => isSelectionMode ? toggleSelection(item.id) : router.push({ pathname: '/inventory/add', params: { item: JSON.stringify(item) } })}
      >
        {isSelectionMode && (
          <View style={{ marginRight: 12 }}>
            <Ionicons 
              name={selectedItems.includes(item.id) ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={selectedItems.includes(item.id) ? "#ef4444" : colors.textDim} 
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.itemTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              {item.category && (
                <Text style={s.itemCategory}>{item.category}</Text>
              )}
            </View>
            {!isSelectionMode && <StatusBadge item={item} colors={colors} />}
          </View>

        <View style={s.itemBottom}>
          <View style={s.itemStat}>
            <Ionicons name="cube-outline" size={14} color={colors.textDim} />
            <Text style={[s.itemStatText, isLowStock && { color: '#ef4444', fontWeight: '700' }]}>
              {item.quantity} {item.unit}
            </Text>
          </View>

          {item.selling_price != null && (
            <View style={s.itemStat}>
              <Ionicons name="pricetag-outline" size={14} color={colors.textDim} />
              <Text style={s.itemStatText}>TZS {item.selling_price.toLocaleString()}</Text>
            </View>
          )}

          {item.expiry_date && (
            <View style={s.itemStat}>
              <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
              <Text style={[
                s.itemStatText,
                days !== null && days <= 7 && { color: '#ef4444', fontWeight: '700' },
                days !== null && days > 7 && days <= 30 && { color: '#f59e0b' },
              ]}>
                {days !== null && days < 0
                  ? `Expired ${Math.abs(days)}d ago`
                  : new Date(item.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                }
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', marginLeft: 'auto', gap: 8 }}>
            {!isSelectionMode && (
              <>
                <TouchableOpacity
                  onPress={() => handlePromote(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}
                >
                  <Ionicons name="megaphone-outline" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.empty}>
          <Ionicons name="lock-closed-outline" size={52} color={colors.textDim} />
          <Text style={s.emptyTitle}>Login Required</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!loading && !shopId) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Inventory</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.empty}>
          <Ionicons name="storefront-outline" size={52} color={colors.textDim} />
          <Text style={s.emptyTitle}>No Shop Found</Text>
          <Text style={s.emptySubtitle}>Register a shop first to manage inventory</Text>
          <TouchableOpacity style={s.registerBtn} onPress={() => router.push('/register-shop')}>
            <Text style={s.registerBtnText}>Register Shop</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (!loading && shopStatus === 'pending') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Inventory</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.empty}>
          <Ionicons name="time-outline" size={52} color="#f59e0b" />
          <Text style={s.emptyTitle}>Shop Pending Verification</Text>
          <Text style={s.emptySubtitle}>Your shop is currently being reviewed by an admin. You will be able to manage inventory once it's approved.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Inventory</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => {
              setIsSelectionMode(!isSelectionMode)
              setSelectedItems([])
            }}
          >
            <Ionicons name={isSelectionMode ? "close" : "list-outline"} size={22} color={isSelectionMode ? colors.textDim : colors.text} />
          </TouchableOpacity>
          {!isSelectionMode && (
            <>
              <TouchableOpacity
                style={s.headerIconBtn}
                onPress={() => router.push({ pathname: '/inventory/pos', params: { shopId: shopId! } })}
              >
                <Ionicons name="barcode-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.headerIconBtn}
                onPress={() => router.push({ pathname: '/inventory/ai-scan', params: { shopId: shopId! } })}
              >
                <Ionicons name="sparkles" size={22} color="#a855f7" />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.headerIconBtn}
                onPress={() => router.push({ pathname: '/inventory/add', params: { shopId: shopId! } })}
              >
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Dashboard Summary Cards */}
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={s.statNum}>{stats.total}</Text>
          <Text style={s.statLabel}>Products</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: stats.lowStock > 0 ? '#fee2e2' : colors.card, borderColor: stats.lowStock > 0 ? '#fca5a5' : colors.border }]}>
          <Text style={[s.statNum, { color: stats.lowStock > 0 ? '#dc2626' : colors.text }]}>{stats.lowStock}</Text>
          <Text style={[s.statLabel, { color: stats.lowStock > 0 ? '#dc2626' : colors.textDim }]}>Low Stock</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: stats.expiringSoon > 0 ? '#fef3c7' : colors.card, borderColor: stats.expiringSoon > 0 ? '#fde68a' : colors.border }]}>
          <Text style={[s.statNum, { color: stats.expiringSoon > 0 ? '#d97706' : colors.text }]}>{stats.expiringSoon}</Text>
          <Text style={[s.statLabel, { color: stats.expiringSoon > 0 ? '#d97706' : colors.textDim }]}>Expiring</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: stats.expired > 0 ? '#fce7f3' : colors.card, borderColor: stats.expired > 0 ? '#f9a8d4' : colors.border }]}>
          <Text style={[s.statNum, { color: stats.expired > 0 ? '#9d174d' : colors.text }]}>{stats.expired}</Text>
          <Text style={[s.statLabel, { color: stats.expired > 0 ? '#9d174d' : colors.textDim }]}>Expired</Text>
        </View>
      </View>

      {/* Financial Overview */}
      <View style={s.financeRow}>
        <View style={s.financeCard}>
          <Text style={s.financeLabel}>Total Cost (Expense)</Text>
          <Text style={[s.financeValue, { color: colors.text }]}>TZS {stats.totalCost.toLocaleString()}</Text>
        </View>
        <View style={s.financeCard}>
          <Text style={s.financeLabel}>Potential Revenue</Text>
          <Text style={[s.financeValue, { color: colors.text }]}>TZS {stats.potentialRevenue.toLocaleString()}</Text>
        </View>
        <View style={[s.financeCard, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
          <Text style={[s.financeLabel, { color: '#166534' }]}>Projected Profit</Text>
          <Text style={[s.financeValue, { color: '#16a34a' }]}>TZS {stats.projectedProfit.toLocaleString()}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textDim} />
          <TextInput
            style={s.searchInput}
            placeholder="Search products, barcode..."
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs & Selection Actions */}
      <View style={[s.filterRow, { justifyContent: 'space-between' }]}>
        {isSelectionMode ? (
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity
              style={[s.filterBtn, { flex: 1, justifyContent: 'center' }]}
              onPress={toggleSelectAll}
            >
              <Ionicons name="checkbox-outline" size={16} color={colors.text} />
              <Text style={[s.filterText, { color: colors.text, marginLeft: 6 }]}>
                {selectedItems.length === filteredItems.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.filterBtn, { flex: 1, justifyContent: 'center', backgroundColor: selectedItems.length > 0 ? '#ef4444' : '#fee2e2', borderColor: selectedItems.length > 0 ? '#ef4444' : '#fca5a5' }]}
              onPress={handleBatchDelete}
              disabled={selectedItems.length === 0}
            >
              <Ionicons name="trash" size={16} color={selectedItems.length > 0 ? '#fff' : '#ef4444'} />
              <Text style={[s.filterText, { color: selectedItems.length > 0 ? '#fff' : '#ef4444', marginLeft: 6, fontWeight: '700' }]}>
                Delete ({selectedItems.length})
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          (['all', 'low_stock', 'expiring'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, filter === f && s.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              {f === 'low_stock' && <Ionicons name="warning-outline" size={14} color={filter === f ? '#fff' : '#ef4444'} />}
              {f === 'expiring' && <Ionicons name="time-outline" size={14} color={filter === f ? '#fff' : '#f59e0b'} />}
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>
                {f === 'all' ? 'All' : f === 'low_stock' ? 'Low Stock' : 'Expiring'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={52} color={colors.textDim} />
              <Text style={s.emptyTitle}>
                {filter !== 'all' ? 'No items match this filter' : search ? 'No results found' : 'No products yet'}
              </Text>
              <Text style={s.emptySubtitle}>Tap the + button to add your first product</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {!loading && (
        <TouchableOpacity
          style={s.fab}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/inventory/add', params: { shopId: shopId! } })}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  statCard: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    padding: 10, alignItems: 'center', justifyContent: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textDim, marginTop: 2 },

  // Financials
  financeRow: {
    paddingHorizontal: 16, paddingBottom: 16, gap: 8,
  },
  financeCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  financeLabel: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  financeValue: { fontSize: 15, fontWeight: '800' },

  // Search
  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  // Filters
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterBtnActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  filterTextActive: { color: '#fff' },

  // Items
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemCategory: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  itemStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemStatText: { fontSize: 13, color: colors.textDim, fontWeight: '500' },
  deleteBtn: { marginLeft: 'auto' },

  // Empty / Loading
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.textDim, marginTop: 8, textAlign: 'center' },
  registerBtn: {
    backgroundColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 24,
  },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // FAB
  fab: {
    position: 'absolute', bottom: 30, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
})
