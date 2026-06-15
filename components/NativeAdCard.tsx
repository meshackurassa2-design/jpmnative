import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import {
  NativeAd,
  NativeAdView,
  NativeMediaView,
  TestIds
} from 'react-native-google-mobile-ads';

const { width } = Dimensions.get('window');

// Use the Official AdMob Test Native Advanced ID for development to prevent accidental bans
// In production, use the real JPM In-Feed Native Ad Unit ID from the screenshot
const adUnitId = __DEV__ ? TestIds.NATIVE : 'ca-app-pub-4939768656689626/6513364964';

export function NativeAdCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ad: NativeAd;
    const loadAd = async () => {
      try {
        ad = await NativeAd.createForAdRequest(adUnitId);
        setNativeAd(ad);
      } catch (e: any) {
        console.log('Native Ad failed to load', e);
        setError(e.message);
      }
    };
    loadAd();
    return () => {
      if (ad) ad.destroy();
    };
  }, []);

  if (error) return null; // Silently fail if ad doesn't load
  if (!nativeAd) return null; // Wait until loaded

  return (
    <View style={styles.post}>
      <NativeAdView
        nativeAd={nativeAd}
        style={{ width: '100%', minHeight: 100 }}
      >
        {/* HEADER: Matches standard PostHeader */}
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
             {nativeAd.icon && nativeAd.icon.uri ? (
               <Image source={{ uri: nativeAd.icon.uri }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
             ) : (
               <View style={{ width: '100%', height: '100%', backgroundColor: colors.border, borderRadius: 20 }} />
             )}
          </View>
          <View style={styles.postHeaderText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.fullName}>{nativeAd.advertiser || 'Sponsored Ad'}</Text>
              <Ionicons name="checkmark-circle" size={14} color="#2563eb" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={styles.usernameBadge}>
                 <Text style={styles.usernameBadgeText}>Ad</Text>
              </View>
              <Text style={styles.username}>Promoted</Text>
            </View>
          </View>
          <View style={{ padding: 4 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#a1a1aa" />
          </View>
        </View>

        {/* BODY: Matches standard PostContent */}
        {nativeAd.body ? (
           <Text style={styles.postContent}>{nativeAd.body}</Text>
        ) : null}

        {/* MEDIA: Matches standard PostImage */}
        {nativeAd.mediaContent ? (
          <View style={{ marginBottom: 10, width: '100%', aspectRatio: 1.5 }}>
             <NativeMediaView style={styles.postImage} />
          </View>
        ) : nativeAd.images && nativeAd.images.length > 0 ? (
          <View style={{ marginBottom: 10, width: '100%', aspectRatio: 1.5 }}>
             <Image source={{ uri: nativeAd.images[0].uri }} style={styles.postImage} />
          </View>
        ) : null}

        {/* FOOTER ACTIONS: Matches standard Actions + Call to Action */}
        <View style={styles.actions}>
          <Text style={[styles.headline, { flex: 1 }]} numberOfLines={2}>
            {nativeAd.headline}
          </Text>
          
          {nativeAd.callToAction ? (
             <View style={styles.ctaButton}>
               <Text style={styles.ctaButtonText}>{nativeAd.callToAction}</Text>
             </View>
          ) : null}
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
      overflow: 'hidden',
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
      paddingHorizontal: 4,
      borderRadius: 2,
    },
    usernameBadgeText: {
      color: colors.textDim,
      fontSize: 10,
      fontWeight: 'bold',
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
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headline: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    ctaButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    ctaButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
