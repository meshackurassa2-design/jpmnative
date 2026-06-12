import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Dimensions
} from 'react-native'
import { Link, router } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      Alert.alert('Login failed', error.message)
    } else {
      router.replace('/(tabs)')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background Shapes */}
      <View style={styles.bgShape1} />
      <View style={styles.bgShape2} />
      <View style={styles.bgShape3} />

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: 40, marginBottom: 40 }}>
          <Text style={styles.title}>Log in to your account</Text>
        </View>

        <View style={styles.formGroup}>
          <TextInput
            style={[styles.input, styles.inputTop]}
            placeholder="Email address"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <View style={styles.inputDivider} />
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.inputBottom, { flex: 1, borderWidth: 0 }]}
              placeholder="Password"
              placeholderTextColor="#666"
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
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot your password?</Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.loginBtnText}>Log in</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' }, // Force pitch black
  bgShape1: {
    position: 'absolute',
    left: -80,
    top: -50,
    width: 280,
    height: 380,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: '#222',
  },
  bgShape2: {
    position: 'absolute',
    left: -120,
    top: -100,
    width: 360,
    height: 480,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  bgShape3: {
    position: 'absolute',
    right: -80,
    bottom: -150,
    width: 250,
    height: 500,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: '#222',
  },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60, zIndex: 10 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  formGroup: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#222',
  },
  input: {
    height: 60,
    paddingHorizontal: 16, 
    fontSize: 16, 
    color: '#fff', 
    backgroundColor: '#0a0a0a',
  },
  inputTop: {
    borderBottomWidth: 0,
  },
  inputBottom: {
    borderTopWidth: 0,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  eyeIcon: {
    padding: 16,
  },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 16, marginBottom: 32 },
  forgotText: { fontSize: 13, color: '#999', fontWeight: '500' },
  loginBtn: {
    height: 56, backgroundColor: '#fff', borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  loginBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 48 },
  footerText: { fontSize: 14, color: '#888' },
  footerLink: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
