import { useTheme } from '../lib/theme';
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../lib/i18n';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Discover & Post',
    description: 'Discover endless amazing products. Share your thoughts, post content, and engage with the community.',
    icon: 'compass-outline',
    color: '#3b82f6'
  },
  {
    id: '2',
    title: 'Chat in Real-Time',
    description: 'Connect instantly with sellers. Send text, voice notes, and GIFs in our fully encrypted messaging system.',
    icon: 'chatbubbles-outline',
    color: '#10b981'
  },
  {
    id: '3',
    title: 'Start Selling Today',
    description: 'Have something to sell? Open your own shop in seconds, manage inventory, and receive payments straight to your wallet.',
    icon: 'storefront-outline',
    color: '#8b5cf6'
  }
];

export default function Onboarding() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const SLIDES = [
    {
      id: '1',
      title: t('onboard_1_title'),
      description: t('onboard_1_desc'),
      icon: 'compass-outline',
      color: '#3b82f6'
    },
    {
      id: '2',
      title: t('onboard_2_title'),
      description: t('onboard_2_desc'),
      icon: 'chatbubbles-outline',
      color: '#10b981'
    },
    {
      id: '3',
      title: t('onboard_3_title'),
      description: t('onboard_3_desc'),
      icon: 'storefront-outline',
      color: '#8b5cf6'
    }
  ];

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      await AsyncStorage.setItem('@has_seen_onboarding', 'true');
      router.replace('/(tabs)');
    }
  };

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
    return (
      <View style={styles.slide}>
        <View style={[styles.iconContainer, { backgroundColor: item.color + '1A' }]}>
          <Ionicons name={item.icon as any} size={80} color={item.color} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 3 }}>
        <FlatList
          data={SLIDES}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
          ref={slidesRef}
        />
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.paginator}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 24, 10],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return <Animated.View style={[styles.dot, { width: dotWidth, opacity }]} key={i.toString()} />;
          })}
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? t('start_exploring') : t('next')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    width,
    alignItems: 'center',
    padding: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: '800',
    fontSize: 28,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontWeight: '400',
    fontSize: 16,
    color: colors.textDim,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  paginator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 64,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    marginHorizontal: 8,
  },
  button: {
    backgroundColor: colors.text,
    paddingVertical: 18,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
});
