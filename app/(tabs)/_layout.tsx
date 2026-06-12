// app/(tabs)/_layout.tsx
// Native bottom tab navigator — NO iOS home indicator conflicts
import { Tabs, router } from 'expo-router'
import { Platform, Animated, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/theme';
import { useUI } from '../../lib/ui';
import { useEffect, useRef } from 'react'
import Svg, { Path } from 'react-native-svg'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const { isTabBarVisible } = useUI()
  const { colors } = useTheme()
  const tabHeight = 56 + insets.bottom
  
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isTabBarVisible ? 0 : tabHeight,
      useNativeDriver: true,
      bounciness: 0,
      speed: 12
    }).start()
  }, [isTabBarVisible])

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
        name="create-post-shortcut"
        options={{
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              onPress={() => router.push('/create-post')}
              style={{
                top: -10,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#8b5cf6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
                elevation: 5,
              }}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: '#6366f1',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Ionicons name="add" size={32} color="#fff" />
              </View>
            </TouchableOpacity>
          )
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/create-post');
          },
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
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={26} color={color} />
          ),
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
