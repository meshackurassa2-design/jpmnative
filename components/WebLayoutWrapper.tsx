import React from 'react'
import { View, Text, StyleSheet, Platform, useWindowDimensions, TouchableOpacity, ScrollView } from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '../lib/theme'
import { useAuth } from '../lib/auth'

export function WebLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 768
  const { colors } = useTheme()
  const { user } = useAuth()
  const pathname = usePathname()

  if (!isDesktop || !user) {
    return <>{children}</>
  }

  const NavItem = ({ icon, label, path, isSvg = false }: any) => {
    const isActive = pathname === path || (path !== '/' && pathname.startsWith(path))
    return (
      <TouchableOpacity 
        style={[styles.navItem, isActive && { backgroundColor: colors.card }]}
        onPress={() => router.push(path)}
        activeOpacity={0.7}
      >
        <View style={styles.navIcon}>
          {isSvg ? icon(isActive ? colors.primary : colors.text) : <Ionicons name={icon} size={28} color={isActive ? colors.primary : colors.text} />}
        </View>
        <Text style={[styles.navLabel, { color: isActive ? colors.primary : colors.text, fontWeight: isActive ? 'bold' : '600' }]}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Left Sidebar */}
      <View style={[styles.leftSidebar, { borderColor: colors.border }]}>
        <ScrollView contentContainerStyle={{ paddingVertical: 20 }}>
          <View style={styles.logoContainer}>
            <Text style={[styles.logoText, { color: colors.text }]}>JPM</Text>
          </View>

          <View style={styles.navContainer}>
            <NavItem icon="home-outline" label="Home" path="/" />
            <NavItem icon="search-outline" label="Search" path="/search" />
            <NavItem 
              isSvg={true} 
              icon={(color: string) => (
                <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  <Path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0z" />
                </Svg>
              )} 
              label="Dapaz AI" 
              path="/ai" 
            />
            <NavItem icon="cart-outline" label="Marketplace" path="/marketplace" />
            <NavItem icon="chatbubble-outline" label="Messages" path="/messages" />
            <NavItem icon="person-outline" label="Profile" path="/profile" />
          </View>

          <TouchableOpacity 
            style={[styles.postButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/create-post')}
            activeOpacity={0.8}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </ScrollView>
        

      </View>

      {/* Main Content (Centered Feed) */}
      <View style={[styles.mainContent, { borderColor: colors.border }]}>
        {children}
      </View>

      {/* Right Sidebar (Optional Widgets) */}
      {width >= 1024 && (
        <View style={styles.rightSidebar}>
          <View style={[styles.widgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.widgetTitle, { color: colors.text }]}>Trending</Text>
            <Text style={{ color: colors.textDim, marginTop: 8 }}>Discover what's happening right now in your network.</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  leftSidebar: {
    width: 275,
    borderRightWidth: 1,
    height: '100%',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  logoContainer: {
    paddingHorizontal: 12,
    marginBottom: 24,
    marginTop: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  navContainer: {
    marginBottom: 24,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    marginBottom: 8,
  },
  navIcon: {
    marginRight: 20,
    width: 28,
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 20,
  },
  postButton: {
    marginHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  userBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  mainContent: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    borderRightWidth: 1,
  },
  rightSidebar: {
    width: 320,
    paddingLeft: 24,
    paddingRight: 16,
    paddingTop: 24,
  },
  widgetCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  widgetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  }
})
