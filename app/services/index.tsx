import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { Skeleton } from '../../components/Skeleton'

export default function ServicesHubScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [freelancers, setFreelancers] = useState<any[]>([])

  useEffect(() => {
    const fetchFreelancers = async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('status', 'active')
        .eq('category', 'Services & Freelance')
        .order('rating', { ascending: false })

      if (data && !error) {
        setFreelancers(data)
      }
      setLoading(false)
    }
    fetchFreelancers()
  }, [])

  const renderFreelancer = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/shop/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        {item.avatar_image ? (
          <Image source={{ uri: getCdnUrl(item.avatar_image) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color="#a1a1aa" />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.profession} numberOfLines={1}>{item.description || 'Independent Professional'}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#fbbf24" />
          <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : 'New'}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {item.location_city ? (
            <View style={styles.infoPill}>
              <Ionicons name="location-outline" size={12} color={colors.textDim} />
              <Text style={styles.infoPillText}>{item.location_city}</Text>
            </View>
          ) : null}
          <View style={styles.infoPill}>
            <Ionicons name="briefcase-outline" size={12} color={colors.textDim} />
            <Text style={styles.infoPillText}>Available</Text>
          </View>
        </View>
        
        <View style={styles.hireBtn}>
          <Text style={styles.hireBtnText}>View Profile</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hire a Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ marginBottom: 20 }}>
              <Skeleton width="100%" height={100} borderRadius={16} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={freelancers}
          keyExtractor={item => item.id}
          renderItem={renderFreelancer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🛠️</Text>
              <Text style={styles.emptyTitle}>No Professionals Yet</Text>
              <Text style={styles.emptyDesc}>
                Be the first to offer your services! Go to the marketplace and tap "Open a Shop".
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  listContent: { padding: 16, paddingBottom: 40 },
  
  card: {
    backgroundColor: colors.card || '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48, height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center'
  },
  headerText: { flex: 1, paddingRight: 8 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  profession: { fontSize: 13, color: colors.textDim },
  
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border
  },
  infoPillText: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  
  hireBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 12,
  },
  hireBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: colors.textDim, textAlign: 'center', lineHeight: 22 }
})
