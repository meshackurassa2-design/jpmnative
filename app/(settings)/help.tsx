// app/(settings)/help.tsx
import { useTheme } from '../../lib/theme';
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, LayoutAnimation } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTranslation } from '../../lib/i18n';

const FAQ_EN = [
  {
    q: 'How do I change my username?',
    a: 'Go to Settings → Edit Profile and tap on your username to change it.'
  },
  {
    q: 'How do I report a post?',
    a: 'Tap the three-dot menu on any post and select "Report". Our team reviews all reports.'
  },
  {
    q: 'How do I enable monetization?',
    a: 'Go to Settings → Monetization and check your eligibility status. Keep posting quality content to unlock it.'
  },
  {
    q: 'How do I open a store?',
    a: 'Go to Settings → Store Dashboard and tap "Create Shop". Your shop will be reviewed by our team.'
  },
  {
    q: 'How do I delete my account?',
    a: 'Please contact us at meshackurassa2@gmail.com and we will process your request within 48 hours.'
  }
]

const FAQ_SW = [
  { q: 'Ninabadilishaje jina langu?', a: 'Nenda Mipangilio → Hariri Wasifu na uguse jina lako ili kulibadilisha.' },
  { q: 'Ninaripotije chapisho?', a: 'Gusa vitone vitatu kwenye chapisho na uchague "Ripoti". Timu yetu inakagua ripoti zote.' },
  { q: 'Ninaweshaje kutengeneza pesa?', a: 'Nenda Mipangilio → Kutengeneza Pesa na uangalie sifa zako. Endelea kuchapisha maudhui mazuri.' },
  { q: 'Ninafunguaje duka?', a: 'Nenda Mipangilio → Dashibodi ya Duka na uchague "Unda Duka". Duka lako litakaguliwa.' },
  { q: 'Ninafutaje akaunti yangu?', a: 'Tafadhali wasiliana nasi kupitia meshackurassa2@gmail.com na tutashughulikia ndani ya saa 48.' }
]

const FAQ_SUK = [
  { q: 'Nabadilisha nhamba zina lyane?', a: 'Shila Mipangilio → Bisa Wasifu ubonye zina lyako.' },
  { q: 'Naripoti nhamba chapisho?', a: 'Bonya tudoti tudatu kwenye chapisho na uchague "Ripoti".' },
  { q: 'Napata hela nhamba?', a: 'Shila Mipangilio → Kupata Hela ubonye sifa jako. Pona shinhu shiza sana.' },
  { q: 'Nafungula nhamba shisheko?', a: 'Shila Mipangilio → Dashibodi ya Shisheko ubonye "Fungula Shisheko".' },
  { q: 'Nafuta nhamba akaunti?', a: 'Longela nasi kwa meshackurassa2@gmail.com tutafuta.' }
]

const FAQ_CHA = [
  { q: 'Nabadilisha mkyi zina lyangu?', a: 'Nda Mipangilio → Wika Wasifu ubonye zina lyako.' },
  { q: 'Naripoti mkyi chapisho?', a: 'Bonya doti idatu kwa chapisho ubonye "Ripoti".' },
  { q: 'Napata mkyi hela?', a: 'Nda Mipangilio → Kupata Hela uwone sifa. Wika kindu kiza.' },
  { q: 'Nafungua mkyi duka?', a: 'Nda Mipangilio → Dashibodi ya Duka ubonye "Fungua Duka".' },
  { q: 'Nafuta mkyi akaunti?', a: 'Ocha naswi kwa meshackurassa2@gmail.com.' }
]

function FAQItem({ q, a, styles }: { q: string, a: string, styles: any }) {
  const [open, setOpen] = useState(false)

  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setOpen(!open)
      }}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#71717a" />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  )
}

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { lang, t } = useTranslation();
  
  const FAQ = lang === 'sw' ? FAQ_SW : lang === 'suk' ? FAQ_SUK : lang === 'cha' ? FAQ_CHA : FAQ_EN;
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Contact card */}
      <View style={styles.contactCard}>
        <View style={styles.contactIcon}>
          <Ionicons name="mail-outline" size={24} color="#2563eb" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>{t('help_support')}</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:meshackurassa2@gmail.com')}>
            <Text style={styles.contactLink}>meshackurassa2@gmail.com</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FAQ */}
      <Text style={styles.sectionTitle}>FAQ</Text>
      <View style={styles.card}>
        {FAQ.map((item, i) => (
          <View key={i}>
            <FAQItem q={item.q} a={item.a} styles={styles} />
            {i < FAQ.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      {/* Extra links */}
      <View style={styles.linksCard}>
        {[
          { label: t('app_tour'),   icon: 'book-outline',          onPress: () => router.push('/onboarding') },
          { label: t('terms_of_service'), icon: 'document-text-outline', onPress: () => router.push('/(settings)/terms') },
          { label: t('privacy_policy'),   icon: 'lock-closed-outline',   onPress: () => router.push('/(settings)/privacy') },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.linkRow, i > 0 && styles.rowBorder]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon as any} size={18} color="#71717a" />
            <Text style={styles.linkText}>{item.label || item.label}</Text>
            <Ionicons name="open-outline" size={16} color="#a1a1aa" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  content: { padding: 20, paddingBottom: 60 },
  contactCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.background, borderRadius: 16, padding: 20, marginBottom: 24 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  contactTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  contactLink: { fontSize: 14, color: '#2563eb', fontWeight: '600', marginBottom: 2 },
  contactNote: { fontSize: 12, color: colors.textDim },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card: { backgroundColor: colors.background, borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  faqItem: { padding: 16 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqQ: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  faqA: { fontSize: 14, color: colors.textDim, marginTop: 10, lineHeight: 21 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 },
  linksCard: { backgroundColor: colors.background, borderRadius: 16, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
})
