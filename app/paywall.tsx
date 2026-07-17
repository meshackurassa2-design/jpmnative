import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// API Keys (Placeholder)
const APIKeys = {
  apple: "appl_api_key_here",
  google: "goog_api_key_here"
}

export default function PaywallScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [packages, setPackages] = useState<PurchasesPackage[]>([])
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  // Mock packages for UI if no API key
  const mockPackages = [
    { identifier: 'lite', product: { title: 'Lite', priceString: 'TSH 7,800' } },
    { identifier: 'monthly', product: { title: 'Pro Monthly', priceString: 'TSH 26,000' } },
    { identifier: 'annual', product: { title: 'Pro Annually', priceString: 'TSH 260,000' } }
  ]

  const packageFeatures: Record<string, string[]> = {
    'lite': ['100 AI Invoice Scans', 'Priority Support'],
    'monthly': ['Unlimited* AI Invoice Scans', 'Ad Tokens Unlocked'],
    'annual': ['Unlimited* AI Invoice Scans', 'Priority Support', 'Ad Tokens Unlocked'],
    // Default fallback
    'default': ['Unlimited* AI Invoice Scans', 'Priority Support']
  }

  useEffect(() => {
    setupRevenueCat()
  }, [])

  const setupRevenueCat = async () => {
    try {
      if (APIKeys.apple.includes('api_key_here') || APIKeys.google.includes('api_key_here')) {
        console.log("Using placeholder API keys, skipping RevenueCat configuration.");
        setIsLoaded(true);
        return;
      }

      if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: APIKeys.apple });
      } else if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: APIKeys.google });
      }
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (e) {
      console.log('Error fetching offerings', e)
    } finally {
      setIsLoaded(true)
    }
  }

  const handlePurchase = async (pkg: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setIsPurchasing(true)
    try {
      if (APIKeys.apple.includes('api_key_here') || APIKeys.google.includes('api_key_here')) {
        // Mock Purchase Warning
        Alert.alert(
          "Mock Payment (Dev Mode)",
          "You haven't entered your real Apple/Google API keys yet, so no real money can be charged.\n\nWould you like to simulate a successful payment?",
          [
            { text: "Cancel", style: "cancel", onPress: () => setIsPurchasing(false) },
            { text: "Simulate Payment", onPress: async () => await upgradeUser() }
          ]
        );
        return;
      }
      
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (typeof customerInfo.entitlements.active['pro'] !== "undefined") {
        await upgradeUser()
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Error purchasing package", e.message)
      }
      setIsPurchasing(false)
    }
  }

  const upgradeUser = async () => {
    // Save to local storage for instant UI update
    await AsyncStorage.setItem('mock_is_premium', 'true');

    // We update local Supabase DB
    const { error } = await supabase.from('profiles').update({ is_premium: true }).eq('id', user?.id)
    if (error) {
      console.error(error)
    }
    Alert.alert("Welcome to Pro!", "You have successfully upgraded to Dapaz Pro.", [
      { text: "Continue", onPress: () => router.back() }
    ])
    setIsPurchasing(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={styles.floatingCloseBtn}
      >
        <Ionicons name="close" size={28} color="#52525b" />
      </TouchableOpacity>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <Ionicons name="diamond" size={64} color="#fbbf24" style={styles.icon} />
        <Text style={styles.title}>Upgrade to Dapaz</Text>
        <Text style={styles.subtitle}>Choose the perfect plan to unlock the full power of AI invoice scanning and business tools.</Text>

        <View style={styles.packagesContainer}>
          {(packages.length > 0 ? packages : mockPackages).map((pkg: any) => {
            const features = packageFeatures[pkg.identifier] || packageFeatures['default'];
            return (
              <View key={pkg.identifier} style={styles.packageCardWrapper}>
                <TouchableOpacity 
                  style={styles.packageCard}
                  onPress={() => handlePurchase(pkg)}
                  disabled={isPurchasing}
                >
                  <View style={styles.packageCardInner}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <Text style={styles.packageName}>{pkg.product.title}</Text>
                        {pkg.identifier === 'annual' && (
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagText}>1 Year</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                      <View style={styles.packageFeaturesList}>
                        {features.map((feat, idx) => (
                          <View key={idx} style={styles.featureRowSmall}>
                            <Ionicons name="checkmark" size={14} color="#fbbf24" />
                            <Text style={styles.featureTextSmall}>{feat}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.purchaseBtn}>
                      <Text style={styles.purchaseBtnText}>Select</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>

        <Text style={styles.footnote}>
          * Unlimited plans are subject to our Fair Use Policy (FUP) to prevent API abuse and ensure fast speeds for all members.
        </Text>
      </ScrollView>
      
      {isPurchasing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const Feature = ({ text }: { text: string }) => (
  <View style={styles.featureRow}>
    <Ionicons name="checkmark-circle" size={20} color="#fbbf24" />
    <Text style={styles.featureText}>{text}</Text>
  </View>
)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  floatingCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 16, zIndex: 10, padding: 12, backgroundColor: '#18181b', borderRadius: 20 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  icon: { alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  
  featuresList: { marginBottom: 40, gap: 16 },
  
  packagesContainer: { gap: 16 },
  packageCardWrapper: { marginBottom: 0 },
  packageCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#27272a', backgroundColor: '#09090b' },
  packageCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  packageName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tagBadge: { backgroundColor: '#fbbf24', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagText: { color: '#000', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  packagePrice: { fontSize: 16, color: '#fbbf24', fontWeight: '600', marginBottom: 12 },
  packageFeaturesList: { gap: 6 },
  featureRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureTextSmall: { fontSize: 13, color: '#a1a1aa', fontWeight: '500' },
  
  purchaseBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, marginLeft: 16 },
  purchaseBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  
  footnote: { fontSize: 11, color: '#52525b', textAlign: 'center', marginTop: 24, paddingHorizontal: 16, lineHeight: 16 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 16, fontWeight: '600' }
})
