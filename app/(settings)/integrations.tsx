import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { createClient } from '../../lib/supabase'

export default function IntegrationsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [hasUnlocked, setHasUnlocked] = useState(false)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [purchasing, setPurchasing] = useState(false)

  const WEBHOOK_URL = 'https://tgfuufsgkelgjjktbugg.supabase.co/functions/v1/feed-the-brain'

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('ai_subscription_ends_at').eq('id', user.id).single()
    if (data?.ai_subscription_ends_at) {
      const expiry = new Date(data.ai_subscription_ends_at)
      const now = new Date()
      setHasUnlocked(expiry > now)
      setDaysRemaining(Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24))))
    } else {
      setHasUnlocked(false)
    }
    setLoading(false)
  }

  const handlePurchase = async () => {
    Alert.alert(
      'Subscribe to AI Pro',
      'This will deduct 25,000 Dapaz Coins and give you 30 days of unlimited AI access. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Purchase', 
          style: 'default',
          onPress: async () => {
            setPurchasing(true)
            const { error } = await supabase.rpc('buy_ai_subscription', { p_user_id: user?.id })
            setPurchasing(false)

            if (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              Alert.alert('Payment Failed', error.message || 'You might not have enough coins.')
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              fetchStatus()
            }
          }
        }
      ]
    )
  }

  const copyWebhook = async () => {
    await Clipboard.setStringAsync(WEBHOOK_URL)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied!', 'Webhook URL copied to clipboard.')
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'AI Integrations', headerBackTitle: 'Back' }} />

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {!hasUnlocked ? (
          // Paywall View
          <View style={styles.paywallContainer}>
            <LinearGradient
              colors={['#18181b', '#09090b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumCard}
            >
              <Ionicons name="hardware-chip" size={48} color="#ec4899" style={{ marginBottom: 16 }} />
              <Text style={styles.premiumTitle}>Dapaz AI Pro</Text>
              <Text style={styles.premiumDesc}>
                Unlock Unlimited AI Chats, Image Generation, and connect your Meta/Google Ads via Zapier.
              </Text>
              
              <View style={styles.priceTag}>
                <Text style={styles.priceAmount}>25,000 🪙</Text>
                <Text style={styles.priceLabel}>30 Days Access</Text>
              </View>

              <TouchableOpacity 
                style={[styles.purchaseBtn, purchasing && { opacity: 0.7 }]} 
                onPress={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.purchaseBtnText}>Unlock Now</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          // Unlocked View (Webhook Setup)
          <View>
            <View style={[styles.successBanner, { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 16 }}>AI Pro Active!</Text>
                <Text style={{ color: 'rgba(16,185,129,0.8)', fontSize: 13, marginTop: 2 }}>{daysRemaining} Days Remaining</Text>
              </View>
            </View>

            <Text style={{ color: colors.text, fontSize: 16, marginTop: 24, marginBottom: 16, fontWeight: '600' }}>
              How do you want to connect your marketing accounts?
            </Text>

            {/* Option A: Ask for Help */}
            <TouchableOpacity 
              style={{ backgroundColor: '#25D366', padding: 20, borderRadius: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => Alert.alert('Contact Support', 'In production, this opens WhatsApp to +255765450573 to request AI integration setup.')}
            >
              <Ionicons name="logo-whatsapp" size={32} color="#fff" />
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>Option A: Done For You</Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 }}>Chat with Dapaz Support on WhatsApp. We will connect your Meta/Google Ads for you!</Text>
              </View>
            </TouchableOpacity>

            {/* Option B: Self Setup */}
            <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>Option B: Do It Yourself</Text>
              <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 18, marginBottom: 20 }}>Use this Webhook URL in Zapier or Make.com as a POST request to send data into your AI Brain.</Text>
              
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Webhook URL</Text>
              <View style={[styles.webhookBox, { marginTop: 8, marginBottom: 20 }]}>
                <Text style={styles.webhookText}>{WEBHOOK_URL}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={copyWebhook}>
                  <Ionicons name="copy-outline" size={20} color="#fff" />
                  <Text style={styles.copyText}>Copy</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>JSON Payload</Text>
              <View style={[styles.codeBox, { marginTop: 8 }]}>
                <Text style={styles.codeText}>
{`{
  "user_id": "${user?.id}",
  "source": "meta_ads",
  "content": "Add your dynamic zapier data here!"
}`}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  
  paywallContainer: { alignItems: 'center', marginTop: 20 },
  premiumCard: {
    width: '100%',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10
  },
  premiumTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 16 },
  premiumDesc: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 12, lineHeight: 22 },
  
  priceTag: { backgroundColor: 'rgba(236,72,153,0.1)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, marginVertical: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(236,72,153,0.3)' },
  priceAmount: { fontSize: 28, fontWeight: '900', color: '#ec4899', marginBottom: 4 },
  priceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase' },

  purchaseBtn: { width: '100%', backgroundColor: '#ec4899', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  purchaseBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  successBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  
  webhookBox: { backgroundColor: '#18181b', borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46', overflow: 'hidden' },
  webhookText: { color: '#fff', padding: 16, fontSize: 14, fontFamily: 'monospace' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#27272a', padding: 12, borderTopWidth: 1, borderTopColor: '#3f3f46' },
  copyText: { color: '#fff', marginLeft: 8, fontWeight: '600' },

  codeBox: { backgroundColor: '#18181b', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46' },
  codeText: { color: '#10b981', fontSize: 14, fontFamily: 'monospace', lineHeight: 22 }
})
