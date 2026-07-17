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

export function NativeAdCard({ fallback }: { fallback?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  // If native module not available or ad failed to load, render our direct ad fallback
  if (!BannerAd || !BannerAdSize || adFailed) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <View style={styles.wrapper}>
      {/* Show Direct Ad fallback seamlessly while Google Ad is loading in the background */}
      {!adLoaded && fallback && (
        <View style={{ width: '100%' }}>
          {fallback}
        </View>
      )}

      {/* Google AdMob Banner - When loaded, it displays and hides our direct ad fallback */}
      <View style={!adLoaded ? { height: 0, overflow: 'hidden', opacity: 0 } : { width: '100%', alignItems: 'center' }}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.BANNER}
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
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      backgroundColor: colors.card,
      width: '100%',
    },
  });
}
