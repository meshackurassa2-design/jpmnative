import { getCdnUrl } from '../lib/cdn';
import { useTheme } from '../lib/theme';
import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Image, Modal, SafeAreaView, Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface GiphyPickerProps {
  visible: boolean
  onGifSelect: (url: string) => void
  onClose: () => void
}

const { width } = Dimensions.get('window')
const COLUMN_COUNT = 2
const PADDING = 16
const IMAGE_SIZE = (width - PADDING * 3) / COLUMN_COUNT

export function GiphyPicker({ visible, onGifSelect, onClose }: GiphyPickerProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [search, setSearch] = useState('')
  const [gifs, setGifs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiKey = 'qSdDjrUvi9NPEchoGgUrymB8qdcr2sLXn' // Giphy public test key

  useEffect(() => {
    if (!visible) return
    const fetchGifs = async () => {
      setLoading(true)
      setError(null)
      const endpoint = search
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(search)}&limit=20`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20`

      try {
        const res = await fetch(endpoint)
        const data = await res.json()
        if (res.status === 403) {
          setError('API_KEY_BANNED')
          setGifs([])
        } else if (!res.ok) {
          setError('FETCH_ERROR')
        } else {
          setGifs(data.data || [])
        }
      } catch (e) {
        setError('NETWORK_ERROR')
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => fetchGifs(), 500)
    return () => clearTimeout(timer)
  }, [search, visible])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GIPHY</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#a1a1aa" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search GIPHY..."
            placeholderTextColor="#a1a1aa"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />}
        </View>

        {error === 'API_KEY_BANNED' ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>API Key Blocked</Text>
            <Text style={styles.errorText}>Giphy's public testing key is dead. To use GIFs, please add your own free key.</Text>
          </View>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={item => item.id}
            numColumns={COLUMN_COUNT}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.gifItem}
                onPress={() => {
                  onGifSelect(item.images.original.url)
                  onClose()
                }}
              >
                <Image
                  source={{ uri: getCdnUrl(item.images.fixed_width.url) }}
                  style={styles.gifImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
            ListEmptyComponent={!loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {search ? 'No GIFs found' : 'Feeling lucky? Try searching...'}
                </Text>
              </View>
            ) : null}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1, color: colors.text },
  closeBtn: { padding: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text },
  list: { padding: PADDING / 2 },
  gifItem: {
    padding: PADDING / 2,
  },
  gifImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' },
  errorText: { fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 20 },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontStyle: 'italic', fontSize: 14 },
})
