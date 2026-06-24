import { getCdnUrl } from '../lib/cdn';
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, StatusBar } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createClient } from '../lib/supabase'

const supabase = createClient()

type ConnectionUser = {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  is_verified: boolean
  settings?: any
}

export default function ConnectionsScreen() {
  const insets = useSafeAreaInsets()
  const { userId, initialTab } = useLocalSearchParams()
  
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>((initialTab as any) || 'followers')
  const [users, setUsers] = useState<ConnectionUser[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!userId) return
    let isActive = true
    
    const fetchConnections = async () => {
      setLoading(true)
      try {
        let fetchedUsers: ConnectionUser[] = []
        
        if (activeTab === 'followers') {
          const { data, error } = await supabase
            .from('follows')
            .select(`profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, is_verified, settings)`)
            .eq('following_id', userId)
            
          if (!error && data) {
            fetchedUsers = data.map((item: any) => item.profiles) as ConnectionUser[]
          } else {
            const { data: fbData } = await supabase
              .from('follows')
              .select(`profiles!follower_id(id, full_name, username, avatar_url, is_verified, settings)`)
              .eq('following_id', userId)
            if (fbData) fetchedUsers = fbData.map((item: any) => item.profiles) as ConnectionUser[]
          }
        } else {
          const { data, error } = await supabase
            .from('follows')
            .select(`profiles!follows_following_id_fkey(id, full_name, username, avatar_url, is_verified, settings)`)
            .eq('follower_id', userId)
            
          if (!error && data) {
            fetchedUsers = data.map((item: any) => item.profiles) as ConnectionUser[]
          } else {
            const { data: fbData } = await supabase
              .from('follows')
              .select(`profiles!following_id(id, full_name, username, avatar_url, is_verified, settings)`)
              .eq('follower_id', userId)
            if (fbData) fetchedUsers = fbData.map((item: any) => item.profiles) as ConnectionUser[]
          }
        }
        
        if (isActive) {
          setUsers(fetchedUsers.filter(u => u && u.id))
        }
      } catch (err) {
        console.error('Connections error:', err)
      } finally {
        if (isActive) setLoading(false)
      }
    }
    
    fetchConnections()
    return () => { isActive = false }
  }, [userId, activeTab])

  const renderItem = ({ item }: { item: ConnectionUser }) => (
    <TouchableOpacity 
      style={styles.userRow}
      onPress={() => router.push(`/user-profile?id=${item.id}`)}
      activeOpacity={0.7}
    >
      {item.avatar_url ? (
        <Image source={{ uri: getCdnUrl(item.avatar_url) }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{item.full_name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      
      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.fullName} numberOfLines={1}>{item.full_name}</Text>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={14} color="#2563eb" style={{ marginLeft: 4 }} />
          )}
          {item.settings?.account_type === 'news' && (
            <Ionicons name="newspaper" size={14} color="#eab308" style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
      </View>
      
      <Ionicons name="chevron-forward" size={18} color="#3f3f46" />
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Hide the default Stack header */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeTab === 'followers' ? 'Followers' : 'Following'}
        </Text>
        <View style={styles.backBtn} />
      </View>
      
      {/* Tab Selector — pill style, no underlines */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'followers' && styles.tabBtnActive]}
          onPress={() => setActiveTab('followers')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>Followers</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'following' && styles.tabBtnActive]}
          onPress={() => setActiveTab('following')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab} yet.</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#27272a',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#52525b',
  },
  tabTextActive: {
    color: '#fff',
  },
  loader: {
    paddingTop: 100,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 40,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#27272a',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#a1a1aa',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  username: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: '#52525b',
    fontSize: 16,
  },
})
