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
import { useTranslation } from '../../lib/i18n'

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user, signOut } = useAuth()
  const { showActionSheet } = useUI()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [profile, setProfile] = React.useState<any>(null)
  const { lang, setLang, t } = useTranslation()

  const handleLanguageChange = () => {
    showActionSheet('Select App Language / Chagua Lugha', [
      { text: 'English', onPress: () => setLang('en') },
      { text: 'Kiswahili', onPress: () => setLang('sw') },
      { text: 'Kisukuma (Sukuma)', onPress: () => setLang('suk') },
      { text: 'Kichagga (Chagga)', onPress: () => setLang('cha') },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  React.useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        setProfile(data)
        setIsAdmin(!!data?.is_admin)
      })
  }, [user])

  const handleSignOut = () => {
    showActionSheet(t('logout_confirm') || 'Are you sure you want to log out?', [
      { text: t('logout') || 'Log out', style: 'destructive', icon: 'log-out', onPress: async () => {
        await signOut()
        router.replace('/(auth)/login')
      }},
      { text: t('cancel') || 'Cancel', style: 'cancel', onPress: () => {} }
    ])
  }

  const SettingsItem = ({ icon, title, onPress, danger }: { icon: any, title: string, onPress?: () => void, danger?: boolean }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress || (() => {})}
      activeOpacity={0.6}
    >
      <View style={styles.itemLeft}>
        <Ionicons name={icon} size={22} color={danger ? '#ef4444' : colors.text} style={{ width: 28 }} />
        <Text style={[styles.itemTitle, danger && { color: '#ef4444' }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
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
        <Text style={styles.sectionTitle}>{t('account')}</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="person-outline" title={t('edit_profile')} onPress={() => router.push('/(settings)/edit-profile')} />
          <SettingsItem icon="checkmark-circle-outline" title={t('get_verified')} onPress={() => router.push('/(settings)/verification')} />
          <SettingsItem icon="book-outline" title={t('legacy')} onPress={() => router.push('/(settings)/magufuli-legacy')} />
          <SettingsItem icon="lock-closed-outline" title={t('privacy_policy')} onPress={() => router.push('/(settings)/privacy')} />
          <SettingsItem icon="document-text-outline" title={t('terms_of_service')} onPress={() => router.push('/(settings)/terms')} />
          <SettingsItem icon="heart-outline" title={t('my_wishlist')} onPress={() => router.push('/(settings)/wishlist')} />
          <SettingsItem icon="bookmark-outline" title={t('saved_posts')} onPress={() => router.push('/(settings)/bookmarks')} />
          <SettingsItem icon="shield-checkmark-outline" title={t('security')} onPress={() => router.push('/(settings)/security')} />
        </View>
      </View>

      {/* Marketplace */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('marketplace')}</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="bag-check-outline" title={t('purchases')} onPress={() => router.push('/(settings)/purchases')} />
          <SettingsItem icon="storefront-outline" title={t('store_dashboard')} onPress={() => router.push('/(settings)/store-dashboard')} />
          <SettingsItem icon="medal-outline" title={t('trust_center')} onPress={() => router.push('/(settings)/trust-center')} />
        </View>
      </View>

      {/* Creator */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('creator')}</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="cash-outline" title={t('monetization')} onPress={() => router.push('/(settings)/monetization')} />
          <SettingsItem icon="briefcase-outline" title={t('become_pro')} onPress={() => router.push('/(settings)/register-pro')} />
        </View>
      </View>

      {/* Admin */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin')}</Text>
          <View style={styles.sectionCard}>
            <SettingsItem icon="shield-outline" title={t('admin_dashboard')} onPress={() => router.push('/(settings)/admin')} />
            <SettingsItem icon="briefcase-outline" title={t('marketplace_shops')} onPress={() => router.push('/(settings)/marketplace-admin')} />
            <SettingsItem icon="megaphone-outline" title={t('ads_management')} onPress={() => router.push('/(settings)/ads')} />
          </View>
        </View>
      )}

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('preferences')}</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="language-outline" title={t('language') || 'App Language'} onPress={handleLanguageChange} />
          <SettingsItem icon="sunny-outline" title={t('appearance')} onPress={() => router.push('/(settings)/appearance')} />
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support_guides')}</Text>
        <View style={styles.sectionCard}>
          <SettingsItem icon="compass-outline" title={t('app_tour')} onPress={() => router.push('/onboarding')} />
          <SettingsItem icon="storefront-outline" title={t('seller_tour')} onPress={() => router.push('/seller-onboarding')} />
          <SettingsItem icon="share-social-outline" title={t('invite_friends')} onPress={() => Share.share({ message: `Join me on Dapaz — the app for Tanzanian entrepreneurs! 🚀\n\nBuy, sell, connect and grow your business.\n\nDownload now: https://jpmtz.online` })} />
          <SettingsItem icon="help-circle-outline" title={t('help_support')} onPress={() => router.push('/(settings)/help')} />
          <SettingsItem icon="information-circle-outline" title={t('about_app')} onPress={() => router.push('/(settings)/about')} />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <View style={[styles.sectionCard, { marginTop: 12 }]}>
          <SettingsItem icon="log-out-outline" title={t('logout')} onPress={handleSignOut} danger />
        </View>
      </View>

    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Match theme
  },
  list: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 8,
    marginBottom: 32,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32, marginRight: 16,
  },
  avatarFallback: {
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: {
    fontSize: 24, fontWeight: '700', color: colors.text
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4,
  },
  profileUsername: {
    fontSize: 15, color: colors.textDim, fontWeight: '500'
  },
  editBtn: {
    backgroundColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: colors.background,
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
    color: colors.text,
    fontWeight: '500',
  },
})
