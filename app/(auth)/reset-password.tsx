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

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()

  const handleUpdatePassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }
    
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Success', 'Your password has been updated!')
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

      <View style={styles.inner}>
        <View style={{ marginBottom: 40 }}>
          <Text style={styles.title}>New password</Text>
          <Text style={styles.subtitle}>
            Please enter your new password below.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              placeholder="New Password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
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

        <TouchableOpacity style={styles.submitBtn} onPress={handleUpdatePassword} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Update password</Text>}
        </TouchableOpacity>
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
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60, zIndex: 10 },
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  eyeIcon: {
    padding: 16,
  },
  submitBtn: {
    height: 56, backgroundColor: '#fff', borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
})
