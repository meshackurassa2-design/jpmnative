// app/(settings)/promos.tsx
import React, { useEffect, useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { useUI } from '../../lib/ui'
import { BackButton } from '../../components/BackButton'

type PromoCode = {
  id: string
  shop_id: string
  code: string
  discount_percent: number
  is_active: boolean
  created_at: string
}

export default function PromosScreen() {
  const { colors } = useTheme()
  const s = useMemo(() => getStyles(colors), [colors])
  const { user } = useAuth()
  const supabase = createClient()
  const { showToast, showActionSheet } = useUI()

  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // New Promo State
  const [newCode, setNewCode] = useState('')
  const [newDiscount, setNewDiscount] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchPromos()
  }, [user])

  const fetchPromos = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('shop_promos')
      .select('*')
      .eq('shop_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPromos(data)
    }
    setLoading(false)
  }

  const handleAddPromo = async () => {
    if (!newCode.trim()) return showToast('Please enter a promo code', 'error')
    const discount = parseInt(newDiscount)
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      return showToast('Discount must be between 1 and 100', 'error')
    }

    setIsSaving(true)
    const { data, error } = await supabase
      .from('shop_promos')
      .insert({
        shop_id: user?.id,
        code: newCode.trim().toUpperCase(),
        discount_percent: discount,
        is_active: true
      })
      .select()
      .single()

    setIsSaving(false)

    if (error) {
      if (error.code === '23505') {
        showToast('This promo code already exists for your shop', 'error')
      } else {
        showToast(error.message, 'error')
      }
    } else if (data) {
      setPromos([data, ...promos])
      setShowAddModal(false)
      setNewCode('')
      setNewDiscount('')
      showToast('Promo code created!', 'success')
    }
  }

  const togglePromoStatus = async (promo: PromoCode) => {
    const { error } = await supabase
      .from('shop_promos')
      .update({ is_active: !promo.is_active })
      .eq('id', promo.id)

    if (error) {
      showToast('Failed to update status', 'error')
    } else {
      setPromos(promos.map(p => p.id === promo.id ? { ...p, is_active: !promo.is_active } : p))
    }
  }

  const handleDelete = (promo: PromoCode) => {
    showActionSheet(`Delete promo "${promo.code}"?`, [
      { text: 'Delete', style: 'destructive', icon: 'trash', onPress: async () => {
        const { error } = await supabase.from('shop_promos').delete().eq('id', promo.id)
        if (!error) {
          setPromos(promos.filter(p => p.id !== promo.id))
          showToast('Promo deleted', 'success')
        }
      }},
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const renderItem = ({ item }: { item: PromoCode }) => (
    <View style={s.promoCard}>
      <View style={s.promoHeader}>
        <View style={s.codeContainer}>
          <Ionicons name="pricetag" size={16} color={colors.primary} />
          <Text style={s.codeText}>{item.code}</Text>
        </View>
        <View style={[s.badge, item.is_active ? s.badgeActive : s.badgeInactive]}>
          <Text style={[s.badgeText, item.is_active ? s.badgeTextActive : s.badgeTextInactive]}>
            {item.is_active ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>
      
      <View style={s.promoDetails}>
        <Text style={s.discountText}>{item.discount_percent}% OFF</Text>
        <Text style={s.dateText}>Created {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      <View style={s.promoActions}>
        <TouchableOpacity 
          style={[s.actionBtn, { flex: 1, backgroundColor: item.is_active ? colors.border : '#dcfce7' }]}
          onPress={() => togglePromoStatus(item)}
        >
          <Ionicons name={item.is_active ? "pause-circle-outline" : "play-circle-outline"} size={18} color={item.is_active ? colors.textDim : '#166534'} />
          <Text style={[s.actionBtnText, { color: item.is_active ? colors.textDim : '#166534' }]}>
            {item.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Text style={s.headerTitle}>Promo Codes</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={promos}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="pricetag-outline" size={64} color={colors.border} />
              <Text style={s.emptyTitle}>No Promo Codes</Text>
              <Text style={s.emptySubtitle}>Create a discount code to attract more customers!</Text>
            </View>
          }
        />
      )}

      {/* Add Promo Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Promo Code</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={s.inputGroup}>
              <Text style={s.label}>Promo Code (e.g. SUMMER20)</Text>
              <TextInput
                style={s.input}
                placeholder="KARIBU10"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
                value={newCode}
                onChangeText={setNewCode}
              />
            </View>
            
            <View style={s.inputGroup}>
              <Text style={s.label}>Discount Percentage (%)</Text>
              <TextInput
                style={s.input}
                placeholder="15"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                value={newDiscount}
                onChangeText={setNewDiscount}
              />
            </View>

            <TouchableOpacity 
              style={s.saveBtn} 
              onPress={handleAddPromo}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Promo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 40 },
  
  promoCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  codeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  codeText: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: colors.border },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextActive: { color: '#166534' },
  badgeTextInactive: { color: colors.textDim },
  
  promoDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  discountText: { fontSize: 24, fontWeight: '900', color: colors.primary },
  dateText: { fontSize: 12, color: colors.textDim, fontWeight: '500' },
  
  promoActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  deleteBtn: { width: 44, height: 44, backgroundColor: '#fee2e2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textDim, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDim, marginBottom: 8 },
  input: { backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: '700', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
