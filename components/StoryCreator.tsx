import { getCdnUrl } from '../lib/cdn';
// components/StoryCreator.tsx — Native story creation screen
import { useTheme } from '../lib/theme';
import React, { useState } from 'react'
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
import { LinearGradient } from 'expo-linear-gradient'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { BlurView } from 'expo-blur'

const BG_GRADIENTS = [
  ['#833ab4', '#fd1d1d', '#fcb045'], // Instagram Classic
  ['#8E2DE2', '#4A00E0'], // Purple to Deep Blue
  ['#FF416C', '#FF4B2B'], // Vibrant Red
  ['#f12711', '#f5af19'], // Fire
  ['#00B4DB', '#0083B0'], // Ocean Blue
  ['#11998e', '#38ef7d'], // Neon Green
  ['#1c1c1c', '#000000'], // Midnight Dark
  ['#C33764', '#1D2671'], // Sunset
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
  const [bgIndex, setBgIndex] = useState(0)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const currentGradient = BG_GRADIENTS[bgIndex]

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

  const cycleBg = () => setBgIndex(i => (i + 1) % BG_GRADIENTS.length)

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
        
        // Reliably read local file via fetch blob in React Native
        const res = await fetch(imageUri)
        const blob = await res.blob()
        const { data, error } = await supabase.storage.from('memes').upload(path, blob, {
          contentType: `image/${ext}`,
          upsert: true,
        })
        
        if (error) {
          Alert.alert('Upload failed', error.message)
          setUploading(false)
          return
        }
        
        if (data) {
          const { data: pubData } = supabase.storage.from('memes').getPublicUrl(path)
          imageUrl = pubData.publicUrl
        }
      } catch (e: any) {
        Alert.alert('Upload failed', e.message || 'Could not upload image. Try again.')
        setUploading(false)
        return
      }
    }

    const { error } = await supabase.from('stories').insert({
      creator_id: user.id,
      text_content: mode === 'text' ? text.trim() : null,
      image_url: imageUrl,
      bg_color: JSON.stringify(currentGradient),
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
        style={{ flex: 1, backgroundColor: '#000' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            
            {/* Background Layer */}
            <LinearGradient
              colors={currentGradient.length === 2 ? [currentGradient[0], currentGradient[1]] : [currentGradient[0], currentGradient[1], currentGradient[2]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            
            {mode === 'image' && imageUri && (
              <Image source={{ uri: imageUri }} style={styles.bgImage} resizeMode="contain" />
            )}


            {/* Text input overlay */}
            {mode === 'text' && (
              <View style={styles.textCenter}>
                <TextInput
                  style={styles.textInput}
                  value={text}
                  onChangeText={setText}
                  placeholder="Tap to type..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
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
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              {mode === 'text' && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={styles.iconBtn} onPress={cycleBg}>
                    <Ionicons name="color-palette" size={22} color="#fff" />
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
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.modeBtnText}> Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasContent && (
                <View style={styles.submitRow}>
                  <TouchableOpacity style={styles.iconBtn} onPress={pickImage}>
                    <Ionicons name="images" size={22} color="#fff" />
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
                        <Text style={styles.submitBtnText}>Share Story</Text>
                        <Ionicons name="paper-plane" size={16} color="#000" />
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
  container: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  bgImage: { ...StyleSheet.absoluteFillObject },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  textCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  textInput: {
    fontSize: 40, fontWeight: '900', textAlign: 'center',
    lineHeight: 48, width: '100%', color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, zIndex: 50,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, zIndex: 50,
  },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modeRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', alignSelf: 'center',
    padding: 6, borderRadius: 30,
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
  },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  modeBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  submitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 30,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  submitBtnText: { color: '#000000', fontSize: 16, fontWeight: '900' },
})
