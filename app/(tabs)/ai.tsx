import { getCdnUrl } from '../../lib/cdn';
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Keyboard, Image, ScrollView, Modal
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg'
import { Audio } from 'expo-av'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const formatTokens = (num: any) => {
  const val = Number(num);
  if (val >= 99000000) return 'Unlimited';
  if (val >= 999950000) return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B Tokens';
  if (val >= 999950) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M Tokens';
  if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K Tokens';
  return val.toString() + ' Tokens';
}

// ==========================================
// ⚠️ ACTION REQUIRED: PASTE YOUR API KEY HERE OR USE .env
// ==========================================
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'PASTE_YOUR_GEMINI_API_KEY_HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// The strict personality for the AI
const SYSTEM_PROMPT = `
CRITICAL IDENTITY INSTRUCTION: You are "Dapaz", an elite AI assistant, creative engine, and business mentor created exclusively by Dapaz Studio. Under NO circumstances should you ever refer to yourself as an AI made by Google, a large language model, Gemini, or any other identity. You are simply Dapaz.

Your goals:
1. Help Tanzanian entrepreneurs grow their businesses, negotiate deals, and market their products.
2. Teach professional English, correcting grammar when asked.
3. Be practical, direct, and incredibly useful.
4. Use a friendly tone. You can mix in a tiny bit of Swahili (like "Karibu!", "Sawa") if it feels natural, but keep the core advice in excellent professional English to help them learn.
Keep your responses relatively concise so they are easy to read on a phone.
`;

// ==========================================
// 💰 PRICING CONFIGURATION (in Tokens/Coins)
// Adjust how much each action costs the user
// ==========================================
const PRICING = {
  textChat: 5,         // Cost for a standard text message
  voiceChat: 10,       // Cost for sending a voice message
  translate: 3,        // Cost for translating text
  image: 50,           // Cost for generating one image (using Gemini Flash)
};

interface Message {
  id: string
  role: 'user' | 'model'
  text: string
  mediaType?: 'image'
  mediaUrl?: string
  aspectRatio?: '1:1' | '16:9' | '9:16'
  isGenerating?: boolean
}

type ConversationMeta = {
  id: string;
  title: string;
  mode: string;
  updatedAt: number;
}

export default function AIScreen() {
  const { user } = useAuth()
  const supabase = createClient()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  
  const [balance, setBalance] = useState<number>(0)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState<boolean>(false)
  const [userName, setUserName] = useState<string>('')
  const [inputText, setInputText] = useState('')
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [isKeyboardVisible, setKeyboardVisible] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'chat' | 'image' | 'translate'>('chat')
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1')
  const [messages, setMessages] = useState<Message[]>([])
  const [currentConvId, setCurrentConvId] = useState<string>('')
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [isHistoryVisible, setIsHistoryVisible] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch balance on mount and on screen focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchBalance();
      }
      
      // Temporary mock override for UI testing without database
      AsyncStorage.getItem('mock_is_premium').then(val => {
        if (val === 'true') setIsPremium(true);
      });
    }, [user])
  );

  // Load Master Index on mount
  useEffect(() => {
    const loadMasterIndex = async () => {
      try {
        const storedIndex = await AsyncStorage.getItem('@dapaz_conversations')
        if (storedIndex) {
          setConversations(JSON.parse(storedIndex))
        }
      } catch(e) {}
    }
    loadMasterIndex();
  }, [])

  // Auto-save messages with a debounce
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (messages.length > 1 && currentConvId) {
        await AsyncStorage.setItem(`@dapaz_conv_${currentConvId}`, JSON.stringify(messages)).catch(() => {});
        
        const userMessages = messages.filter(m => m.role === 'user');
        const title = userMessages.length > 0 ? userMessages[0].text.substring(0, 30) + (userMessages[0].text.length > 30 ? '...' : '') : 'New Chat';

        setConversations(prev => {
          const exists = prev.find(c => c.id === currentConvId);
          let newList;
          if (exists) {
            newList = prev.map(c => c.id === currentConvId ? { ...c, updatedAt: Date.now(), title } : c);
          } else {
            newList = [{ id: currentConvId, title, mode, updatedAt: Date.now() }, ...prev];
          }
          AsyncStorage.setItem('@dapaz_conversations', JSON.stringify(newList));
          return newList;
        });
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [messages, currentConvId, mode]);

  const startWelcomeAnimation = (nameOverride?: string) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    const hour = new Date().getHours();
    let timeGreeting = 'Good evening';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    
    const nameStr = nameOverride || userName || user?.user_metadata?.full_name?.split(' ')[0] || 'friend';
    
    let welcomeText = `${timeGreeting} ${nameStr}! I am Dapaz, your personal Business Mentor. How can I help you today?`;
    if (mode === 'image') welcomeText = `I am Dapaz Studio. Describe an image or flyer you would like me to generate for your business!`;
    if (mode === 'translate') welcomeText = `Send me any English text and I will instantly translate it to professional Swahili for you.`;

    setMessages([{ id: 'welcome', role: 'model', text: '' }]);
    
    let index = 0;
    typingIntervalRef.current = setInterval(() => {
      index++;
      setMessages(prev => {
        if (prev.length === 0) return prev;
        const newMsg = { ...prev[0], text: welcomeText.substring(0, index) };
        return [newMsg, ...prev.slice(1)];
      });
      if (index >= welcomeText.length && typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    }, 30);
  }

  const startNewConversation = (targetMode: 'chat' | 'image' | 'translate' = mode) => {
    setMode(targetMode);
    setCurrentConvId(Date.now().toString());
    startWelcomeAnimation();
  }

  const loadConversation = async (conv: ConversationMeta) => {
    setIsHistoryVisible(false);
    if (mode !== conv.mode) setMode(conv.mode as any);
    setCurrentConvId(conv.id);
    try {
      const stored = await AsyncStorage.getItem(`@dapaz_conv_${conv.id}`);
      if (stored) setMessages(JSON.parse(stored));
    } catch(e) {}
  }

  const deleteConversation = async (id: string) => {
    await AsyncStorage.removeItem(`@dapaz_conv_${id}`);
    setConversations(prev => {
      const newList = prev.filter(c => c.id !== id);
      AsyncStorage.setItem('@dapaz_conversations', JSON.stringify(newList));
      return newList;
    });
    if (id === currentConvId) {
      startNewConversation('chat'); // Reset to default chat
      setIsHistoryVisible(false);
    }
  }

  const saveMedia = async (url: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are required to save media.');
        return;
      }
      const fileUri = FileSystem.documentDirectory + `${Date.now()}.jpg`;
      const downloadedFile = await FileSystem.downloadAsync(url, fileUri);
      if (downloadedFile.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);
        Alert.alert('Saved!', `The image has been successfully saved to your camera roll.`);
      } else {
        Alert.alert('Error', `Failed to download image.`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred while saving.');
    }
  }

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const fetchBalance = async () => {
    const { data, error } = await supabase.from('profiles').select('full_name, wallet_balance, avatar_url, is_premium').eq('id', user?.id).single()
    if (data) {
      setBalance(data.wallet_balance || 0)
      setAvatarUrl(data.avatar_url || null)
      setIsPremium(data.is_premium || false)
      const firstName = data.full_name?.split(' ')[0] || ''
      setUserName(firstName)
      // Re-run the welcome animation now that we have the name
      startWelcomeAnimation(firstName)
    } else if (error) {
      const { data: fallbackData } = await supabase.from('profiles').select('full_name, wallet_balance, avatar_url').eq('id', user?.id).single()
      if (fallbackData) {
        setBalance(fallbackData.wallet_balance || 0)
        setAvatarUrl(fallbackData.avatar_url || null)
        const firstName = fallbackData.full_name?.split(' ')[0] || ''
        setUserName(firstName)
        startWelcomeAnimation(firstName)
      }
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true
    })
    if (!result.canceled && result.assets[0].base64) {
      setAttachedImage(`data:image/jpeg;base64,${result.assets[0].base64}`)
      Haptics.selectionAsync()
    }
  }

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        setAttachedImage(`data:${asset.mimeType || 'image/jpeg'};base64,${base64}`);
        Haptics.selectionAsync();
      }
    } catch (e) {
      console.error('Document pick error:', e);
    }
  }

  const shareMedia = async (url: string) => {
    try {
      const fileUri = FileSystem.documentDirectory + `dapaz_${Date.now()}.jpg`;
      const downloaded = await FileSystem.downloadAsync(url, fileUri);
      if (downloaded.status === 200) {
        await Sharing.shareAsync(downloaded.uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your Dapaz creation!' });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not share the image.');
    }
  }

  // --- Voice Recording Functions ---
  async function startRecording() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required to use voice input.');
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    
    try {
      setIsRecording(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      
      if (uri) {
        await processVoiceInput(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  async function processVoiceInput(uri: string) {
    Alert.alert('Coming Soon', 'Dapaz AI voice features are currently being finalized and will be available in the next update!');
    return;

    const cost = PRICING.voiceChat;
    setBalance(b => b - cost)

    const { error: chargeError } = await supabase.rpc('spend_coins', { p_user_id: user?.id, p_amount: cost })
    if (chargeError) {
      console.warn('Backend spend_coins missing. Bypassing for UI testing.', chargeError.message)
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: '🎤 Voice Message' }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)
    
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_PROMPT });
      
      const parts = [
        { inlineData: { mimeType: 'audio/m4a', data: base64Audio } },
        { text: "Respond to the user's spoken audio accurately and naturally." }
      ];
      
      const aiMsgId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }])
      setIsTyping(false)

      const result = await model.generateContentStream(parts);
      
      let fullResponse = ''
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullResponse } : m))
      }
    } catch (err: any) {
       console.error(err);
       setIsTyping(false)
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `⚠️ Error processing voice: ${err.message}` }]);
    }
  }
  // ---------------------------------

  const sendMessage = async () => {
    Alert.alert('Coming Soon', 'Dapaz AI features are currently being finalized and will be available in the next update!');
    return;

    if (!inputText.trim() && !attachedImage) return;
    
    let cost = PRICING.textChat;
    if (mode === 'image') cost = PRICING.image;
    if (mode === 'translate') cost = PRICING.translate;

    if (balance < cost) {
      const adsNeeded = Math.ceil((cost - balance) / 10);
      Alert.alert(
        'Not Enough Coins 🪙',
        `You need ${cost} coins but only have ${balance}. Watch ${adsNeeded} more free ad${adsNeeded > 1 ? 's' : ''} to top up, or buy a coin pack instantly.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Wallet', onPress: () => router.push('/wallet') }
        ]
      );
      return;
    }
    
    if (GEMINI_API_KEY === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
      Alert.alert('API Key Missing', 'Developer: Please paste your Gemini API key in app/ai.tsx!');
      return;
    }

    Keyboard.dismiss()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const userMsgText = inputText.trim()
    const currentImage = attachedImage
    setInputText('')
    setAttachedImage(null)

    // 1. Instantly deduct coins from local UI
    setBalance(b => b - cost)

    // 2. Charge the user securely 
    const { error: chargeError } = await supabase.rpc('spend_coins', { p_user_id: user?.id, p_amount: cost })
    let isMockFallback = false;
    if (chargeError) {
      console.warn('Backend spend_coins missing. Bypassing for UI testing.', chargeError.message)
      isMockFallback = true;
    }

    // 3. Add user message to UI
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userMsgText || '[Image Attached]' }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      // 4. Call Gemini API
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_PROMPT });
      
      const history = messages.slice(1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const aiMsgId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }])
      setIsTyping(false)

      if (mode === 'chat' || mode === 'translate') {
        const effectiveHistory = mode === 'translate' ? [] : history;
        const systemInstruction = mode === 'translate'
          ? 'You are an expert English-Swahili translator. Detect the input language and translate it to the other language. Output ONLY the translated text, no explanations.'
          : SYSTEM_PROMPT;
        const model2 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
        const chat = model2.startChat({ history: effectiveHistory });
        const parts: any[] = []
        if (userMsgText) parts.push({ text: userMsgText })
        if (currentImage) {
          const base64Data = currentImage.split(',')[1]
          parts.push({ inlineData: { data: base64Data, mimeType: 'image/jpeg' } })
        }
        
        const result = await chat.sendMessageStream(parts.length > 0 ? parts : [{ text: 'Explain this image' }]);
        
        let fullResponse = ''
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullResponse += chunkText;
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullResponse } : m))
        }
      } else if (mode === 'image') {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: `Creating image... ⚡`, isGenerating: true } : m))
        
        // Call the official Google Gemini 2.5 Flash Image API (Extremely Cheap)
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;
          const payload = {
            contents: [{ parts: [{ text: userMsgText || 'A beautiful abstract futuristic design' }] }]
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const data = await response.json();

          if (!response.ok) {
            const errorMsg = data.error?.message || `API error ${response.status}`;
            throw new Error(errorMsg);
          }
          
          const parts = data.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find((p: any) => p.inlineData);
          if (!imagePart) {
            throw new Error(`No image data returned. Raw API Response: ${JSON.stringify(data).substring(0, 200)}`);
          }
          
          const imageUrl = `data:${imagePart.inlineData.mimeType || 'image/jpeg'};base64,${imagePart.inlineData.data}`;
          
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: `Here is your image!`, mediaType: 'image', aspectRatio, mediaUrl: imageUrl, isGenerating: false } : m));
        } catch (err: any) {
          console.error('Gemini API Error:', err.message);
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: `⚠️ Gemini API Error: ${err.message}` } : m));
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      console.error(e)
      Alert.alert('AI Error', 'The AI is currently busy. Please try again later.');
    } finally {
      setIsTyping(false)
      if (!isMockFallback) {
        fetchBalance()
      }
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && (
          <LinearGradient colors={['#ec4899', '#8b5cf6']} style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        )}
        <View style={[styles.messageContent, { backgroundColor: isUser ? '#1a1b1f' : 'transparent', padding: isUser ? 16 : 0 }]}>
          <Text style={styles.messageText} selectable={true}>{item.text}</Text>
          
          {item.mediaType && (
            <View style={[
              styles.mediaMockup, 
              item.aspectRatio === '16:9' ? { aspectRatio: 16/9 } : 
              item.aspectRatio === '9:16' ? { aspectRatio: 9/16 } : 
              { aspectRatio: 1 }
            ]}>
              {item.isGenerating ? (
                // Animated generating state
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0f0f14' }}>
                  <ActivityIndicator size="large" color="#8b5cf6" />
                  <Text style={{ color: '#8b5cf6', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>GENERATING...</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[0,1,2,3,4].map(i => (
                      <View key={i} style={{ width: 4, height: 20 + (i % 3) * 8, backgroundColor: '#8b5cf6', borderRadius: 2, opacity: 0.4 + i * 0.12 }} />
                    ))}
                  </View>
                  <Text style={{ color: '#52525b', fontSize: 11 }}>This may take a moment</Text>
                </View>
              ) : item.mediaUrl ? (
                <>
                  <Image source={{ uri: getCdnUrl(item.mediaUrl) }} style={{ width: '100%', height: '100%', position: 'absolute', resizeMode: 'cover' }} />
                </>
              ) : (
                <Ionicons name="image" size={48} color="#3f3f46" />
              )}
              
              {item.mediaUrl && !item.isGenerating && (
                <View style={{ flexDirection: 'row', gap: 8, position: 'absolute', bottom: 8, right: 8 }}>
                  <TouchableOpacity 
                    style={[styles.downloadBtn, { position: 'relative', bottom: 0, right: 0 }]} 
                    onPress={() => saveMedia(item.mediaUrl!)}
                  >
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.downloadBtn, { position: 'relative', bottom: 0, right: 0, backgroundColor: 'rgba(99,102,241,0.85)' }]} 
                    onPress={() => shareMedia(item.mediaUrl!)}
                  >
                    <Ionicons name="share-social-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Share</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Dapaz</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <TouchableOpacity style={styles.clearBtn} onPress={() => setIsHistoryVisible(true)}>
            <Ionicons name="list" size={20} color="#71717a" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => startNewConversation(mode)}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.upgradeBtn, { flexShrink: 1 }]} onPress={() => router.push('/wallet')}>
            <Ionicons name="diamond" size={16} color="#fbbf24" />
            {balance > 0 && isPremium ? (
              <Text style={[styles.upgradeBtnText, { color: '#fbbf24' }]} numberOfLines={1} adjustsFontSizeToFit>{formatTokens(balance)}</Text>
            ) : (
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Faint Center Watermark */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        <Text style={{ color: 'rgba(255,255,255,0.03)', fontSize: 72, fontWeight: '900', letterSpacing: 2 }}>Dapaz</Text>
      </View>

      {/* Mode Switcher - Now horizontal cards above input */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isTyping && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#ec4899" />
            <Text style={styles.typingText}>Dapaz is thinking...</Text>
          </View>
        )}

        {/* Wrap inputContainer with a View that adds EXACT tab bar padding ONLY when keyboard is hidden */}
        <View style={{ paddingBottom: isKeyboardVisible ? 12 : (insets.bottom + 56 + 8) }}>
          
          {showControls && (
            <View>
              {/* Horizontal Action Cards */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionCardsContainer}>
                <TouchableOpacity 
                  style={[styles.actionCard, mode === 'image' ? styles.actionCardActive : styles.actionCardInactive]} 
                  onPress={() => { if (mode !== 'image') startNewConversation('image'); Haptics.selectionAsync(); }}>
                  <Ionicons name="images-outline" size={16} color={mode === 'image' ? '#000' : '#fff'} />
                  <Text style={[styles.actionCardText, mode === 'image' && { color: '#000' }]}>Create Images</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionCard, mode === 'chat' ? styles.actionCardActive : styles.actionCardInactive]} 
                  onPress={() => { if (mode !== 'chat') startNewConversation('chat'); Haptics.selectionAsync(); }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={mode === 'chat' ? '#000' : '#fff'} />
                  <Text style={[styles.actionCardText, mode === 'chat' && { color: '#000' }]}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionCard, mode === 'translate' ? styles.actionCardActive : styles.actionCardInactive]} 
                  onPress={() => { if (mode !== 'translate') startNewConversation('translate'); Haptics.selectionAsync(); }}>
                  <Ionicons name="language-outline" size={16} color={mode === 'translate' ? '#000' : '#fff'} />
                  <Text style={[styles.actionCardText, mode === 'translate' && { color: '#000' }]}>Translate</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Aspect Ratio Picker (Only for Image modes) */}
              {mode === 'image' && (
                <View style={styles.arContainer}>
                  <TouchableOpacity onPress={() => setAspectRatio('1:1')} style={[styles.arPill, aspectRatio === '1:1' && styles.arPillActive]}>
                    <Ionicons name="square-outline" size={14} color={aspectRatio === '1:1' ? '#000' : '#fff'} />
                    <Text style={[styles.arText, aspectRatio === '1:1' && { color: '#000' }]}>1:1 Square</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setAspectRatio('16:9')} style={[styles.arPill, aspectRatio === '16:9' && styles.arPillActive]}>
                    <Ionicons name="phone-landscape-outline" size={14} color={aspectRatio === '16:9' ? '#000' : '#fff'} />
                    <Text style={[styles.arText, aspectRatio === '16:9' && { color: '#000' }]}>16:9 Landscape</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setAspectRatio('9:16')} style={[styles.arPill, aspectRatio === '9:16' && styles.arPillActive]}>
                    <Ionicons name="phone-portrait-outline" size={14} color={aspectRatio === '9:16' ? '#000' : '#fff'} />
                    <Text style={[styles.arText, aspectRatio === '9:16' && { color: '#000' }]}>9:16 Portrait</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Flyer Templates (Image mode only) */}
              {mode === 'image' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
                  {['Business Sale', 'Event Invite', 'Restaurant Menu', 'Job Vacancy', 'Announcement'].map(t => (
                    <TouchableOpacity key={t} onPress={() => { setInputText(`Create a professional business flyer for: ${t}. Make it vibrant, bold, and modern.`); Haptics.selectionAsync(); }}
                      style={{ backgroundColor: '#1e1e2e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#3f3f5a' }}>
                      <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '600' }}>✨ {t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Translate language indicator */}
              {mode === 'translate' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 8 }}>
                  <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '600' }}>English</Text>
                  <Ionicons name="swap-horizontal" size={18} color="#8b5cf6" />
                  <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '600' }}>Swahili</Text>
                  <Text style={{ color: '#52525b', fontSize: 12 }}>(auto-detect)</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.inputContainerOuter}>
            {attachedImage && (
              <View style={styles.attachedImageContainer}>
                <Image source={{ uri: getCdnUrl(attachedImage) }} style={styles.attachedImage} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setAttachedImage(null)}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainerInner}>
              <TouchableOpacity style={styles.attachBtn} onPress={() => setShowControls(!showControls)}>
                <Ionicons name={showControls ? "grid" : "menu"} size={20} color={showControls ? "#fff" : "#71717a"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={mode === 'chat' ? pickDocument : pickImage}>
                <Ionicons name={mode === 'chat' ? 'attach-outline' : 'add'} size={24} color="#71717a" />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder={
                  mode === 'chat' ? "Ask anything" :
                  mode === 'image' ? "Describe a flyer..." :
                  "Type text to translate..."
                }
                placeholderTextColor="#71717a"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              
              {inputText.trim() || attachedImage ? (
                <TouchableOpacity 
                  style={[styles.sendBtn, { backgroundColor: '#fff' }]} 
                  onPress={sendMessage}
                  disabled={isTyping}
                >
                  <Ionicons name="arrow-up" size={18} color="#000" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.sendBtn, { backgroundColor: isRecording ? '#ef4444' : '#1a1b1f' }]} 
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  delayPressIn={0}
                >
                  <Ionicons name="mic" size={18} color={isRecording ? "#fff" : "#71717a"} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal visible={isHistoryVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsHistoryVisible(false)}>
        <View style={styles.historyModalContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Chat History</Text>
            <TouchableOpacity onPress={() => setIsHistoryVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={conversations.sort((a,b) => b.updatedAt - a.updatedAt)}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({item}) => (
              <TouchableOpacity style={styles.historyItem} onPress={() => loadConversation(item)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Ionicons 
                    name={item.mode === 'image' ? 'images' : 'chatbubble-ellipses'} 
                    size={20} color="#a1a1aa" 
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyItemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.historyItemDate}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteConversation(item.id)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={{ color: '#71717a', textAlign: 'center', marginTop: 40 }}>No history yet.</Text>}
          />
        </View>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  clearBtn: { padding: 8, backgroundColor: '#1a1b1f', borderRadius: 20, borderWidth: 1, borderColor: '#27272a' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1b1f', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#3f3f46' },
  upgradeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: -1 },

  chatContainer: { padding: 16, paddingBottom: 20 },
  messageBubble: { flexDirection: 'row', marginBottom: 24, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  
  aiAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  messageContent: { padding: 16, borderRadius: 24 },
  messageText: { color: '#fff', fontSize: 17, lineHeight: 26 },

  typingIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  typingText: { color: 'rgba(255,255,255,0.5)', marginLeft: 8, fontSize: 14 },
  
  mediaMockup: { width: '100%', backgroundColor: '#09090b', borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#27272a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  downloadBtn: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  actionCardsContainer: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  actionCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6 },
  actionCardActive: { backgroundColor: '#fff' },
  actionCardInactive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' },
  actionCardText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  arContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  arPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  arPillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  arText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  inputContainerOuter: { paddingHorizontal: 16, paddingBottom: 16 },
  inputContainerInner: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1a1b1f', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 8, minHeight: 50 },
  attachedImageContainer: { position: 'relative', width: 80, height: 80, marginBottom: 8, marginLeft: 8 },
  attachedImage: { width: '100%', height: '100%', borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#3f3f46', borderRadius: 12, padding: 2 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, maxHeight: 120 },
  attachBtn: { padding: 8, marginBottom: 2 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4, marginLeft: 4 },

  historyModalContainer: { flex: 1, backgroundColor: '#09090b' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#27272a' },
  historyTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  historyItemTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  historyItemDate: { color: '#71717a', fontSize: 12 }
})
