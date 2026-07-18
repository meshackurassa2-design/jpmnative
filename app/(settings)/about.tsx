// app/(settings)/about.tsx
import { useTheme } from '../../lib/theme';
import React, { useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Animated, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTranslation } from '../../lib/i18n';
import { LinearGradient } from 'expo-linear-gradient';

const APP_VERSION = '6.0.2'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  
  // Cool float animation for the Dapaz Company badge
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6]
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App branding */}
      <View style={styles.brandCard}>
        <Image source={require('../../assets/icon_real.png')} style={styles.brandLogoImage} resizeMode="contain" />
        <Text style={styles.brandName}>JPM</Text>
        <Text style={styles.brandVersion}>Version {APP_VERSION}</Text>
      </View>

      {/* Dapaz Company Builders Card (Super Cool) */}
      <Animated.View style={{ transform: [{ translateY: floatY }] }}>
        <TouchableOpacity activeOpacity={0.9} style={styles.coolBuilderCard}>
          <LinearGradient 
            colors={['#0f172a', '#1e1b4b', '#312e81']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }}
            style={styles.gradientBg}
          >
            <View style={styles.builderTop}>
              <View style={styles.glassIcon}>
                <Ionicons name="code-slash" size={20} color="#818cf8" />
              </View>
              <View style={styles.badgeLabel}>
                <Text style={styles.badgeText}>MADE WITH EXCELLENCE</Text>
              </View>
            </View>
            <Text style={styles.builderTitle}>Dapaz Company</Text>
            <Text style={styles.builderDesc}>Architecting the future of social finance and digital connection.</Text>
            
            <View style={styles.techStack}>
              <Ionicons name="logo-react" size={18} color="#61dafb" />
              <Ionicons name="logo-nodejs" size={18} color="#68a063" />
              <Ionicons name="logo-firebase" size={18} color="#ffca28" />
              <Ionicons name="logo-apple" size={18} color="#a1a1aa" />
              <Ionicons name="logo-android" size={18} color="#3ddc84" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Info rows */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
            <Ionicons name="mail" size={18} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('help_support')}</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:meshackurassa2@gmail.com')}>
              <Text style={styles.linkText}>meshackurassa2@gmail.com</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Legal */}
      <View style={styles.card}>
        {[
          { label: t('terms_of_service'), icon: 'document-text-outline', onPress: () => router.push('/(settings)/terms') },
          { label: t('privacy_policy'),   icon: 'lock-closed-outline',   onPress: () => router.push('/(settings)/privacy') },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.legalRow, i > 0 && styles.legalRowBorder]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon as any} size={18} color="#71717a" />
            <Text style={styles.legalText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.copyright}>© 2026 Dapaz Company. All rights reserved.</Text>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  content: { padding: 20, paddingBottom: 60 },
  brandCard: { backgroundColor: colors.background, borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 20 },
  brandLogoImage: { width: 80, height: 80, borderRadius: 24, marginBottom: 14 },
  brandName: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 4 },
  brandVersion: { fontSize: 14, color: colors.textDim, fontWeight: '500' },
  
  // Cool Builder Card Styles
  coolBuilderCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 24, elevation: 8, shadowColor: '#312e81', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  gradientBg: { padding: 24 },
  builderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  glassIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  badgeLabel: { backgroundColor: 'rgba(129, 140, 248, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.3)' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#818cf8', letterSpacing: 1 },
  builderTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6, letterSpacing: -0.5 },
  builderDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 20 },
  techStack: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },

  card: { backgroundColor: colors.background, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  iconLetter: { fontSize: 18, fontWeight: '900', color: colors.background },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  rowSubtitle: { fontSize: 13, color: colors.textDim },
  linkText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  legalRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  legalText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  copyright: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: 10 },
})
