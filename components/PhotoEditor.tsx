import React, { useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, ActivityIndicator, ScrollView, Image, Platform } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import ViewShot from 'react-native-view-shot'

const { width } = Dimensions.get('window')
const PREVIEW_SIZE = width

const FILTERS = [
  { id: 'normal', label: 'Normal', overlay: null },
  { id: 'g6', label: 'G6 (Trending)', overlay: 'rgba(255, 100, 0, 0.15)' },
  { id: 'retro', label: 'Retro Glow', overlay: 'rgba(255, 180, 50, 0.2)' },
  { id: 'aesthetic', label: 'Aesthetic', overlay: 'rgba(255, 200, 220, 0.2)' },
  { id: 'cyber', label: 'Cyberpunk', overlay: 'rgba(138, 43, 226, 0.25)' },
  { id: 'fade', label: 'Fade', overlay: 'rgba(0, 0, 0, 0.4)' },
  { id: 'bright', label: 'Bright', overlay: 'rgba(255, 255, 255, 0.2)' },
]

interface PhotoEditorProps {
  visible: boolean;
  imageUri: string;
  onSave: (uri: string) => void;
  onCancel: () => void;
}

export function PhotoEditor({ visible, imageUri, onSave, onCancel }: PhotoEditorProps) {
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0])
  const [isProcessing, setIsProcessing] = useState(false)
  const viewShotRef = useRef<ViewShot>(null)
  const insets = useSafeAreaInsets()
  const topPadding = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 54 : Constants.statusBarHeight)

  const handleSave = async () => {
    if (selectedFilter.id === 'normal') {
      onSave(imageUri)
      return
    }

    setIsProcessing(true)
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture()
        onSave(uri)
      }
    } catch (e) {
      console.error('Failed to capture edited photo', e)
      onSave(imageUri)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!visible || !imageUri) return null

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.container, { paddingTop: topPadding, paddingBottom: insets.bottom || 24 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Studio Editor</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Preview Area */}
        <View style={styles.previewContainer}>
          <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}>
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {selectedFilter.overlay && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: selectedFilter.overlay }]} />
            )}
          </ViewShot>
        </View>

        {/* Filter Selection Area */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map(filter => {
              const isActive = selectedFilter.id === filter.id
              return (
                <TouchableOpacity 
                  key={filter.id} 
                  style={[styles.filterThumbContainer, isActive && styles.filterThumbActive]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <View style={styles.filterThumbWrapper}>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {filter.overlay && (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.overlay }]} />
                    )}
                  </View>
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: '#222'
  },
  headerBtn: { minWidth: 80, justifyContent: 'center' },
  cancelText: { color: '#ffffff', fontSize: 16 },
  saveText: { color: '#3b82f6', fontSize: 16, fontWeight: '700', textAlign: 'right' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  previewContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  filterSection: { height: 140, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 16 },
  filterScroll: { paddingHorizontal: 16, gap: 16 },
  filterThumbContainer: { alignItems: 'center', gap: 8 },
  filterThumbWrapper: { 
    width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
    borderWidth: 2, borderColor: '#333'
  },
  filterThumbActive: { opacity: 1 },
  filterLabel: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterLabelActive: { color: '#fff', fontWeight: '800' }
})
