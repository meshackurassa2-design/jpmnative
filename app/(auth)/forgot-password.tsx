import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Dimensions
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'

const { width, height } = Dimensions.get('window')

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleReset = async () => {
    if (!email) { Alert.alert('Error', 'Please enter your email'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'jpm://reset-password',
    })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    setSent(true)
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

      <View style={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={{ marginBottom: 40 }}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'Check your email for a reset link.'
              : "Enter your email and we'll send you a reset link."}
          </Text>
        </View>

        {!sent && (
          <View style={styles.formGroup}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        )}

        {!sent && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleReset} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Send reset link</Text>}
          </TouchableOpacity>
        )}

        {sent && (
          <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.8}>
            <Text style={styles.submitBtnText}>Back to login</Text>
          </TouchableOpacity>
        )}
      </View>
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
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 60, zIndex: 10 },
  backBtn: { marginBottom: 32, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#999', lineHeight: 24 },
  formGroup: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
    marginBottom: 24,
  },
  input: {
    height: 60,
    paddingHorizontal: 16, 
    fontSize: 16, 
    color: '#fff', 
    backgroundColor: '#0a0a0a',
  },
  submitBtn: {
    height: 56, backgroundColor: '#fff', borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
})
