// app/(settings)/terms.tsx
import { useTheme } from '../../lib/theme';
import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using the platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the platform.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old to create an account and use the platform. By using the platform, you represent and warrant that you are of legal age and have the capacity to enter into these terms.',
  },
  {
    title: '3. User Conduct and User-Generated Content (UGC)',
    body: 'We maintain strict guidelines for content published on our platform. You agree not to engage in any of the following prohibited activities or post content that involves:',
    bullets: [
      'Illegal or Harmful Content: Posting content that is illegal, harmful, or violates the rights of others, including copyright infringement.',
      'Adult Content: Publishing sexually explicit material, pornography, or suggestive content.',
      'Hate Speech & Harassment: Harassing, bullying, or promoting discrimination or violence against any individual or group.',
      'Misleading Information: Spreading spam, false information, or unsolicited advertisements.',
      'Platform Abuse: Attempting to interfere with the security or operation of the platform, or using automated systems (bots) to access or scrape data.',
    ],
    footer: 'Moderation: We reserve the right to review, flag, and remove any User-Generated Content that violates these Terms or our community standards. Accounts repeatedly violating these guidelines will be permanently suspended.',
  },
  {
    title: '4. Content Ownership',
    body: 'You retain ownership of the content you post on the platform. However, by posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, display, and distribute that content to facilitate the platform\'s services.',
  },
  {
    title: '5. Account Termination',
    body: 'We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users or ourselves.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'The platform is provided "as is" without any warranties. We shall not be liable for any indirect, incidental, or consequential damages resulting from your use of the platform.',
  },
  {
    title: '7. Changes to Terms',
    body: 'We may update these Terms from time to time. We will notify you of any significant changes by posting the new Terms on this page. Your continued use of the platform after changes are posted constitutes acceptance of the new Terms.',
  },
]

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.date}>Last updated: March 26, 2026</Text>

      {SECTIONS.map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.body && <Text style={styles.body}>{section.body}</Text>}
          {section.bullets?.map((bullet, j) => (
            <View key={j} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
          {section.footer && <Text style={[styles.body, { marginTop: 12 }]}>{section.footer}</Text>}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>© {new Date().getFullYear()} JPM. All rights reserved.</Text>
      </View>
    </ScrollView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  date: { fontSize: 13, color: colors.textDim, fontWeight: '500', marginBottom: 28 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10, lineHeight: 24 },
  body: { fontSize: 15, color: '#3f3f46', lineHeight: 24 },
  bulletRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  bulletDot: { fontSize: 18, color: colors.textDim, lineHeight: 24, marginTop: -2 },
  bulletText: { flex: 1, fontSize: 15, color: '#3f3f46', lineHeight: 24 },
  footer: { marginTop: 20, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, alignItems: 'center' },
  footerText: { fontSize: 13, color: colors.textDim },
})
