// app/register-shop.tsx
import { useTheme } from '../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BackButton } from '../components/BackButton'

const TANZANIA_CITIES = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
  'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
  'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South', 'Pwani',
  'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
  'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West'
]

const SHOP_CATEGORIES = [
  'Clothing', 'Electronics', 'Food & Restaurants', 'Services & Freelance', 'Beauty', 'Books', 
  'Home', 'Sports', 'Toys', 'Other'
]

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()

  const [shopName, setShopName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [traTin, setTraTin] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)


  const handleSubmit = async () => {
    if (!shopName || !category || !city || !traTin) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.')
      return
    }
    
    setLoading(true)
    try {
      // 1. Check coin balance
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('wallet_balance').eq('id', user?.id).single()
      if (profileErr) throw profileErr
      
      const balance = profile.wallet_balance || 0
      
      if (balance < 2000) {
        Alert.alert('Insufficient Coins', 'You need 2,000 Dapaz Coins to open a shop. Please visit your Wallet to redeem a voucher.')
        setLoading(false)
        return
      }
      
      // 2. Insert Shop
      const { error: shopErr } = await supabase.from('shops').insert({
        owner_id: user?.id,
        name: shopName,
        description,
        category,
        location_city: city,
        status: 'active'
      })
      if (shopErr) throw shopErr
      
      // 3. Deduct Balance
      const { error: updateErr } = await supabase.from('profiles').update({ wallet_balance: balance - 2000 }).eq('id', user?.id)
      if (updateErr) throw updateErr
      
      setDone(true)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="checkmark-circle" size={80} color="#16a34a" />
        <Text style={styles.successTitle}>Shop Opened!</Text>
        <Text style={styles.successText}>
          2,000 Dapaz Coins were successfully deducted from your wallet. 
          Your shop "{shopName}" is now active!
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/seller-onboarding')}>
          <Text style={styles.primaryBtnText}>Explore Seller Features</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Open a Shop</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Shop Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="E.g., Kariakoo Electronics"
            value={shopName}
            onChangeText={setShopName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowCategoryPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: category ? colors.text : colors.textDim, fontSize: 16 }}>
              {category || 'Select a Category'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textDim} style={{ position: 'absolute', right: 16, top: 14 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>City *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowCityPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: city ? colors.text : colors.textDim, fontSize: 16 }}>
              {city || 'Select a City'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textDim} style={{ position: 'absolute', right: 16, top: 14 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What do you sell?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>TRA TIN (9 Digits) *</Text>
          <TextInput
            style={styles.input}
            placeholder="123456789"
            keyboardType="numeric"
            value={traTin}
            onChangeText={setTraTin}
            maxLength={9}
          />
        </View>

        <View style={{ marginBottom: 20, marginTop: 10, backgroundColor: colors.border, padding: 16, borderRadius: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Shop Opening Fee</Text>
          <Text style={{ fontSize: 14, color: colors.textDim, marginBottom: 12 }}>A one-time fee of 2,000 Dapaz Coins is required.</Text>

          <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, padding: 12, marginBottom: 4 }}>
            <Text style={{ color: '#3b82f6', fontWeight: '800', textAlign: 'center', fontSize: 14 }}>Balance Check Required</Text>
            <Text style={{ color: colors.text, fontWeight: '500', textAlign: 'center', fontSize: 12, marginTop: 4 }}>This amount will be deducted instantly from your wallet.</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.primaryBtn, loading && { opacity: 0.5 }]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Pay 2,000 🪙 & Open</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} animationType="slide" transparent={true} onRequestClose={() => setShowCityPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TANZANIA_CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityOption}
                  onPress={() => {
                    setCity(item)
                    setShowCityPicker(false)
                  }}
                >
                  <Text style={[styles.cityOptionText, city === item && { color: '#2563eb', fontWeight: '700' }]}>{item}</Text>
                  {city === item && <Ionicons name="checkmark" size={20} color="#2563eb" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} animationType="slide" transparent={true} onRequestClose={() => setShowCategoryPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SHOP_CATEGORIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityOption}
                  onPress={() => {
                    setCategory(item)
                    setShowCategoryPicker(false)
                  }}
                >
                  <Text style={[styles.cityOptionText, category === item && { color: '#2563eb', fontWeight: '700' }]}>{item}</Text>
                  {category === item && <Ionicons name="checkmark" size={20} color="#2563eb" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  scrollContent: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center', minHeight: 52,
  },
  textArea: { height: 100, fontSize: 16, color: colors.text },
  
  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 24,
    height: 56,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 12, marginBottom: 40,
    width: '100%',
  },
  primaryBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  
  successTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 16, color: colors.textDim, textAlign: 'center', marginBottom: 32 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cityOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  cityOptionText: { fontSize: 16, color: colors.text },
})
