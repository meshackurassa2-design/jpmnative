import { getCdnUrl } from '../lib/cdn';
// components/StoryCreator.tsx — Native story creation screen
import { useTheme } from '../lib/theme';
import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Image, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG_COLORS = [
  '#000000', '#111111', '#18181b', '#0f172a',
  '#1c1917', '#27272a', '#3f3f46', '#ffffff',
  '#1e3a5f', '#2d1b69', '#4a0e0e', '#0d4a2a',
]

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function StoryCreator({ onClose, onCreated }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const insets = useSafeAreaInsets()

  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('')
  const [bgColorIndex, setBgColorIndex] = useState(0)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const bgColor = BG_COLORS[bgColorIndex]
  const textColor = bgColor === '#ffffff' ? '#000000' : '#ffffff'

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setMode('image')
    }
  }

  const cycleBg = () => setBgColorIndex(i => (i + 1) % BG_COLORS.length)

  const handleSubmit = async () => {
    if (!user || uploading) return
    if (mode === 'text' && !text.trim()) {
      Alert.alert('Add some text first!')
      return
    }
    if (mode === 'image' && !imageUri) {
      Alert.alert('Pick an image first!')
      return
    }

    setUploading(true)
    let imageUrl: string | null = null

    if (imageUri && mode === 'image') {
      try {
        const ext = imageUri.split('.').pop() || 'jpg'
        const path = `stories/${user.id}/${Date.now()}.${ext}`
        const resp = await fetch(imageUri)
        const blob = await resp.blob()
        const { data, error } = await supabase.storage.from('memes').upload(path, blob, {
          contentType: `image/${ext}`,
          upsert: true,
        })
        if (!error && data) {
          const { data: pubData } = supabase.storage.from('memes').getPublicUrl(path)
          imageUrl = pubData.publicUrl
        }
      } catch (e) {
        Alert.alert('Upload failed', 'Could not upload image. Try again.')
        setUploading(false)
        return
      }
    }

    const { error } = await supabase.from('stories').insert({
      creator_id: user.id,
      text_content: mode === 'text' ? text.trim() : null,
      image_url: imageUrl,
      bg_color: mode === 'text' ? bgColor : '#000000',
    })

    setUploading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      onCreated()
      onClose()
    }
  }

  const hasContent = (mode === 'text' && text.trim().length > 0) || (mode === 'image' && !!imageUri)

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.container, { backgroundColor: mode === 'image' ? '#000000' : bgColor }]}>
            {/* Background image preview */}
            {mode === 'image' && imageUri ? (
              <Image source={{ uri: getCdnUrl(imageUri) }} style={styles.bgImage} resizeMode="cover" />
            ) : null}

            {/* Dark overlay for image mode */}
            {mode === 'image' && <View style={styles.darkOverlay} />}

            {/* Text input overlay */}
            {mode === 'text' && (
              <View style={styles.textCenter}>
                <TextInput
                  style={[styles.textInput, { color: textColor }]}
                  value={text}
                  onChangeText={setText}
                  placeholder="Type something..."
                  placeholderTextColor={textColor === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                  multiline
                  maxLength={160}
                  textAlign="center"
                  autoFocus
                />
              </View>
            )}

            {/* Top controls */}
            <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              {mode === 'text' && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => Keyboard.dismiss()}>
                    <Ionicons name="chevron-down" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={cycleBg}>
                    <Ionicons name="color-palette-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom controls */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              {!hasContent && (
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    onPress={() => setMode('text')}
                    style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]}
                  >
                    <Text style={styles.modeBtnText}>Aa Text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickImage}
                    style={[styles.modeBtn, mode === 'image' && styles.modeBtnActive]}
                  >
                    <Ionicons name="image-outline" size={18} color="#fff" />
                    <Text style={styles.modeBtnText}> Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasContent && (
                <View style={styles.submitRow}>
                  <TouchableOpacity style={styles.iconBtn} onPress={pickImage}>
                    <Ionicons name="images-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, uploading && { opacity: 0.6 }]}
                    onPress={() => { Keyboard.dismiss(); handleSubmit() }}
                    disabled={uploading}
                    activeOpacity={0.85}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>Your Story</Text>
                        <Ionicons name="chevron-forward" size={16} color="#000" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  bgImage: { ...StyleSheet.absoluteFillObject },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  textCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  textInput: {
    fontSize: 36, fontWeight: '900', textAlign: 'center',
    lineHeight: 44, width: '100%',
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, zIndex: 50,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, zIndex: 50,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  modeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  submitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ffffff', borderRadius: 28,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  submitBtnText: { color: '#000000', fontSize: 15, fontWeight: '900' },
})
