import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

// Your real AdMob Banner Ad Unit ID
const adUnitId = Platform.OS === 'ios'
  ? 'ca-app-pub-8166782428171770/7007104506'
  : 'ca-app-pub-8166782428171770/7007104506';

import Constants, { ExecutionEnvironment } from 'expo-constants';

// Safely import BannerAd — it crashes in Expo Go if native module is missing
let BannerAd: any = null;
let BannerAdSize: any = null;

// Only attempt to require the native module if we are NOT in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    const admob = require('react-native-google-mobile-ads');
    BannerAd = admob.BannerAd;
    BannerAdSize = admob.BannerAdSize;
  } catch (e) {
    console.log("Google Mobile Ads native module not available");
  }
}


export function NativeAdCard({ adInfo }: { adInfo?: { title?: string, description?: string, avatarUrl?: string, imageUrl?: string, onPress?: () => void } }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  // If native module not available and no adInfo provided, return null
  if ((!BannerAd || !BannerAdSize) && !adInfo) {
    return null;
  }

  const handlePress = () => {
    if (!adLoaded && adInfo?.onPress) {
      adInfo.onPress();
    }
  };

  return (
    <View style={[styles.wrapper]}>
      <View style={[styles.post, { paddingBottom: 0, width: '100%' }]}>
        {/* Left Column: Avatar */}
        <View style={styles.postLeftColumn}>
          {adInfo?.avatarUrl ? (
            <Image source={{ uri: adInfo.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="megaphone" size={18} color={colors.primary} />
            </View>
          )}
        </View>

        {/* Right Column: Content */}
        <View style={styles.postRightColumn}>
          {/* Header Row */}
          <View style={styles.postHeaderRow}>
            <View style={styles.postUserInfo}>
              <Text style={styles.fullName} numberOfLines={1}>{adInfo?.title || 'Sponsored Partner'}</Text>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.username} numberOfLines={1}>@sponsor · Promoted</Text>
            </View>
          </View>

          {/* Text Content */}
          <Text style={styles.postContent}>{adInfo?.description || 'Check out this sponsored recommendation below.'}</Text>

          {/* MEDIA SKELETON: Fixed height container */}
          <View style={{ marginTop: 8, marginBottom: 12, alignItems: 'center', width: '100%', height: 250, overflow: 'hidden', borderRadius: 12, backgroundColor: colors.border, position: 'relative' }}>
            
            {/* Bottom Layer: Fallback Direct Ad Image */}
            <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: adLoaded ? 0 : 1 }}>
               {adInfo?.imageUrl ? (
                 <Image source={{ uri: adInfo.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
               ) : (
                 <View style={{ width: '100%', height: '100%', backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' }}>
                   <Ionicons name="diamond-outline" size={32} color={colors.primary} style={{ marginBottom: 6 }} />
                   <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'center' }}>{adInfo?.title || 'Special Promotion'}</Text>
                 </View>
               )}
            </TouchableOpacity>

            {/* Top Layer: Google Banner Ad (crossfades over fallback when loaded) */}
            {(!adFailed && BannerAd && BannerAdSize) && (
              <View style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                alignItems: 'center', 
                justifyContent: 'center',
                opacity: adLoaded ? 1 : 0 
              }}>
                <BannerAd
                  unitId={adUnitId}
                  size={BannerAdSize.MEDIUM_RECTANGLE}
                  requestOptions={{ requestNonPersonalizedAdsOnly: false }}
                  onAdLoaded={() => {
                    setAdLoaded(true);
                    setAdFailed(false);
                  }}
                  onAdFailedToLoad={(error: any) => {
                    setAdFailed(true);
                    setAdLoaded(false);
                  }}
                />
              </View>
            )}

          </View>

          {/* CTA Button */}
          <TouchableOpacity 
            style={{ backgroundColor: colors.primary + '15', borderRadius: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }} 
            activeOpacity={0.85}
            onPress={handlePress}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '800' }}>LEARN MORE</Text>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      width: '100%',
    },
    post: {
      flexDirection: 'row',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    postLeftColumn: {
      marginRight: 12,
      alignItems: 'center',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    postRightColumn: {
      flex: 1,
    },
    postHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    postUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 4,
    },
    fullName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    username: {
      fontSize: 15,
      color: colors.textDim,
      flexShrink: 1,
    },
    postContent: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      marginBottom: 12,
    },
    postFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingRight: 24,
      marginBottom: 12,
    },
    footerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
  });
}
