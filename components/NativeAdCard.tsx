import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../lib/theme';

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
      <View style={{ width: '100%', alignItems: 'center', minHeight: adLoaded ? 'auto' : 60 }}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER || BannerAdSize.BANNER}
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
