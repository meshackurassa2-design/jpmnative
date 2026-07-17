// app/register-shop.tsx
import { useTheme } from '../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BackButton } from '../components/BackButton'
import { CoinIcon } from '../components/CoinIcon'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { initiateAndWait } from '../lib/clickpesa'

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
  const [tinCertUri, setTinCertUri] = useState<string | null>(null)
  const [tinCertBase64, setTinCertBase64] = useState<string | null>(null)
  const [paymentPhone, setPaymentPhone] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')

  const handleUploadCert = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true
    });

    if (!result.canceled && result.assets[0].base64) {
      setTinCertUri(result.assets[0].uri);
      setTinCertBase64(result.assets[0].base64);
    }
  }


  const handleSubmit = async () => {
    if (!shopName || !category || !city || !traTin) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.')
      return
    }
    if (!paymentPhone || paymentPhone.length < 9) {
      Alert.alert('Missing Phone', 'Please provide a valid phone number for the 3,000 TZS registration fee.')
      return
    }

    try {
      setLoading(true)
      let formattedPhone = paymentPhone.replace(/\D/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '255' + formattedPhone.slice(1)
      } else if (!formattedPhone.startsWith('255')) {
        formattedPhone = '255' + formattedPhone
      }

      setPaymentMessage('Initiating 3,000 TZS payment... Please check your phone.')
      
      const status = await initiateAndWait(
        3000,
        formattedPhone,
        user!.id,
        `Shop Registration: ${shopName}`,
        {
          onStatus: (s) => setPaymentMessage(`Payment status: ${s}. Please check your phone.`)
        }
      )

      if (status !== 'SUCCESS' && status !== 'SETTLED') {
        throw new Error('Payment was not successful. Status: ' + status)
      }

      setPaymentMessage('Payment successful! Creating your shop...')

      let certPath = null
      if (tinCertBase64 && tinCertUri) {
        const ext = tinCertUri.split('.').pop() || 'jpg'
        const fileName = `${user!.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('shop_documents')
          .upload(fileName, decode(tinCertBase64), { contentType: `image/${ext}` })
        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage.from('shop_documents').getPublicUrl(fileName)
          certPath = publicUrlData.publicUrl
        }
      }

      const { error } = await supabase.from('shops').insert({
        owner_id: user!.id,
        name: shopName,
        description,
        category,
        city,
        tra_tin: traTin,
        tin_cert_url: certPath,
        contact_phone: paymentPhone.trim(),
        status: 'pending',
        products: []
      })

      if (error) throw error

      setDone(true)
    } catch (e: any) {
      Alert.alert('Payment Error', e.message || 'Failed to complete registration payment.')
    } finally {
      setLoading(false)
      setPaymentMessage('')
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="checkmark-circle" size={80} color="#16a34a" />
        <Text style={styles.successTitle}>Shop Opened!</Text>
        <Text style={styles.successText}>
          Your shop "{shopName}" is now active!
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/seller-onboarding')}>
          <Text style={styles.primaryBtnText}>Explore Seller Features</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton style={styles.backBtn} />
        <Text style={styles.headerTitle}>Open Your Shop</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g., Kariakoo Electronics"
              placeholderTextColor={colors.textDim}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>TIN Certificate Document</Text>
          <TouchableOpacity style={[styles.uploadBox, tinCertUri && styles.uploadBoxSuccess]} onPress={handleUploadCert}>
            <Ionicons name={tinCertUri ? "checkmark-circle" : "document-text-outline"} size={28} color={tinCertUri ? "#10b981" : colors.textDim} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Upload Certificate</Text>
              <Text style={styles.uploadSub}>{tinCertUri ? 'Document attached' : 'Optional but highly recommended'}</Text>
            </View>
          </TouchableOpacity>
        </View>


        <View style={styles.inputGroup}>
          <Text style={styles.label}>Payment Phone Number (For 3,000 TZS Fee) *</Text>
          <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
            <Text style={{ color: colors.text, paddingLeft: 16, paddingRight: 8 }}>+255</Text>
            <View style={{ width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 8 }} />
            <TextInput
              style={{ flex: 1, color: colors.text, fontSize: 16 }}
              placeholder="712345678"
              placeholderTextColor={colors.textDim}
              keyboardType="phone-pad"
              value={paymentPhone}
              onChangeText={setPaymentPhone}
            />
          </View>
        </View>

        {paymentMessage ? (
          <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ color: '#3b82f6', textAlign: 'center', fontWeight: '500' }}>{paymentMessage}</Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <Text style={{ color: '#10b981', textAlign: 'center', fontWeight: '500' }}>
            A one-time registration fee of 3,000 TZS is required to open a shop.
          </Text>
          <Text style={{ color: '#10b981', textAlign: 'center', marginTop: 4, fontSize: 13 }}>
            Supported Networks: Airtel Money, Halopesa, and Tigo Pesa
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.primaryBtn, loading && { opacity: 0.5 }]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.primaryBtnText}>Pay 3,000 TZS & Open Shop</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

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
    color: colors.text, fontSize: 16
  },
  textArea: { height: 100, fontSize: 16, color: colors.text },
  
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 24,
    height: 56,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 12, marginBottom: 40,
    width: '100%',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  
  successTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 16, color: colors.textDim, textAlign: 'center', marginBottom: 32 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cityOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  cityOptionText: { fontSize: 16, color: colors.text },
  uploadBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.border,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
  },
  uploadBoxSuccess: {
    borderColor: '#10b981', borderStyle: 'solid', backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  uploadTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  uploadSub: { fontSize: 12, color: colors.textDim },
})
