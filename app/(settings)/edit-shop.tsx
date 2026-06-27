import { getCdnUrl } from '../../lib/cdn';
// app/(settings)/edit-shop.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Image, Modal, FlatList
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { BackButton } from '../../components/BackButton'

const TANZANIA_CITIES = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
  'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
  'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South', 'Pwani',
  'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
  'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West'
]

export default function EditShopScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()

  const [shopId, setShopId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverBase64, setCoverBase64] = useState<string | null>(null)
  const [avatarImage, setAvatarImage] = useState<string | null>(null)
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)

  useEffect(() => {
    async function fetchShop() {
      if (!user) return
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()
      
      if (data) {
        setShopId(data.id)
        setDescription(data.description || '')
        setLocationCity(data.location_city || '')
        setCoverImage(data.cover_image || null)
        setAvatarImage(data.avatar_image || null)
      }
      setLoading(false)
    }
    fetchShop()
  }, [user])

  const pickImage = async (type: 'cover' | 'avatar') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'cover' ? [16, 9] : [1, 1],
      quality: 0.5,
      base64: true,
    })

    if (!result.canceled && result.assets[0].base64) {
      if (type === 'cover') {
        setCoverImage(result.assets[0].uri)
        setCoverBase64(result.assets[0].base64)
      } else {
        setAvatarImage(result.assets[0].uri)
        setAvatarBase64(result.assets[0].base64)
      }
    }
  }

  const handleSave = async () => {
    if (!user || !shopId) return
    setSaving(true)

    try {
      let finalCover = coverImage
      let finalAvatar = avatarImage

      // Upload Cover if it's a new file
      if (coverBase64) {
        const ext = coverImage?.split('.').pop() || 'jpg'
        const path = `shops/${shopId}/cover_${Date.now()}.${ext}`
        const { data, error } = await supabase.storage.from('memes').upload(path, decode(coverBase64), { contentType: `image/${ext}`, upsert: true })
        if (error) throw new Error('Cover upload failed: ' + error.message)
        if (data) {
          const { data: pubData } = supabase.storage.from('memes').getPublicUrl(path)
          finalCover = pubData.publicUrl
        }
      }

      // Upload Avatar if it's a new file
      if (avatarBase64) {
        const ext = avatarImage?.split('.').pop() || 'jpg'
        const path = `shops/${shopId}/avatar_${Date.now()}.${ext}`
        const { data, error } = await supabase.storage.from('memes').upload(path, decode(avatarBase64), { contentType: `image/${ext}`, upsert: true })
        if (error) throw new Error('Avatar upload failed: ' + error.message)
        if (data) {
          const { data: pubData } = supabase.storage.from('memes').getPublicUrl(path)
          finalAvatar = pubData.publicUrl
        }
      }

      const { error } = await supabase
        .from('shops')
        .update({
          description: description.trim(),
          location_city: locationCity.trim(),
          cover_image: finalCover,
          avatar_image: finalAvatar
        })
        .eq('id', shopId)

      if (error) throw error
      Alert.alert('Success', 'Shop profile updated!')
      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    )
  }

  if (!shopId) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: colors.textDim }}>You don't have a shop yet.</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Edit Shop Profile</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cover Image Picker */}
        <Text style={styles.sectionTitle}>Cover Image</Text>
        <TouchableOpacity style={styles.coverUpload} onPress={() => pickImage('cover')} activeOpacity={0.8}>
          {coverImage ? (
            <Image source={{ uri: getCdnUrl(coverImage) }} style={styles.coverImage} />
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="image-outline" size={32} color={colors.textDim} />
              <Text style={styles.placeholderText}>Tap to upload cover</Text>
            </View>
          )}
          <View style={styles.editIconWrap}>
            <Ionicons name="pencil" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Avatar Image Picker */}
        <Text style={styles.sectionTitle}>Shop Logo / Avatar</Text>
        <View style={styles.avatarContainer}>
          <TouchableOpacity style={styles.avatarUpload} onPress={() => pickImage('avatar')} activeOpacity={0.8}>
            {avatarImage ? (
              <Image source={{ uri: getCdnUrl(avatarImage) }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholderBox}>
                <Ionicons name="camera-outline" size={32} color={colors.textDim} />
              </View>
            )}
            <View style={styles.editIconWrap}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Text Inputs */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell customers about your shop..."
            placeholderTextColor={colors.textDim}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location City</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowCityPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: locationCity ? colors.text : colors.textDim, fontSize: 16 }}>
              {locationCity || 'Select a City'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textDim} style={{ position: 'absolute', right: 16, top: 14 }} />
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
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
                    setLocationCity(item)
                    setShowCityPicker(false)
                  }}
                >
                  <Text style={[styles.cityOptionText, locationCity === item && { color: '#2563eb', fontWeight: '700' }]}>{item}</Text>
                  {locationCity === item && <Ionicons name="checkmark" size={20} color="#2563eb" />}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  saveBtn: {
    backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center'
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  
  coverUpload: {
    width: '100%', height: 160, borderRadius: 12, backgroundColor: colors.border,
    marginBottom: 24, position: 'relative', overflow: 'hidden'
  },
  coverImage: { width: '100%', height: '100%' },
  placeholderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: colors.textDim, marginTop: 8, fontSize: 14, fontWeight: '500' },
  
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatarUpload: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.border,
    position: 'relative', overflow: 'hidden'
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  editIconWrap: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center'
  },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    justifyContent: 'center', minHeight: 52,
    color: colors.text, fontSize: 16
  },
  textArea: { height: 100, fontSize: 16, color: colors.text },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cityOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  cityOptionText: { fontSize: 16, color: colors.text },
})
