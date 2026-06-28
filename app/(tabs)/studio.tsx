import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, FlatList, Dimensions, Animated,
  KeyboardAvoidingView, Platform, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { createClient } from '../../lib/supabase';
import { getCdnUrl } from '../../lib/cdn';
import { CoinIcon } from '../../components/CoinIcon';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W = (W - 48) / 2;

type VideoGen = {
  id: string; prompt: string; language: string;
  status: string; video_url: string | null; created_at: string;
};

// ─── CREATION SCREEN ──────────────────────────────────────────────────────────
function CreateScreen({ onClose, onDone, balance, supabase, user }: any) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('Swahili');
  const [loading, setLoading] = useState(false);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const glowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 32] });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [9, 16], quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) return Alert.alert('No Description', 'Describe your product.');
    if (balance < 5000) return Alert.alert('Not Enough Coins', 'You need 5,000 coins.');

    setShowCopyrightModal(true);
  };

  const executeGenerate = async () => {
    setLoading(true);
    try {
      // ==== TEST MODE: Bypass AI API and Coin Deduction ====
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate delay
      
      const mockVideo = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        prompt: prompt || 'Test Ad',
        language: language,
        status: 'completed',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        image_url: imageUri || null,
        created_at: new Date().toISOString()
      };

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(mockVideo);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={cs.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>

          {/* Top Bar */}
          <View style={cs.topBar}>
            <TouchableOpacity style={cs.backBtn} onPress={onClose}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={cs.title}>AI Product Ad</Text>
              <Text style={cs.subtitle}>Gemini Veo 3 · 10-sec cinematic video</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Image Hero */}
          <View style={cs.heroContainer}>
            <Animated.View style={[cs.glow, { opacity: glowOpacity }]} />
            <TouchableOpacity style={cs.heroPicker} onPress={pickImage} activeOpacity={0.9}>
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFillObject} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={cs.heroGradient}
                  >
                    <View style={cs.changePhotoBtn}>
                      <Ionicons name="camera" size={16} color="#fff" />
                      <Text style={cs.changePhotoText}>Change Photo</Text>
                    </View>
                  </LinearGradient>
                </>
              ) : (
                <View style={cs.heroEmpty}>
                  <Animated.View style={[cs.uploadGlow, { opacity: glowOpacity }]} />
                  <View style={cs.uploadCircle}>
                    <Ionicons name="image-outline" size={36} color="#ec4899" />
                  </View>
                  <Text style={cs.uploadTitle}>Upload Product Photo</Text>
                  <Text style={cs.uploadSub}>Your product will be the star of the video</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={cs.form}>
            {/* Description */}
            <View style={cs.fieldGroup}>
              <Text style={cs.fieldLabel}>PRODUCT DESCRIPTION</Text>
              <TextInput
                style={cs.textInput}
                placeholder="Describe your product and what makes it special..."
                placeholderTextColor="#3f3f46"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Language */}
            <View style={cs.fieldGroup}>
              <Text style={cs.fieldLabel}>AD LANGUAGE</Text>
              <View style={cs.langRow}>
                {[
                  { id: 'Swahili', flag: '🇹🇿', desc: 'Kiswahili' },
                  { id: 'English', flag: '🇬🇧', desc: 'English' },
                ].map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[cs.langBtn, language === l.id && cs.langBtnActive]}
                    onPress={() => { setLanguage(l.id); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    {language === l.id && (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#ec4899' }]} />
                    )}
                    <Text style={cs.langFlag}>{l.flag}</Text>
                    <View>
                      <Text style={[cs.langName, language === l.id && { color: '#fff' }]}>{l.id}</Text>
                      <Text style={[cs.langDesc, language === l.id && { color: 'rgba(255,255,255,0.7)' }]}>{l.desc}</Text>
                    </View>
                    {language === l.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cost info */}
            <View style={cs.costRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={cs.costBalance}>Balance: {balance.toLocaleString()}</Text>
                <CoinIcon size={14} />
              </View>
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[cs.generateBtn, (loading || !prompt.trim()) && { opacity: 0.45 }]}
              onPress={generate}
              disabled={loading || !prompt.trim()}
              activeOpacity={0.85}
            >
              <View style={cs.generateSolid}>
                {loading ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={cs.generateText}>Sending to Veo 3...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                    <Text style={cs.generateText}>Generate Video Ad</Text>
                    <View style={[cs.generateBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Text style={cs.generateBadgeText}>5K</Text>
                      <CoinIcon size={14} />
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
          {/* Extra padding to ensure scroll clears the bottom edge */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Copyright Modal */}
      <Modal visible={showCopyrightModal} animationType="fade" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#18181b', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center', borderWidth: 1, borderColor: '#27272a' }}>
            <Ionicons name="shield-checkmark" size={56} color="#ec4899" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' }}>Copyright Agreement</Text>
            <Text style={{ fontSize: 15, color: '#a1a1aa', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              5,000 coins will be deducted. By generating this video, you confirm that you own all rights to the uploaded image, and you agree that we are not responsible for any copyright violations.
            </Text>
            
            <View style={{ gap: 12, width: '100%' }}>
              <TouchableOpacity 
                style={{ width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: '#ec4899', alignItems: 'center' }}
                onPress={() => {
                  setShowCopyrightModal(false)
                  executeGenerate()
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>I Agree, Generate Video</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: '#27272a', alignItems: 'center' }}
                onPress={() => setShowCopyrightModal(false)}
              >
                <Text style={{ color: '#e4e4e7', fontWeight: '700', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── MAIN STUDIO SCREEN ───────────────────────────────────────────────────────
export default function StudioScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const supabase = createClient();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<VideoGen[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (item: VideoGen) => {
    if (!item.video_url) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Denied', 'We need access to your gallery to save the video.');

      setDownloadingId(item.id);
      const url = getCdnUrl(item.video_url);
      const fileUri = FileSystem.documentDirectory + `dapaz_studio_${Date.now()}.mp4`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Video successfully saved to your gallery.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Video', 'Are you sure you want to remove this video from your studio?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!id.startsWith('temp-')) {
          await supabase.from('video_generations').delete().eq('id', id);
        }
        setHistory(prev => prev.filter(v => v.id !== id));
      }}
    ]);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const processing = history.filter(i => i.status === 'processing' && !i.id.startsWith('temp-'));
    if (processing.length > 0) {
      interval = setInterval(async () => {
        let changed = false;
        for (const item of processing) {
          const { data } = await supabase.functions.invoke('check-video-status', { body: { generation_id: item.id } });
          if (data?.status === 'completed' || data?.status === 'failed') changed = true;
        }
        if (changed) fetchData();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [history]);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
    if (p) setBalance(p.wallet_balance || 0);
    const { data } = await supabase.from('video_generations').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setHistory(data);
    setLoadingHistory(false);
  }, [user]);

  const renderCard = ({ item }: { item: VideoGen }) => (
    <View style={ms.card}>
      {item.status === 'processing' ? (
        <View style={ms.cardMedia}>
          <ActivityIndicator color="#c026d3" size="large" />
          <Text style={ms.renderLabel}>Veo 3 Rendering</Text>
          <Text style={ms.renderSub}>~2–5 minutes</Text>
        </View>
      ) : item.video_url ? (
        <Video source={{ uri: getCdnUrl(item.video_url) }} style={ms.cardMedia} resizeMode={ResizeMode.COVER} useNativeControls />
      ) : (
        <View style={ms.cardMedia}>
          <Ionicons name="alert-circle" size={28} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>Failed</Text>
        </View>
      )}
      <View style={ms.cardInfo}>
        <Text style={ms.cardPrompt} numberOfLines={2}>{item.prompt}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={ms.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {item.status === 'completed' && item.video_url && (
              <TouchableOpacity onPress={() => handleDownload(item)} disabled={downloadingId === item.id}>
                {downloadingId === item.id ? (
                  <ActivityIndicator size="small" color="#ec4899" />
                ) : (
                  <Ionicons name="download" size={20} color="#ec4899" />
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#71717a" />
            </TouchableOpacity>

            <View style={[ms.badge, { backgroundColor: item.status === 'completed' ? '#14532d55' : item.status === 'failed' ? '#7f1d1d55' : '#4c1d9555' }]}>
              <Text style={[ms.badgeText, { color: item.status === 'completed' ? '#4ade80' : item.status === 'failed' ? '#f87171' : '#c084fc' }]}>{item.status}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  if (showCreate) {
    return (
      <CreateScreen
        onClose={() => setShowCreate(false)}
        onDone={(mockVideo: any) => {
          setShowCreate(false);
          if (mockVideo && mockVideo.id) {
            setHistory(prev => [mockVideo, ...prev]);
          } else {
            fetchData();
          }
        }}
        balance={balance}
        supabase={supabase}
        user={user}
      />
    );
  }

  return (
    <SafeAreaView style={[ms.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[ms.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[ms.headerTitle, { color: colors.text }]}>Dapaz Studio</Text>
          <Text style={ms.headerSub}>AI Product Video Generator</Text>
        </View>
        <View style={ms.coinBadge}>
          <CoinIcon size={14} />
          <Text style={ms.coinText}>{balance.toLocaleString()}</Text>
        </View>
      </View>

      {/* List */}
      {loadingHistory ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#c026d3" size="large" />
        </View>
      ) : history.length === 0 ? (
        <View style={ms.emptyState}>
          <View style={ms.emptyIcon}>
            <Ionicons name="videocam" size={32} color="#fff" />
          </View>
          <Text style={ms.emptyTitle}>Video Generation</Text>
          <Text style={ms.emptySub}>Create stunning AI product ads powered by Gemini Veo 3.{'\n\n'}Coming Soon to all creators!</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderCard}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchData}
          refreshing={loadingHistory}
        />
      )}


    </SafeAreaView>
  );
}

// ─── CREATION SCREEN STYLES ───────────────────────────────────────────────────
const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080810' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff14', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#a855f7', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2 },

  heroContainer: { marginHorizontal: 16, marginBottom: 4 },
  glow: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, borderRadius: 32, backgroundColor: 'transparent', shadowColor: '#c026d3', shadowRadius: 40, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } },
  heroPicker: { width: '100%', height: H * 0.28, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#7c3aed55' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 12 },
  changePhotoBtn: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  changePhotoText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  heroEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  uploadGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#c026d322' },
  uploadCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1a0a2e', borderWidth: 1.5, borderColor: '#7c3aed55', justifyContent: 'center', alignItems: 'center' },
  uploadTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 4 },
  uploadSub: { color: '#71717a', fontSize: 12, textAlign: 'center', paddingHorizontal: 32 },

  form: { padding: 16 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { color: '#52525b', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  textInput: { backgroundColor: '#0f0f18', borderWidth: 1, borderColor: '#27272a', borderRadius: 16, padding: 14, color: '#fff', fontSize: 15, minHeight: 90, textAlignVertical: 'top' },

  langRow: { gap: 10 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0f0f18', borderWidth: 1.5, borderColor: '#27272a', borderRadius: 16, padding: 14, overflow: 'hidden' },
  langBtnActive: { borderColor: '#ec4899' },
  langFlag: { fontSize: 26 },
  langName: { color: '#a1a1aa', fontSize: 14, fontWeight: '700' },
  langDesc: { color: '#52525b', fontSize: 11, marginTop: 1 },

  costRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fbbf2411', borderRadius: 12, padding: 12, marginBottom: 16 },
  costText: { color: '#fbbf24', fontSize: 13, fontWeight: '600', flex: 1 },
  costBalance: { color: '#71717a', fontSize: 12 },

  generateBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  generateSolid: { flexDirection: 'row', height: 60, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24, backgroundColor: '#ec4899' },
  generateText: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  generateBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  generateBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

// ─── MAIN SCREEN STYLES ───────────────────────────────────────────────────────
const ms = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#71717a', fontSize: 12, marginTop: 1 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1b1f', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#3f3f46' },
  coinText: { color: '#fbbf24', fontSize: 14, fontWeight: '700' },

  card: { width: CARD_W, backgroundColor: '#111118', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1f1f28' },
  cardMedia: { width: '100%', height: 190, backgroundColor: '#0a0a12', justifyContent: 'center', alignItems: 'center' },
  renderLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 10 },
  renderSub: { color: '#71717a', fontSize: 10, marginTop: 3 },
  cardInfo: { padding: 10 },
  cardPrompt: { color: '#d4d4d8', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  cardDate: { color: '#52525b', fontSize: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ec4899' },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  emptySub: { color: '#71717a', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  fabWrap: { position: 'absolute', bottom: 110, right: 16, alignItems: 'flex-end', backgroundColor: 'transparent' },
  fab: { borderRadius: 28, overflow: 'hidden', shadowColor: '#ec4899', shadowRadius: 10, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  fabSolid: { flexDirection: 'row', height: 56, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, backgroundColor: '#ec4899' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
