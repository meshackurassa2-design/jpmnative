// app/(settings)/security.tsx
import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { router } from 'expo-router'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const supabase = createClient()
  const { user } = useAuth()
  
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [deletePw, setDeletePw] = useState('')
  const [showDeletePw, setShowDeletePw] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleDeleteAccount = async () => {
    if (!deletePw) {
      Alert.alert('Error', 'Please enter your password to confirm deletion.')
      return
    }
    
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure? This action cannot be undone and will permanently delete your profile, posts, and all data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true)
            // 1. Verify password
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: user?.email || '',
              password: deletePw
            })
            
            if (signInError) {
              setDeleteLoading(false)
              Alert.alert('Authentication Failed', 'Incorrect password. Cannot delete account.')
              return
            }

            // 2. Delete user entirely from auth and public schema via RPC
            const { error: deleteErr } = await supabase.rpc('delete_user_account')
            if (deleteErr) {
              setDeleteLoading(false)
              Alert.alert('Error', 'Failed to completely delete account.')
              return
            }
            
            // 3. Sign out
            await supabase.auth.signOut()
            setDeleteLoading(false)
            router.replace('/(auth)/welcome-language')
          }
        }
      ]
    )
  }

  const handleChangePassword = async () => {
    if (!newPw || !confirmPw) {
      Alert.alert('Error', 'Please fill in all required fields.')
      return
    }
    if (newPw !== confirmPw) {
      Alert.alert('Error', 'New passwords do not match.')
      return
    }
    if (newPw.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setSuccess(false)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionDesc}>Manage your password and account protection.</Text>

        {success && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text style={styles.successText}>Password changed successfully!</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change Password</Text>
          <Text style={styles.cardDesc}>Update your account password.</Text>

          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showCurrent}
              placeholder="Current password"
              placeholderTextColor="#a1a1aa"
              value={currentPw}
              onChangeText={setCurrentPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
              <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color="#71717a" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showNew}
              placeholder="New password"
              placeholderTextColor="#a1a1aa"
              value={newPw}
              onChangeText={setNewPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
              <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#71717a" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showConfirm}
              placeholder="Confirm new password"
              placeholderTextColor="#a1a1aa"
              value={confirmPw}
              onChangeText={setConfirmPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#71717a" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleChangePassword} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Update Password</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1 }]}>
          <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Danger Zone</Text>
          <Text style={styles.cardDesc}>Permanently delete your account and all associated data. This action cannot be undone.</Text>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showDeletePw}
              placeholder="Enter password to delete"
              placeholderTextColor="#a1a1aa"
              value={deletePw}
              onChangeText={setDeletePw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowDeletePw(!showDeletePw)} style={styles.eyeBtn}>
              <Ionicons name={showDeletePw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#71717a" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btnDanger} onPress={handleDeleteAccount} disabled={deleteLoading}>
            {deleteLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnDangerText}>Delete Account</Text>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  content: { padding: 20 },
  sectionDesc: { fontSize: 15, color: colors.textDim, marginBottom: 20, lineHeight: 22 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  successText: { color: '#16a34a', fontWeight: '600', fontSize: 15 },
  card: { backgroundColor: colors.background, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: colors.textDim, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textDim, marginBottom: 8, marginTop: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text },
  eyeBtn: { paddingHorizontal: 14 },
  btn: { backgroundColor: colors.text, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  btnDanger: { backgroundColor: '#ef4444', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnDangerText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  infoDesc: { fontSize: 14, color: colors.textDim, lineHeight: 20 },
})
