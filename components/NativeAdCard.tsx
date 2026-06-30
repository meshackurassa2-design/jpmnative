import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useTheme } from '../lib/theme';

const { width } = Dimensions.get('window');

const adUnitId = Platform.OS === 'ios'
  ? 'ca-app-pub-8166782428171770/4346933923'
  : 'ca-app-pub-4939768656689626/6513364964';

export function NativeAdCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <View style={[styles.wrapper, { height: loaded ? undefined : 0, overflow: 'hidden' }]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setError(true)}
      />
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
  });
}
