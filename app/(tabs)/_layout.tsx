// app/(tabs)/_layout.tsx
// Native bottom tab navigator — NO iOS home indicator conflicts
import { Tabs, router } from 'expo-router'
import { Platform, Animated, StyleSheet, TouchableOpacity, View, useWindowDimensions, Text, DeviceEventEmitter } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/theme';
import { useUI } from '../../lib/ui';
import { useEffect, useRef, useState, useCallback } from 'react'
import Svg, { Path } from 'react-native-svg'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const { isTabBarVisible } = useUI()
  const { colors } = useTheme()
  const tabHeight = 56 + insets.bottom
  
  const anim = useRef(new Animated.Value(0)).current
  const { user } = useAuth()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const supabase = createClient()
  const lastTapRef = useRef({ home: 0, messages: 0 })

  const fetchUnread = useCallback(async () => {
    if (!user) return
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false)
    setUnreadMessages(count || 0)
  }, [user])

  useEffect(() => {
    fetchUnread()
  }, [fetchUnread])

  useEffect(() => {
    if (!user) return
    
    // Listen for new messages or reads
    const channelName = `tab-messages-${user.id}-${Date.now()}`
    const sub = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, fetchUnread)
      .subscribe()
      
    return () => { supabase.removeChannel(sub) }
  }, [user?.id])

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isTabBarVisible ? 0 : tabHeight,
      useNativeDriver: true,
      bounciness: 0,
      speed: 12
    }).start()
  }, [isTabBarVisible, tabHeight])

  const { width } = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 768

  return (
    <Animated.View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textDim,
          tabBarShowLabel: false,
          tabBarStyle: {
            display: isDesktop ? 'none' : 'flex',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.tabBar,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            height: tabHeight,
            paddingBottom: insets.bottom,
            elevation: 0,
            shadowOpacity: 0,
            transform: [{ translateY: anim }]
          },
          tabBarItemStyle: {
            paddingVertical: 8,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            const now = Date.now()
            if (now - lastTapRef.current.home < 300) {
              DeviceEventEmitter.emit('refresh_home')
            }
            lastTapRef.current.home = now
          }
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={focused ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              <Path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0z" />
            </Svg>
          ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'videocam' : 'videocam-outline'} size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="marketplace"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={26} color={color} />
              {unreadMessages > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -4, backgroundColor: '#ef4444', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.tabBar, paddingHorizontal: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            const now = Date.now()
            if (now - lastTapRef.current.messages < 300) {
              DeviceEventEmitter.emit('refresh_messages')
            }
            lastTapRef.current.messages = now
          }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
    </Animated.View>
  )
}
