import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from '../../lib/i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili' },
  { code: 'suk', label: 'Sukuma', native: 'Kisukuma' },
  { code: 'cha_vun', label: 'Chagga (Vunjo)', native: 'Kivunjo' },
  { code: 'cha_mac', label: 'Chagga (Machame)', native: 'Kimachame' },
  { code: 'cha_rom', label: 'Chagga (Rombo)', native: 'Kirombo' },
  { code: 'cha_mash', label: 'Chagga (Mashati)', native: 'Kimashati' },
  { code: 'cha_uru', label: 'Chagga (Uru)', native: 'Kiuru' },
  { code: 'cha_kib', label: 'Chagga (Kibosho)', native: 'Kibosho' },
  { code: 'cha_mos', label: 'Chagga (Old Moshi)', native: 'Kimoshi' },
  { code: 'cha_gwe', label: 'Chagga (Gweno)', native: 'Kigweno' },
  { code: 'maa', label: 'Maasai', native: 'Maa' },
  { code: 'gog', label: 'Gogo', native: 'Kigogo' },
  { code: 'ha', label: 'Ha', native: 'Kiha' },
  { code: 'nya', label: 'Nyamwezi', native: 'Kinyamwezi' },
  { code: 'mak', label: 'Makonde', native: 'Kimakonde' },
  { code: 'heh', label: 'Hehe', native: 'Kihehe' },
  { code: 'hay', label: 'Haya', native: 'Kihaya' },
  { code: 'nyak', label: 'Nyakyusa', native: 'Kinyakyusa' },
  { code: 'zar', label: 'Zaramo', native: 'Kizaramo' },
  { code: 'lug', label: 'Luguru', native: 'Kiluguru' },
  { code: 'kur', label: 'Kuria', native: 'Kikuria' },
  { code: 'jit', label: 'Jita', native: 'Kijita' },
  { code: 'nyaturu', label: 'Nyaturu', native: 'Kinyaturu' },
  { code: 'fip', label: 'Fipa', native: 'Kifipa' },
  { code: 'makua', label: 'Makua', native: 'Kimakua' },
  { code: 'irq', label: 'Iraqw', native: 'Kiiraqw' },
  { code: 'ran', label: 'Rangi', native: 'Kirangi' },
  { code: 'ben', label: 'Bena', native: 'Kibena' },
  { code: 'nyiha', label: 'Nyiha', native: 'Kinyiha' },
  { code: 'yao', label: 'Yao', native: 'Ciyao' },
  { code: 'par', label: 'Pare', native: 'Kipare / Chasu' },
  { code: 'had', label: 'Hadzabe', native: 'Kihadza' },
  { code: 'san', label: 'Sandawe', native: 'Kisandawe' },
  { code: 'dat', label: 'Datooga', native: 'Kidatooga' },
  { code: 'mer', label: 'Meru', native: 'Kimeru' },
  { code: 'son', label: 'Sonjo', native: 'Kisonjo / Temi' },
  { code: 'zin', label: 'Zinza', native: 'Kizinza' },
  { code: 'ker', label: 'Kerewe', native: 'Kikerewe' },
  { code: 'ruf', label: 'Rufiji', native: 'Kirufiji' },
  { code: 'mat', label: 'Matumbi', native: 'Kimatumbi' },
  { code: 'nde', label: 'Ndengereko', native: 'Kindengereko' },
  { code: 'nyam', label: 'Nyamwanga', native: 'Kinyamwanga' },
  { code: 'mam', label: 'Mambwe', native: 'Kimambwe' },
  { code: 'saf', label: 'Safwa', native: 'Kisafwa' },
  { code: 'bon', label: 'Bondei', native: 'Kibondei' },
  { code: 'zig', label: 'Zigua', native: 'Kizigua' },
  { code: 'ngo', label: 'Ngoni', native: 'Kingoni' },
  { code: 'pog', label: 'Pogoro', native: 'Kipogoro' },
  { code: 'mbu', label: 'Mbunga', native: 'Kimbunga' },
  { code: 'kin', label: 'Kinga', native: 'Kikinga' },
  { code: 'pan', label: 'Pangwa', native: 'Kipangwa' },
  { code: 'kis', label: 'Kisi', native: 'Kikisi' },
  { code: 'mwe', label: 'Mwera', native: 'Kimwera' },
  { code: 'vid', label: 'Vidunda', native: 'Kividunda' },
  { code: 'nyi', label: 'Nyika', native: 'Kinyika' },
];

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useTranslation();
  
  const [selected, setSelected] = useState<Record<string, boolean>>({ [lang]: true });

  const toggleLang = (code: string) => {
    // When a user picks a language, immediately update the app language and current selection state
    // so the language page instantly translates to the chosen language!
    setLang(code);
    setSelected({ [code]: true });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* No custom header needed, relying on Expo Router native header */}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('select_language') || 'Select language'}</Text>
        <Text style={styles.subtitle}>{t('select_language_sub') || 'You\'ll be able to see posts, people, and trends in any languages you choose.'}</Text>

        <View style={styles.list}>
          {LANGUAGES.map(l => (
            <TouchableOpacity 
              key={l.code} 
              style={styles.item}
              activeOpacity={0.7}
              onPress={() => toggleLang(l.code)}
            >
              <View style={{ flex: 1, paddingRight: 16, justifyContent: 'center' }}>
                <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
                  {l.label === l.native ? l.label : `${l.label} - ${l.native}`}
                </Text>
              </View>
              <Switch 
                value={!!selected[l.code] || lang === l.code} 
                onValueChange={() => toggleLang(l.code)}
                trackColor={{ false: '#333', true: '#fff' }}
                thumbColor={(!!selected[l.code] || lang === l.code) ? '#000' : '#fff'}
                ios_backgroundColor="#333"
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 24 }]}>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneText}>{t('done') || 'Done'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  headerBtn: { padding: 8 },
  cancelText: { color: '#fff', fontSize: 17 },
  headerTitle: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, lineHeight: 20, marginBottom: 24 },
  list: { flex: 1 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  itemText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  doneBtn: {
    backgroundColor: '#fff',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneText: { color: '#000', fontSize: 17, fontWeight: '700' },
});
