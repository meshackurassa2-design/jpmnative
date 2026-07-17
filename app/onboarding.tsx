import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity,
  Animated, StatusBar, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    heroIcon: 'phone-portrait-outline',
    title: 'Karibu JPM!',
    subtitle: 'Welcome to JPM',
    description: 'Your one-stop platform to connect, shop, and grow — built for Africa.',
    color: '#3b82f6',
    bg: '#dbeafe',
    darkBg: '#1e3a5f',
    steps: [
      { icon: 'person-circle-outline', text: 'Create your free account' },
      { icon: 'compass-outline', text: 'Explore posts & products' },
      { icon: 'chatbubble-outline', text: 'Chat with sellers & friends' },
    ]
  },
  {
    id: '2',
    heroIcon: 'storefront-outline',
    title: 'Buy & Sell Easily',
    subtitle: 'Nunua na Uze Kwa Urahisi',
    description: 'Browse thousands of products. Open your own shop in seconds and start earning today.',
    color: '#10b981',
    bg: '#d1fae5',
    darkBg: '#064e3b',
    steps: [
      { icon: 'storefront-outline', text: 'Open a verified shop' },
      { icon: 'cube-outline', text: 'List products with photos & prices' },
      { icon: 'cash-outline', text: 'Receive payouts via Airtel Money & more' },
    ]
  },
  {
    id: '3',
    heroIcon: 'chatbubble-ellipses-outline',
    title: 'Chat & Connect',
    subtitle: 'Zungumza na Warafiki',
    description: 'Message anyone directly. Send voice notes, photos, and GIFs — it\'s free!',
    color: '#8b5cf6',
    bg: '#ede9fe',
    darkBg: '#3b1f6e',
    steps: [
      { icon: 'mic-outline', text: 'Send voice notes easily' },
      { icon: 'image-outline', text: 'Share photos & videos' },
      { icon: 'shield-checkmark-outline', text: 'Safe & private messaging' },
    ]
  },
  {
    id: '4',
    heroIcon: 'wallet-outline',
    title: 'Earn Real Money',
    subtitle: 'Pata Pesa Halisi',
    description: 'Create content, get views, and earn from ads. Join creators already earning on JPM.',
    color: '#f59e0b',
    bg: '#fef3c7',
    darkBg: '#4d3000',
    steps: [
      { icon: 'videocam-outline', text: 'Post videos & photos' },
      { icon: 'trending-up-outline', text: 'Grow your audience' },
      { icon: 'wallet-outline', text: 'Earn from ad revenue' },
    ]
  },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const isDark = colors.isDark;
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('@has_seen_onboarding_v2', 'true');
    router.replace('/(auth)/signup');
  };

  const goToLogin = async () => {
    await AsyncStorage.setItem('@has_seen_onboarding_v2', 'true');
    router.replace('/(auth)/login');
  };

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
    const bgColor = isDark ? item.darkBg : item.bg;
    return (
      <View style={[styles.slide]}>
        {/* Big vector icon hero */}
        <View style={[styles.heroCircle, { backgroundColor: bgColor }]}>
          <Ionicons name={item.heroIcon as any} size={64} color={item.color} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textDim }]}>{item.subtitle}</Text>
        <Text style={[styles.description, { color: colors.text }]}>{item.description}</Text>

        {/* Step-by-step visual guide */}
        <View style={[styles.stepsCard, { backgroundColor: isDark ? colors.card : '#fff', borderColor: colors.border }]}>
          {item.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIconBg, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={step.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[styles.stepText, { color: colors.text }]}>{step.text}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const slide = SLIDES[currentIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Skip button top right */}
        <TouchableOpacity style={styles.skipBtn} onPress={finishOnboarding}>
          <Text style={[styles.skipText, { color: colors.textDim }]}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <FlatList
          data={SLIDES}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
          ref={slidesRef}
        />

        {/* Dot indicators */}
        <View style={styles.paginator}>
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity, backgroundColor: slide.color }]}
              />
            );
          })}
        </View>

        {/* CTA Buttons */}
        <View style={styles.btnContainer}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: slide.color }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {currentIndex === SLIDES.length - 1 ? 'Create Free Account →' : 'Next →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={goToLogin} activeOpacity={0.7}>
            <Text style={[styles.secondaryBtnText, { color: colors.textDim }]}>
              I already have an account
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  slide: {
    width,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  heroEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  stepsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  paginator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  btnContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
