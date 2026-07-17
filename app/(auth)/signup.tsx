import { getCdnUrl } from '../../lib/cdn';
import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image, Dimensions, Animated
} from 'react-native'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '../../lib/supabase'
import { decode } from 'base64-arraybuffer'
import { useTranslation } from '../../lib/i18n';

const { width, height } = Dimensions.get('window')

export default function SignupScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isDark = colors.isDark;
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const supabase = createClient()
  
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  
  const [gender, setGender] = useState('')

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null)

  const animValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 25000,
        useNativeDriver: true,
      })
    ).start();
  }, [animValue]);

  const spin1 = animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = animValue.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    })
    if (!result.canceled) {
      setAvatar(result.assets[0])
    }
  }

  const handleSignup = async () => {
    if (!firstName || !lastName || !username || !email || !password) {
      Alert.alert('Error', 'Please fill in all basic fields')
      return
    }
    if (!birthDay || !birthMonth || !birthYear) {
      Alert.alert('Error', 'Please provide your complete birthday')
      return
    }
    if (!gender) {
      Alert.alert('Error', 'Please select a gender')
      return
    }

    setLoading(true)

    try {
      const birthDate = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay))
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const m = today.getMonth() - birthDate.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--

      if (age < 18) {
        Alert.alert('Error', 'You must be at least 18 years old to join.')
        setLoading(false)
        return
      }

      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
      if (cleanUsername.length < 3) {
        Alert.alert('Error', 'Username must be at least 3 characters.')
        setLoading(false)
        return
      }

      const { data: existingUser } = await supabase
        .from('profiles').select('id').eq('username', cleanUsername).single()

      if (existingUser) {
        Alert.alert('Error', `@${cleanUsername} is already taken.`)
        setLoading(false)
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            username: cleanUsername,
            birthday: birthDate.toISOString().split('T')[0],
            gender,
          },
        },
      })

      if (authError) throw authError

      const newUser = authData?.user
      let avatar_url: string | null = null
      
      if (avatar && avatar.base64 && newUser) {
        const ext = avatar.uri.split('.').pop() || 'jpg'
        const path = `${newUser.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(path, decode(avatar.base64), { contentType: `image/${ext}`, upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          avatar_url = urlData?.publicUrl ?? null
        }
      }

      if (newUser) {
        await supabase.from('profiles').update({ 
            avatar_url,
            first_name: firstName.trim(), last_name: lastName.trim(),
            birthday: birthDate.toISOString().split('T')[0], gender,
            full_name: `${firstName.trim()} ${lastName.trim()}`
          }).eq('id', newUser.id)
      }
      if (Platform.OS === 'web') {
        router.replace('/(tabs)')
      } else {
        router.replace('/onboarding')
      }
    } catch (e: any) {
      Alert.alert('Signup Failed', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Background Shapes */}
      <Animated.View style={[styles.bgShape1, { transform: [{ rotate: spin1 }] }]} />
      <Animated.View style={[styles.bgShape2, { transform: [{ rotate: spin2 }] }]} />
      <Animated.View style={[styles.bgShape3, { transform: [{ rotate: spin1 }] }]} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: 20, marginBottom: 24, alignItems: 'center' }}>
          <Text style={styles.title}>{t('signup_title')}</Text>
        </View>

        {/* Avatar Upload */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
            {avatar ? (
              <Image source={{ uri: getCdnUrl(avatar.uri) }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-outline" size={32} color={colors.textDim} />
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={12} color={colors.background} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="#666"
              value={firstName}
              onChangeText={setFirstName}
            />
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="#666"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.inputRow}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                style={[styles.input, { flex: 1, paddingLeft: 36 }]}
                placeholder="username"
                placeholderTextColor="#666"
                autoCapitalize="none"
                value={username}
                onChangeText={text => setUsername(text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
              />
            </View>
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              placeholder={t('email')}
              placeholderTextColor="#666"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <View style={styles.inputDivider} />
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                placeholder={t('password')}
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>BIRTHDAY</Text>
          </View>
          <View style={[styles.formGroup, { flexDirection: 'row' }]}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="MM"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={2}
              value={birthMonth}
              onChangeText={setBirthMonth}
            />
            <View style={styles.vertDivider} />
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="DD"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={2}
              value={birthDay}
              onChangeText={setBirthDay}
            />
            <View style={styles.vertDivider} />
            <TextInput
              style={[styles.input, styles.dateInput, { flex: 1.5 }]}
              placeholder="YYYY"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={4}
              value={birthYear}
              onChangeText={setBirthYear}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>GENDER</Text>
          </View>
          <View style={[styles.formGroup, { flexDirection: 'row' }]}>
            {['Female', 'Male'].map((g, i) => (
              <React.Fragment key={g}>
                {i > 0 && <View style={styles.vertDivider} />}
                <TouchableOpacity
                  style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={isDark ? '#000' : '#fff'} /> : <Text style={styles.submitBtnText}>{t('sign_up')}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>{t('sign_in')}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bgShape1: {
    position: 'absolute', left: -80, top: -50, width: 280, height: 380, borderRadius: 140, borderWidth: 1, borderColor: isDark ? '#222' : '#e5e7eb',
  },
  bgShape2: {
    position: 'absolute', left: -120, top: -100, width: 360, height: 480, borderRadius: 180, borderWidth: 1, borderColor: isDark ? '#1a1a1a' : '#f3f4f6',
  },
  bgShape3: {
    position: 'absolute', right: -80, bottom: -150, width: 250, height: 500, borderRadius: 125, borderWidth: 1, borderColor: isDark ? '#222' : '#e5e7eb',
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: 28, 
    paddingVertical: 40, 
    zIndex: 10,
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center'
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatarButton: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: isDark ? '#0a0a0a' : '#fff', borderWidth: 1, borderColor: isDark ? '#333' : '#e5e7eb',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 44 },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.text,
    justifyContent: 'center', alignItems: 'center',
  },
  
  form: { gap: 16 },
  formGroup: {
    backgroundColor: isDark ? '#0a0a0a' : '#fff', borderRadius: 16, borderWidth: 1, borderColor: isDark ? '#222' : '#e5e7eb', overflow: 'hidden',
  },
  inputDivider: { height: 1, backgroundColor: isDark ? '#222' : '#e5e7eb' },
  vertDivider: { width: 1, backgroundColor: isDark ? '#222' : '#e5e7eb' },
  input: {
    height: 60, paddingHorizontal: 16, fontSize: 16, color: colors.text, backgroundColor: isDark ? '#0a0a0a' : '#fff', textAlign: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  atSymbol: { position: 'absolute', left: 16, zIndex: 1, color: colors.textDim, fontSize: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#0a0a0a' : '#fff' },
  eyeIcon: { padding: 16 },
  
  dateInput: { flex: 1, textAlign: 'center' },
  
  sectionHeader: { marginTop: 4, marginBottom: -8, marginLeft: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textDim, letterSpacing: 1 },
  
  genderButton: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0a0a0a' : '#fff' },
  genderButtonActive: { backgroundColor: isDark ? '#222' : '#f3f4f6' },
  genderText: { fontSize: 15, fontWeight: '600', color: colors.textDim },
  genderTextActive: { color: colors.text },
  
  submitBtn: {
    height: 56, backgroundColor: colors.text, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginTop: 16,
  },
  submitBtnText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { fontSize: 14, color: colors.textDim },
  footerLink: { fontSize: 14, color: colors.text, fontWeight: '700' },
});
