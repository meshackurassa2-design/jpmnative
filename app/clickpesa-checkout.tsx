import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'

import { useTheme } from '../lib/theme'
import { useAuth } from '../lib/auth'
import { initiateAndWait, PaymentStatus } from '../lib/clickpesa'

export default function ClickPesaCheckoutScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const topPadding = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 54 : Constants.statusBarHeight)

  const { user } = useAuth()
  const params = useLocalSearchParams()
  
  // Default to 5000 if not provided
  const amountStr = Array.isArray(params.amount) ? params.amount[0] : params.amount
  const amount = parseFloat(amountStr || '5000') 
  
  const descriptionStr = Array.isArray(params.description) ? params.description[0] : params.description
  const description = descriptionStr || 'JPM Services'

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)

  const handlePay = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make a payment.')
      return
    }
    
    if (!phone || phone.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter a valid Tanzanian mobile number (e.g. 0712345678)')
      return
    }

    setLoading(true)
    setPaymentStatus('PROCESSING')

    try {
      const payment = await initiateAndWait(
        amount,
        phone,
        user.id,
        description,
        {
          onStatus: (status) => setPaymentStatus(status),
        }
      )

      if (payment.status === 'SUCCESS' || payment.status === 'SETTLED') {
        Alert.alert('Payment Successful!', 'Thank you for your payment.', [
          { text: 'OK', onPress: () => router.back() }
        ])
      } else {
        setPaymentStatus(null)
      }
    } catch (error: any) {
      console.error(error)
      Alert.alert('Payment Failed', error.message || 'Something went wrong.')
      setPaymentStatus(null)
    } finally {
      setLoading(false)
    }
  }

  // Formatting helpers
  const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 0 })

  return (
    <SafeAreaView style={[styles.container, { paddingTop: topPadding }]} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay with Mobile Money</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total to Pay</Text>
            <Text style={styles.amountText}>{formattedAmount} TZS</Text>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>

          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={styles.infoBannerText}>
              <Text style={{ fontWeight: 'bold' }}>Accepted Networks: </Text>
              Airtel Money, Halopesa, and Tigo Pesa.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Money Number</Text>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.phonePrefix}>+255</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="712 345 678"
                placeholderTextColor={colors.gray}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                editable={!loading}
              />
            </View>
            <Text style={styles.hintText}>Enter the number that will receive the payment prompt.</Text>
          </View>

          {paymentStatus === 'PROCESSING' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.statusTitle}>Waiting for Payment</Text>
              <Text style={styles.statusDesc}>
                Please check your phone and enter your PIN to authorize the payment.
              </Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[styles.payButton, loading && styles.payButtonDisabled]}
          onPress={handlePay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.payButtonText}>Pay {formattedAmount} TZS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  scrollContent: {
    padding: 20,
  },
  amountContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.text,
  },
  descriptionText: {
    fontSize: 16,
    color: colors.gray,
    marginTop: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '15', // 15% opacity
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.border + '50',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: colors.text,
  },
  hintText: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 8,
    marginLeft: 4,
  },
  statusContainer: {
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  statusDesc: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  payButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
