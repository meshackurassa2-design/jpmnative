// app/(settings)/edit-profile.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, ActivityIndicator, Image
} from 'react-native'
import { router } from 'expo-router'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { Ionicons } from '@expo/vector-icons'
import { getCdnUrl } from '../../lib/cdn'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form fields
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [verificationReason, setVerificationReason] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (data) {
        setFullName(data.full_name || '')
        setUsername(data.username || '')
        setBio(data.bio || '')
        setTiktok(data.tiktok_url || '')
        setInstagram(data.instagram_url || '')
        setFacebook(data.facebook_url || '')
        setWebsite(data.website || '')
        setIsPrivate(data.is_private || false)
        setAvatarUrl(data.avatar_url || null)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const handleSave = async () => {
    if (!user) return
    if (!fullName.trim() || !username.trim()) {
      Alert.alert('Error', 'Full Name and Username are required.')
      return
    }

    setSaving(true)
    
    // Clean username
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')

    // Check if username is taken by someone else
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .neq('id', user.id)
      .single()

    if (existing) {
      Alert.alert('Error', 'Username is already taken.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        tiktok_url: tiktok.trim(),
        instagram_url: instagram.trim(),
        facebook_url: facebook.trim(),
        website: website.trim(),
        avatar_url: avatarUrl,
      })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Success', 'Your profile has been updated.')
      router.back()
    }
  }

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    })
    if (!result.canceled && result.assets[0].base64) {
      setUploadingAvatar(true)
      try {
        const ext = result.assets[0].uri.split('.').pop() || 'jpg'
        const path = `${user?.id}_${Date.now()}.${ext}`
        const { error } = await supabase.storage
          .from('avatars')
          .upload(path, decode(result.assets[0].base64), { contentType: `image/${ext}`, upsert: true })
        if (error) throw error
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        setAvatarUrl(urlData.publicUrl)
      } catch (e: any) {
        Alert.alert('Upload Failed', e.message)
      } finally {
        setUploadingAvatar(false)
      }
    }
  }

  const requestVerification = async () => {
    if (!user) return
    if (!verificationReason.trim()) {
      Alert.alert('Missing Info', 'Please provide a reason why you should be verified (e.g. your role, business, or following).')
      return
    }

    Alert.alert(
      'Request Verification',
      'Would you like to submit your profile for verification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Submit Request', 
          onPress: async () => {
            const { error } = await supabase.from('verification_requests').insert({
              user_id: user.id,
              reason: verificationReason.trim()
            })
            if (error) {
              if (error.code === '23505') {
                Alert.alert('Notice', 'You already have a pending verification request.')
              } else {
                Alert.alert('Error', error.message)
              }
            } else {
              setVerificationReason('')
              Alert.alert('Success', 'Your verification request has been submitted for review.')
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.headerDesc}>
          Update your display name and username. Usernames must be unique and can only be changed once every 14 days.
        </Text>

        {/* Avatar Upload */}
        <TouchableOpacity style={styles.avatarSection} onPress={pickAvatar} activeOpacity={0.8}>
          {avatarUrl ? (
            <Image source={{ uri: getCdnUrl(avatarUrl) }} style={styles.avatarPreview} />
          ) : (
            <View style={[styles.avatarPreview, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{fullName?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </View>
          <Text style={styles.changePhotoText}>{uploadingAvatar ? 'Uploading...' : 'Change Profile Photo'}</Text>
        </TouchableOpacity>

        <View style={styles.sectionCard}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#a1a1aa"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="@username"
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.inputRow, { borderBottomWidth: 0, alignItems: 'flex-start' }]}>
            <Text style={[styles.label, { paddingTop: 12 }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us a little about yourself"
              placeholderTextColor="#a1a1aa"
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Social Links</Text>
        <View style={styles.sectionCard}>
          <View style={styles.inputRow}>
            <Text style={styles.labelSocial}>TikTok</Text>
            <TextInput
              style={styles.input}
              value={tiktok}
              onChangeText={setTiktok}
              placeholder="tiktok.com/@..."
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.labelSocial}>Instagram</Text>
            <TextInput
              style={styles.input}
              value={instagram}
              onChangeText={setInstagram}
              placeholder="instagram.com/..."
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.labelSocial}>Facebook</Text>
            <TextInput
              style={styles.input}
              value={facebook}
              onChangeText={setFacebook}
              placeholder="facebook.com/..."
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
          <View style={[styles.inputRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.labelSocial}>Website</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="yourwebsite.com"
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </View>





        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  content: {
    paddingVertical: 20,
    paddingBottom: 40,
  },
  headerDesc: {
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionCard: {
    backgroundColor: '#000',
    overflow: 'hidden',
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
    paddingLeft: 16,
  },
  label: {
    width: 110,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  labelSocial: {
    width: 110,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#fff',
    paddingRight: 16,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  switchDesc: {
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: colors.text,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    position: 'relative',
  },
  avatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#333',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 44,
    right: '50%',
    marginRight: -40,
    backgroundColor: '#2563eb',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  changePhotoText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
})
