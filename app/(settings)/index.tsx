import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Share } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { createClient } from '../../lib/supabase'
import { useUI } from '../../lib/ui'
import { Skeleton } from '../../components/Skeleton'

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user, signOut } = useAuth()
  const { showActionSheet } = useUI()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [profile, setProfile] = React.useState<any>(null)

  React.useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        setProfile(data)
        setIsAdmin(!!data?.is_admin)
      })
  }, [user])

  const handleSignOut = () => {
    showActionSheet('Are you sure you want to log out?', [
      { text: 'Log out', style: 'destructive', icon: 'log-out', onPress: async () => {
        await signOut()
        router.replace('/(auth)/login')
      }},
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const SettingsItem = ({ icon, title, onPress, danger }: { icon: any, title: string, onPress?: () => void, danger?: boolean }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress || (() => {})}
      activeOpacity={0.6}
    >
      <View style={styles.itemLeft}>
        <Ionicons name={icon} size={22} color={danger ? '#ef4444' : '#fff'} style={{ width: 28 }} />
        <Text style={[styles.itemTitle, danger && { color: '#ef4444' }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#444" />
    </TouchableOpacity>
  )

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>

      {/* Profile Header */}
      {profile ? (
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/(settings)/edit-profile')} activeOpacity={0.8}>
          {profile.avatar_url ? (
            <Image source={{ uri: getCdnUrl(profile.avatar_url) }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{profile.full_name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.full_name || profile.username || 'User'}</Text>
          </View>
          <View style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.profileCard}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <View style={[styles.profileInfo, { marginLeft: 16 }]}>
            <Skeleton width={140} height={20} borderRadius={6} />
          </View>
          <Skeleton width={60} height={34} borderRadius={20} />
        </View>
      )}

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="person-outline" title="Edit Profile" onPress={() => router.push('/(settings)/edit-profile')} />
          <SettingsItem icon="checkmark-circle-outline" title="Get Verified (Blue Check)" onPress={() => router.push('/(settings)/verification')} />
          <SettingsItem icon="lock-closed-outline" title="Privacy Policy" onPress={() => router.push('/(settings)/privacy')} />
          <SettingsItem icon="document-text-outline" title="Terms of Service" onPress={() => router.push('/(settings)/terms')} />
          <SettingsItem icon="heart-outline" title="My Wishlist" onPress={() => router.push('/(settings)/wishlist')} />
          <SettingsItem icon="bookmark-outline" title="Saved Posts" onPress={() => router.push('/(settings)/bookmarks')} />
          <SettingsItem icon="shield-checkmark-outline" title="Security" onPress={() => router.push('/(settings)/security')} />
        </View>
      </View>

      {/* Marketplace */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Marketplace</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="bag-check-outline" title="Purchases" onPress={() => router.push('/(settings)/purchases')} />
          <SettingsItem icon="storefront-outline" title="Store Dashboard" onPress={() => router.push('/(settings)/store-dashboard')} />
        </View>
      </View>

      {/* Creator */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Creator</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="cash-outline" title="Monetization" onPress={() => router.push('/(settings)/monetization')} />
          <SettingsItem icon="megaphone-outline" title="Ads Management" onPress={() => router.push('/(settings)/ads')} />
        </View>
      </View>

      {/* Admin */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <View style={styles.sectionCard}>
            <SettingsItem icon="shield-outline" title="Admin Dashboard" onPress={() => router.push('/(settings)/admin')} />
            <SettingsItem icon="briefcase-outline" title="Marketplace Shops" onPress={() => router.push('/(settings)/marketplace-admin')} />
          </View>
        </View>
      )}

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="sunny-outline" title="Appearance" onPress={() => router.push('/(settings)/appearance')} />
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support & Guides</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="compass-outline" title="App Features Tour" onPress={() => router.push('/onboarding')} />
          <SettingsItem icon="storefront-outline" title="Seller Features Tour" onPress={() => router.push('/seller-onboarding')} />
          <SettingsItem icon="share-social-outline" title="Invite Friends 🎁" onPress={() => Share.share({ message: `Join me on Dapaz — the app for Tanzanian entrepreneurs! 🚀\n\nBuy, sell, connect and grow your business.\n\nDownload now: https://jpmtz.online` })} />
          <SettingsItem icon="help-circle-outline" title="Help & Support" onPress={() => router.push('/(settings)/help')} />
          <SettingsItem icon="information-circle-outline" title="About App" onPress={() => router.push('/(settings)/about')} />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <View style={[styles.sectionCard, { marginTop: 12 }]}>
          <SettingsItem icon="log-out-outline" title="Log out" onPress={handleSignOut} danger />
        </View>
      </View>

    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Pitch black to match our theme
  },
  list: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 8,
    marginBottom: 32,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32, marginRight: 16,
  },
  avatarFallback: {
    backgroundColor: '#111', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: {
    fontSize: 24, fontWeight: '700', color: '#fff'
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4,
  },
  profileUsername: {
    fontSize: 15, color: '#888', fontWeight: '500'
  },
  editBtn: {
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
})
