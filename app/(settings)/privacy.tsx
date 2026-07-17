// app/(settings)/privacy.tsx
import { useTheme } from '../../lib/theme';
import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { useTranslation } from '../../lib/i18n';

const PRIVACY_EN = [
  {
    title: '1. Introduction',
    body: 'Welcome to JPM ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and share information when you use our mobile application, website, and related services (collectively, the "Platform").',
  },
  {
    title: '2. Information We Collect',
    body: 'We collect information that you provide directly to us or that is collected automatically when you use the Platform:',
    bullets: [
      'Account Information: Name, email address, password, profile picture, and demographic information.',
      'Marketplace Data: If you buy or sell items, we collect transaction history, shipping addresses, phone numbers, and shop details. We do not store raw credit card numbers; payment processing is securely handled by third-party providers.',
      'Content & Communications: Messages sent through our chat, posts, reviews, and feedback.',
      'AI Image Generation: Text prompts you submit to generate AI images are processed temporarily to provide the service. We do not use your generated images or prompts for our own training models.',
      'Device & Usage Data: Device identifiers (including Push Notification tokens via Firebase), IP address, operating system, and app interaction data.',
      'Ad-Reward Activity: We track ad-watching milestones (such as timestamps and counts) to accurately issue digital coin rewards to your wallet.',
      'Location Data: General location data (e.g., city/area) to help you find local shops and products.',
    ],
  },
  {
    title: '3. How We Use Information',
    body: 'We use the information we collect to:',
    bullets: [
      'Provide, operate, and maintain our social, AI generation, and marketplace features.',
      'Process transactions, ad rewards, and facilitate communication between buyers and sellers.',
      'Send you administrative messages, push notifications, and security alerts.',
      'Personalize your experience and recommend relevant content and products.',
      'Detect, prevent, and address fraud, terms violations, or security issues.',
    ],
  },
  {
    title: '4. Data Sharing and Disclosure',
    body: 'We do not sell your personal data. We may share your information only in the following circumstances:',
    bullets: [
      'With Other Users: When you make a purchase, necessary details (like your name, phone number, and delivery address) are shared with the shop owner to fulfill your order.',
      'With Service Providers: Third-party vendors who help us operate (e.g., hosting, payment processing, push notifications, analytics).',
      'For Legal Reasons: If required by law, subpoena, or other legal processes, or to protect the safety and rights of our users.',
    ],
    subSection: {
      title: 'Advertising (AdMob & AdSense)',
      body: 'We may use third-party advertising partners, including Google AdMob/AdSense, to display ads. These partners may use device identifiers and cookies to serve personalized ads based on your interests. You can opt out of personalized advertising by visiting your Google Ads Settings or device privacy settings.',
    },
  },
  {
    title: '5. Data Retention and Deletion (Your Rights)',
    body: 'You have the right to access, modify, or delete your personal information at any time.',
    bullets: [
      'Account Deletion: You can permanently delete your account directly within the app by navigating to Settings > Delete Account.',
      'Data Removal: Upon account deletion, all your personal data, posts, shop items, and messages will be permanently removed from our active databases in accordance with App Store and Google Play guidelines, except where retention is required by law or for legitimate financial record-keeping.',
    ],
  },
  {
    title: '6. Age Requirement',
    body: 'Our Platform is intended for users who are 13 years of age or older (or 18+ for marketplace selling). We do not knowingly collect personal information from children under 13. If we discover a minor under 13 has provided us with personal information, we will delete it immediately.',
  },
  {
    title: '7. Contact Us',
    body: 'If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact us at:',
    contact: 'meshackurassa2@gmail.com',
  },
]

const PRIVACY_SW = [
  { title: '1. Utangulizi', body: 'Karibu JPM ("sisi", "yetu"). Tumejitolea kulinda taarifa zako binafsi na haki yako ya faragha. Sera hii ya faragha inaeleza jinsi tunavyokusanya, kutumia na kushiriki taarifa unapotumia programu yetu.' },
  { title: '2. Taarifa Tunazokusanya', body: 'Tunakusanya taarifa unazotupa au zinazokusanywa kiotomatiki:', bullets: ['Taarifa za Akaunti: Jina, barua pepe, nenosiri, picha ya wasifu.', 'Data ya Soko: Ikiwa unanunua au kuuza, tunakusanya historia ya miamala.', 'Ujumbe na Mawasiliano: Ujumbe wa chati, machapisho, na hakiki.', 'Data ya Kifaa: Namba ya kifaa, anwani ya IP.', 'Data ya Eneo: Eneo lako kwa ujumla.'] },
  { title: '3. Jinsi Tunavyotumia Taarifa', body: 'Tunatumia taarifa tulizokusanya kwa:', bullets: ['Kutoa na kuboresha huduma za soko na chati.', 'Kushughulikia miamala na kutoa zawadi za matangazo.', 'Kutuma ujumbe wa kiutawala na usalama.', 'Kubinafsisha uzoefu wako.'] },
  { title: '4. Ushirikishwaji wa Data', body: 'Hatuuzi data yako binafsi. Tunaweza kushiriki taarifa zako kwa mambo haya:', bullets: ['Na Watumiaji Wengine: Unaponunua bidhaa, taarifa muhimu zinashirikiwa na muuzaji.', 'Na Watoa Huduma: Wahusika wa tatu wanaotusaidia kufanya kazi.', 'Kwa Sababu za Kisheria: Ikiwa inahitajika na sheria.'], subSection: { title: 'Matangazo (AdMob/AdSense)', body: 'Tunaweza kutumia washirika wa matangazo. Washirika hawa wanaweza kutumia namba za vifaa kutoa matangazo kulingana na mapendeleo yako.' } },
  { title: '5. Uhifadhi na Ufutaji wa Data', body: 'Una haki ya kufikia, kurekebisha, au kufuta taarifa zako binafsi wakati wowote.', bullets: ['Kufuta Akaunti: Unaweza kufuta akaunti yako kupitia Mipangilio > Futa Akaunti.', 'Kuondoa Data: Ukifuta akaunti, data zako zote zitaondolewa.'] },
  { title: '6. Sharti la Umri', body: 'Programu yetu inakusudiwa watu wenye umri wa miaka 13 na zaidi (18+ kwa kuuza). Hatukusanyi taarifa za watoto walio chini ya miaka 13 kwa makusudi.' },
  { title: '7. Wasiliana Nasi', body: 'Ikiwa una maswali, wasiliana nasi kwa:', contact: 'meshackurassa2@gmail.com' }
]

const PRIVACY_SUK = [
  { title: '1. Kwanda', body: 'Wamja JPM. Tuli tayari kulinda mhola yako. Sera iyi ieleza nhamba tukupata, kutumia na kupa banhu mhola yako.' },
  { title: '2. Mhola Tukupata', body: 'Tukupata mhola utupa:', bullets: ['Mhola ja Akaunti: Zina, barua pepe.', 'Mhola ja Soko: Uko guza, tukupata historia ya shiguzilwe.', 'Mhola ja Chati: Mhola utuma.', 'Mhola ja Simu: Namba ya simu.', 'Mhola ja Kaya: Kaya yako.'] },
  { title: '3. Nhamba Tukutumia Mhola', body: 'Tukutumia mhola kwa:', bullets: ['Kupa huduma za soko na chati.', 'Kushughulikia shiguzilwe.', 'Kutuma mhola za usalama.'] },
  { title: '4. Kupa Banhu Mhola', body: 'Hatuuzi mhola yako. Tukupa mhola yako kwa:', bullets: ['Banhu Bangi: Uko guza, mhola yashila kwa mguza.', 'Batupa Huduma: Banhu batukusaidia.', 'Sheria: Kwa sababu za sheria.'], subSection: { title: 'Matangazo', body: 'Tukutumia banhu ba matangazo.' } },
  { title: '5. Kubisa na Kufuta Mhola', body: 'Ulinga haki kufuta mhola yako.', bullets: ['Kufuta Akaunti: Ulinga kufuta akaunti yako.', 'Kufuta Mhola: Akaunti ishile, mhola jishila.'] },
  { title: '6. Miaka', body: 'Programu iyi ya banhu bali na miaka 13 na kubanda. Hatupata mhola ya bana.' },
  { title: '7. Longela Nasi', body: 'Ulinga masuuli, longela nasi kwa:', contact: 'meshackurassa2@gmail.com' }
]

const PRIVACY_CHA = [
  { title: '1. Kwanda', body: 'Wamcha JPM. Tunalinda kindu kyako. Sera iyi ieleza tunapata, kutumia na kuwapa wandu.' },
  { title: '2. Mhola Tunapata', body: 'Tunapata mhola utupa:', bullets: ['Akaunti: Zina, email.', 'Soko: Ukauza, tunapata kindu kyauzwa.', 'Chati: Meseji utuma.', 'Simu: Namba ya simu.', 'Kaya: Kaya yako.'] },
  { title: '3. Kyotumiya Mhola', body: 'Tunatumia mhola kwa:', bullets: ['Kupa huduma za soko.', 'Miamala.', 'Kutuma mhola za usalama.'] },
  { title: '4. Kuwapa Mhola', body: 'Hatuuzi mhola yako. Tunapa mhola kwa:', bullets: ['Wandu Wengi: Ukauza, muuza apata mhola.', 'Huduma: Wandu watukusaidia.', 'Sheria: Kwa sheria.'], subSection: { title: 'Matangazo', body: 'Tunatumia wandu wa matangazo.' } },
  { title: '5. Kubisa na Kufuta Mhola', body: 'Una haki kufuta mhola yako.', bullets: ['Kufuta Akaunti: Futa akaunti yako.', 'Kufuta Mhola: Akaunti ifutwe, mhola ifutwa.'] },
  { title: '6. Miaka', body: 'Programu ya wandu wana miaka 13+. Hatupata mhola ya wana.' },
  { title: '7. Ocha Naswi', body: 'Una maswali, ocha kwa:', contact: 'meshackurassa2@gmail.com' }
]

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { lang } = useTranslation();
  
  const SECTIONS = lang === 'sw' ? PRIVACY_SW : lang === 'suk' ? PRIVACY_SUK : lang === 'cha' ? PRIVACY_CHA : PRIVACY_EN;
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
          {(section as any).subSection && (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>{(section as any).subSection.title}</Text>
              <Text style={styles.body}>{(section as any).subSection.body}</Text>
            </View>
          )}
          {(section as any).contact && (
            <View style={styles.contactBox}>
              <Text style={styles.contactEmail}>{(section as any).contact}</Text>
            </View>
          )}
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
  subSection: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  subSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  contactBox: { marginTop: 8, backgroundColor: colors.border, borderRadius: 10, padding: 14 },
  contactEmail: { fontSize: 15, fontWeight: '700', color: '#2563eb' },
  footer: { marginTop: 20, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, alignItems: 'center' },
  footerText: { fontSize: 13, color: colors.textDim },
})
