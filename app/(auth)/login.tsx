import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Dimensions, Animated
} from 'react-native'
import { Link, router } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from '../../lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window')

export default function LoginScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isDark = colors.isDark;
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()

  const animValue = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;
  const slideAnim = React.useRef(new Animated.Value(Platform.OS === 'web' ? 0 : 30)).current;

  React.useEffect(() => {
    // Check if new user should be sent directly to onboarding without waiting for any click on mobile
    if (Platform.OS !== 'web') {
      AsyncStorage.getItem('@has_seen_onboarding_v2').then(seen => {
        if (!seen) {
          router.replace('/onboarding');
        }
      });
    }

    if (Platform.OS !== 'web') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    }

    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 25000,
        useNativeDriver: true,
      })
    ).start();
  }, [animValue, fadeAnim, slideAnim]);

  const spin1 = animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = animValue.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)

    let finalEmail = email.trim()
    
    // If they typed '@username', strip the @
    if (finalEmail.startsWith('@')) {
      finalEmail = finalEmail.substring(1)
    }
    
    // If it doesn't look like an email, assume it's a username
    if (!finalEmail.includes('@')) {
      const cleanUsername = finalEmail.toLowerCase().replace(/[^a-z0-9_]/g, '')
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
        p_username: cleanUsername
      })
      
      if (resolvedEmail) {
        finalEmail = resolvedEmail
      } else {
        setLoading(false)
        console.error("RPC Error:", rpcError)
        Alert.alert('Login failed', rpcError ? `RPC Error: ${rpcError.message}` : 'Could not find a user with that username.')
        return
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password })
    setLoading(false)
    if (error) {
      Alert.alert('Login failed', error.message)
    } else {
      router.replace('/(tabs)')
    }
  }

  // Catch: If a user clicks Sign Up and hasn't gone through onboarding on mobile, guide them first!
  const handleSignUpPress = async () => {
    if (Platform.OS === 'web') {
      router.push('/(auth)/signup');
      return;
    }
    const seen = await AsyncStorage.getItem('@has_seen_onboarding_v2');
    if (!seen) {
      router.push('/onboarding');
    } else {
      router.push('/(auth)/signup');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background Shapes */}
      <Animated.View style={[styles.bgShape1, { transform: [{ rotate: spin1 }] }]} />
      <Animated.View style={[styles.bgShape2, { transform: [{ rotate: spin2 }] }]} />
      <Animated.View style={[styles.bgShape3, { transform: [{ rotate: spin1 }] }]} />

      <Animated.ScrollView 
        contentContainerStyle={styles.inner} 
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <View style={{ marginTop: 40, marginBottom: 24 }}>
          <Text style={styles.title}>{t('login_title')}</Text>
        </View>

        {/* New User Guide Banner & Catch */}
        <TouchableOpacity 
          style={styles.newTourCard} 
          activeOpacity={0.85}
          onPress={() => router.push('/onboarding')}
        >
          <View style={styles.newTourIconBg}>
            <Ionicons name="sparkles" size={20} color="#3b82f6" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.newTourTitle}>New to JPM? Take a Quick Tour</Text>
            <Text style={styles.newTourSub}>See how to buy, sell, and earn real money</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>

        <View style={{ gap: 16 }}>
          <TextInput
            style={styles.input}
            placeholder={t('email')}
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="default"
            autoComplete="email"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              placeholder={t('password')}
              placeholderTextColor={colors.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={colors.textDim} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.forgotBtn}
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          <Text style={styles.forgotText}>{t('forgot_password')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.loginBtnText}>{t('sign_in')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('create_account_prompt')} </Text>
          <TouchableOpacity 
            onPress={handleSignUpPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.footerLink}>{t('sign_up')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bgShape1: {
    position: 'absolute',
    left: -80,
    top: -50,
    width: 280,
    height: 380,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: isDark ? '#222' : '#e5e7eb',
  },
  bgShape2: {
    position: 'absolute',
    left: -120,
    top: -100,
    width: 360,
    height: 480,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: isDark ? '#1a1a1a' : '#f3f4f6',
  },
  bgShape3: {
    position: 'absolute',
    right: -80,
    bottom: -150,
    width: 250,
    height: 500,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: isDark ? '#222' : '#e5e7eb',
  },
  inner: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingHorizontal: 28, 
    paddingVertical: 60, 
    zIndex: 10,
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center'
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  input: {
    height: 60,
    paddingHorizontal: 16, 
    fontSize: 16, 
    color: colors.text, 
    backgroundColor: isDark ? '#0a0a0a' : '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? '#222' : '#e5e7eb',
    textAlign: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#0a0a0a' : '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? '#222' : '#e5e7eb',
    overflow: 'hidden',
  },
  eyeIcon: {
    padding: 16,
  },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 16, marginBottom: 32 },
  forgotText: { fontSize: 13, color: colors.textDim, fontWeight: '500' },
  loginBtn: {
    height: 56, backgroundColor: colors.text, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  loginBtnText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 48 },
  footerText: { fontSize: 14, color: colors.textDim },
  footerLink: { fontSize: 14, color: colors.text, fontWeight: '700' },
  newTourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#141414' : '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? '#262626' : '#e2e8f0',
  },
  newTourIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? '#262626' : '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newTourTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  newTourSub: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
  },
});
