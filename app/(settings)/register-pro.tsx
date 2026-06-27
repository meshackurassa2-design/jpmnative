import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Modal, FlatList
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const TANZANIA_CITIES = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
  'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
  'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South', 'Pwani',
  'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
  'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West'
]

export default function RegisterProScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [rate, setRate] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [city, setCity] = useState('')
  
  const [hasId, setHasId] = useState(false)
  const [hasCert, setHasCert] = useState(false)

  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)

  const handleUploadId = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setHasId(true);
      Alert.alert('Uploaded', 'Identity verification document attached securely.');
    }
  }

  const handleUploadCert = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setHasCert(true);
      Alert.alert('Uploaded', 'Professional certification attached.');
    }
  }

  const handleSubmit = async () => {
    if (!fullName || !title || !city || !hasId) {
      Alert.alert('Missing Fields', 'Please fill in all required fields and upload your ID.')
      return
    }

    setLoading(true)
    
    // 1. Check Coin Balance
    const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user?.id).single()
    const balance = profile?.wallet_balance || 0
    
    if (balance < 5000) {
      Alert.alert('Insufficient Coins', 'You need 5,000 Dapaz Coins to become a Pro. Please visit your Wallet to redeem a voucher.')
      setLoading(false)
      return
    }
    
    // Combine data into a description format
    const fullDescription = `${title}\n\n${bio}\n\nHourly Rate: ${rate} TZS\nPortfolio: ${portfolio}`

    try {
      // Create a shop but format it as a Pro Profile
      const { error } = await supabase.from('shops').insert({
        owner_id: user?.id,
        name: fullName,
        description: fullDescription,
        category: 'Services & Freelance',
        location_city: city,
        status: 'active'
      })

      if (error) throw error
      
      // Deduct Coins
      await supabase.from('profiles').update({ wallet_balance: balance - 5000 }).eq('id', user?.id)
      
      setDone(true)
    } catch (e: any) {
      Alert.alert('Application Failed', e.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="shield-checkmark" size={80} color="#2563eb" />
        <Text style={styles.successTitle}>Application Submitted</Text>
        <Text style={styles.successText}>
          5,000 Dapaz Coins were successfully deducted from your wallet.
          Your credentials have been submitted and you will appear on the "Hire a Pro" board shortly!
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/services')}>
          <Text style={styles.primaryBtnText}>Go to Services Hub</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ padding: 8, width: 44 }} />
        <Text style={styles.headerTitle}>Pro Application</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Ionicons name="ribbon" size={32} color="#fbbf24" style={{ marginBottom: 12 }} />
          <Text style={styles.introTitle}>Become a Verified Pro</Text>
          <Text style={styles.introText}>
            Join our elite network of freelancers. Verified Pros get priority placement, a blue checkmark, and direct client inquiries.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>Personal Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#666"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Professional Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Master Plumber, Senior UI Designer"
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>City *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowCityPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: city ? '#fff' : '#666', fontSize: 16 }}>
              {city || 'Select your city'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" style={{ position: 'absolute', right: 16, top: 14 }} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Professional Background</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hourly Rate (TZS) / Optional</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 25,000"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={rate}
            onChangeText={setRate}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Portfolio / LinkedIn URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://"
            placeholderTextColor="#666"
            keyboardType="url"
            autoCapitalize="none"
            value={portfolio}
            onChangeText={setPortfolio}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Short Bio / Experience</Text>
          <TextInput
            style={[styles.input, { height: 100, paddingTop: 16, textAlignVertical: 'top' }]}
            placeholder="Tell clients about your expertise and past projects..."
            placeholderTextColor="#666"
            multiline
            value={bio}
            onChangeText={setBio}
          />
        </View>

        <Text style={styles.sectionHeader}>Strict Verification</Text>
        
        <TouchableOpacity style={[styles.uploadBox, hasId && styles.uploadBoxSuccess]} onPress={handleUploadId}>
          <Ionicons name={hasId ? "checkmark-circle" : "id-card-outline"} size={28} color={hasId ? "#10b981" : "#a1a1aa"} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.uploadTitle}>Upload National ID *</Text>
            <Text style={styles.uploadSub}>{hasId ? 'Document attached' : 'Required for identity verification'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.uploadBox, hasCert && styles.uploadBoxSuccess]} onPress={handleUploadCert}>
          <Ionicons name={hasCert ? "checkmark-circle" : "document-text-outline"} size={28} color={hasCert ? "#10b981" : "#a1a1aa"} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.uploadTitle}>Upload Certification</Text>
            <Text style={styles.uploadSub}>{hasCert ? 'Document attached' : 'Optional but highly recommended'}</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitBtnText}>{loading ? 'Processing...' : 'Pay 5,000 🪙 & Apply'}</Text>
        </TouchableOpacity>
      </View>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <FlatList
              data={TANZANIA_CITIES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setCity(item); setShowCityPicker(false) }}
                >
                  <Text style={[styles.modalItemText, city === item && { color: '#2563eb', fontWeight: '800' }]}>{item}</Text>
                  {city === item && <Ionicons name="checkmark" size={20} color="#2563eb" />}
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
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  
  introBox: {
    backgroundColor: '#111',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 32,
    alignItems: 'center',
  },
  introTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  introText: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22 },

  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16, marginTop: 16 },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#ccc', marginBottom: 8 },
  input: {
    backgroundColor: '#111',
    borderWidth: 1, borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    color: '#fff', fontSize: 16,
  },
  
  uploadBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1, borderColor: '#333', borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  uploadBoxSuccess: {
    borderColor: '#10b981', borderStyle: 'solid', backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  uploadSub: { fontSize: 12, color: '#888' },

  footer: {
    padding: 20, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000'
  },
  submitBtn: {
    backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center'
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#000' },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 24, marginBottom: 12 },
  successText: { fontSize: 15, color: '#aaa', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  primaryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalItemText: { fontSize: 16, color: '#ccc' }
})
