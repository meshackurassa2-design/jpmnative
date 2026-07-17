import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../lib/theme';

// Your real AdMob Banner Ad Unit ID
const adUnitId = Platform.OS === 'ios'
  ? 'ca-app-pub-8166782428171770/7007104506'
  : 'ca-app-pub-8166782428171770/7007104506';

// Safely import BannerAd — it crashes in Expo Go if native module is missing
let BannerAd: any = null;
let BannerAdSize: any = null;
try {
  const admob = require('react-native-google-mobile-ads');
  BannerAd = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
} catch (e) {
  // Running in Expo Go — native module not available, will return null
}

export function NativeAdCard() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [adFailed, setAdFailed] = useState(false);

  // If native module not available or ad failed to load, render nothing
  if (!BannerAd || !BannerAdSize || adFailed) return null;

  return (
    <View style={styles.wrapper}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={() => setAdFailed(true)}
      />
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingVertical: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
    },
  });
}
