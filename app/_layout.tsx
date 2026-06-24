// app/_layout.tsx
// Root layout — wraps the entire app with providers
import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../lib/auth'
import { CartProvider } from '../lib/cart'
import { LanguageProvider } from '../lib/i18n'
import { createClient } from '../lib/supabase'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { registerForPushNotificationsAsync } from '../lib/push'
import { SplashScreen } from '../components/SplashScreen'
import { WebLayoutWrapper } from '../components/WebLayoutWrapper'
import { UIProvider } from '../lib/ui'
import { ThemeProvider, useTheme } from '../lib/theme'
import { ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native'
import Constants from 'expo-constants'
// import mobileAds from 'react-native-google-mobile-ads'
// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

function PushNotificationSetup() {
  const { user } = useAuth()
  const supabase = createClient()
  const notificationListenerRef = useRef<any>(null)
  const responseListenerRef = useRef<any>(null)

  useEffect(() => {
    if (!user) return

    // Register for push and save token to DB
    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        await supabase
          .from('profiles')
          .update({ push_token: token } as any)
          .eq('id', user.id)
      }
    }).catch(e => console.log('Push setup error:', e))

    // Listen for foreground notifications
    notificationListenerRef.current = Notifications.addNotificationReceivedListener(() => {})

    // Handle tap on notification — route user to the right screen
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any
      if (data?.type === 'message' && data?.sender_id) {
        router.push(`/chat?id=${data.sender_id}`)
      } else if (data?.type === 'follow' && data?.actor_id) {
        router.push(`/user-profile?id=${data.actor_id}`)
      } else if (data?.type === 'like' || data?.type === 'comment') {
        router.push('/notifications')
      }
    })

    return () => {
      notificationListenerRef.current?.remove()
      responseListenerRef.current?.remove()
    }
  }, [user])

  return null
}

function AutoUpdateSetup() {
  // expo-updates OTA is disabled in this build — skip update checks to prevent startup crash
  return null
}

import { Platform } from 'react-native'

const KeyboardProvider = ({ children }: any) => <>{children}</>

function AppStack() {
  const { colors } = useTheme()
  const screenOpts = { 
    headerShown: false, 
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor: colors.background },
    animationDuration: 200,
  }
  const modalOpts = {
    headerShown: false,
    presentation: 'fullScreenModal' as const,
    contentStyle: { backgroundColor: colors.background },
    animation: 'slide_from_bottom' as const,
    animationDuration: 250,
  }
  
  const baseTheme = colors.background === '#000000' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  }
  return (
    <NavThemeProvider value={navTheme}>
      <Stack screenOptions={screenOpts}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ ...modalOpts }} />
      <Stack.Screen name="user-profile" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ ...modalOpts }} />
      <Stack.Screen name="cart" options={{ ...modalOpts }} />
      <Stack.Screen name="checkout" options={{ ...modalOpts }} />
      <Stack.Screen name="register-shop" options={{ ...modalOpts }} />
      <Stack.Screen name="shop/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="inventory" options={{ headerShown: false }} />
      <Stack.Screen name="inventory/add" options={{ ...modalOpts }} />
      <Stack.Screen name="inventory/ai-scan" options={{ ...modalOpts }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' as const, contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="seller-onboarding" options={{ headerShown: false, animation: 'fade' as const, contentStyle: { backgroundColor: colors.background } }} />
      </Stack>
    </NavThemeProvider>
  )
}

export default function RootLayout() {
  /*
  useEffect(() => {
    mobileAds().initialize().then(adapterStatuses => {
      console.log('AdMob initialized', adapterStatuses);
    }).catch(e => console.log('AdMob init error', e));
  }, []);
  */

  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  )
}

function ThemedRoot() {
  const { colors } = useTheme()
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardProvider>
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>
              <UIProvider>
                <PushNotificationSetup />
                <AutoUpdateSetup />
                <StatusBar style="auto" />
              <WebLayoutWrapper>
                <AppStack />
                <SplashScreen />
              </WebLayoutWrapper>
              </UIProvider>
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}

import { ErrorBoundaryProps } from 'expo-router'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#990000', paddingTop: 50, paddingHorizontal: 20 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Crash Detected 💥
      </Text>
      <Text style={{ color: 'white', fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
        {error?.message || 'Unknown Error'}
      </Text>
      <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8 }}>
        <Text style={{ color: '#ffcccc', fontSize: 12, fontFamily: 'monospace' }}>
          {error?.stack || 'No stack trace available.'}
        </Text>
      </ScrollView>
      <TouchableOpacity 
        onPress={retry}
        style={{ backgroundColor: 'white', padding: 15, borderRadius: 8, alignItems: 'center', marginVertical: 20 }}>
        <Text style={{ color: '#990000', fontWeight: 'bold', fontSize: 16 }}>Retry App</Text>
      </TouchableOpacity>
    </View>
  )
}
