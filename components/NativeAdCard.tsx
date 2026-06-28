import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import NativeAdView, {
  AdBadge,
  HeadlineView,
  TaglineView,
  IconView,
  ImageView,
  CallToActionView,
} from 'react-native-admob-native-ads';

const { width } = Dimensions.get('window');

// Use official test ID for development, real one for prod
const adUnitId = __DEV__ 
  ? (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/3986624511' : 'ca-app-pub-3940256099942544/2247696110')
  : (Platform.OS === 'ios' ? 'ca-app-pub-8166782428171770/4346933923' : 'ca-app-pub-4939768656689626/6513364964');

export function NativeAdCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const nativeAdRef = useRef<NativeAdView>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null; // Hide if failed to load

  return (
    <View style={styles.post}>
      <NativeAdView
        ref={nativeAdRef}
        adUnitID={adUnitId}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(err) => {
          console.log('Ad Failed to Load:', err);
          setError(true);
        }}
        style={{ width: '100%' }}
        adChoicesPlacement="topRight"
      >
        {/* HEADER: Matches standard PostHeader */}
        <View style={styles.postHeader}>
          <IconView style={styles.avatar} />
          
          <View style={styles.postHeaderText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <HeadlineView style={styles.fullName} />
              <Ionicons name="checkmark-circle" size={14} color="#2563eb" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AdBadge style={styles.usernameBadge} textStyle={styles.usernameBadgeText} />
              <Text style={styles.username}>Promoted</Text>
            </View>
          </View>
          <View style={{ padding: 4 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#a1a1aa" />
          </View>
        </View>

        {/* BODY: Matches standard PostContent */}
        <TaglineView style={styles.postContent} />

        {/* MEDIA: Matches standard PostImage */}
        <View style={{ width: '100%', aspectRatio: 1.5, marginBottom: 10 }}>
          <ImageView style={styles.postImage} resizeMode="cover" />
        </View>

        {/* FOOTER ACTIONS: Call to Action */}
        <View style={styles.actions}>
          <CallToActionView 
            style={styles.ctaButton} 
            textStyle={styles.ctaButtonText} 
          />
        </View>
      </NativeAdView>
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    post: {
      backgroundColor: colors.card,
      paddingTop: 12,
      paddingBottom: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: colors.border,
    },
    postHeaderText: {
      flex: 1,
      justifyContent: 'center',
    },
    fullName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    username: {
      color: colors.textDim,
      fontSize: 13,
    },
    usernameBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    usernameBadgeText: {
      color: colors.textDim,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase'
    },
    postContent: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    postImage: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.background,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    ctaButton: {
      backgroundColor: colors.primary, // Using Dapaz pink
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center'
    },
    ctaButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
}
