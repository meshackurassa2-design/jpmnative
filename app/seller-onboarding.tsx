import { useTheme } from '../lib/theme';
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from '../lib/i18n';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Your Store Dashboard',
    description: 'Manage your entire shop in one place. Add new products, track your inventory, and view your store analytics easily.',
    icon: 'storefront-outline',
    color: '#2563eb'
  },
  {
    id: '2',
    title: 'Dedicated Shop Inbox',
    description: 'Never mix personal and business again. All customer inquiries automatically route to your dedicated Shop tab in Messages.',
    icon: 'chatbubbles-outline',
    color: '#eab308'
  },
  {
    id: '3',
    title: 'Wallet & Payouts',
    description: 'Track your earnings from every sale. Request payouts directly to your Mobile Money (M-PESA, Tigo Pesa, Airtel Money) instantly.',
    icon: 'wallet-outline',
    color: '#9333ea'
  }
];

export default function SellerOnboarding() {
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
      title: t('seller_1_title'),
      description: t('seller_1_desc'),
      icon: 'storefront-outline',
      color: '#2563eb'
    },
    {
      id: '2',
      title: t('seller_2_title'),
      description: t('seller_2_desc'),
      icon: 'chatbubbles-outline',
      color: '#eab308'
    },
    {
      id: '3',
      title: t('seller_3_title'),
      description: t('seller_3_desc'),
      icon: 'wallet-outline',
      color: '#9333ea'
    }
  ];

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/(settings)/store-dashboard');
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
            {currentIndex === SLIDES.length - 1 ? t('go_to_dashboard') : t('next')}
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
    backgroundColor: '#2563eb',
    marginHorizontal: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 18,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
