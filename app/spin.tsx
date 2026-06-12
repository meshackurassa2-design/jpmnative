// app/spin.tsx
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const SPIN_COST = 30;

// The segments on the wheel and their visual payout text
const WHEEL_SEGMENTS = [0, 15, 60, 300, 1500, 0]
const SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length

export default function SpinScreen() {
  const { user } = useAuth()
  const supabase = createClient()

  const [balance, setBalance] = useState<number>(0)
  const [spinning, setSpinning] = useState(false)
  const [forcingAd, setForcingAd] = useState(false)
  const [lastWin, setLastWin] = useState<number | null>(null)

  // Animations
  const spinAnim = useRef(new Animated.Value(0)).current
  const lastSegmentRef = useRef(0)

  // To keep track of continuous rotation
  const currentRotationRef = useRef(0)

  useEffect(() => {
    if (user) fetchBalance()
  }, [user])

  const fetchBalance = async () => {
    const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', user?.id).single()
    if (data) setBalance(data.wallet_balance || 0)
  }

  const handleSpin = async () => {
    if (spinning) return
    if (balance < SPIN_COST) {
      Alert.alert('Not enough coins', `You need at least ${SPIN_COST} 🪙 to spin!`)
      return
    }

    setSpinning(true)
    setLastWin(null)
    setBalance(b => b - SPIN_COST)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    // Add listener for physical haptic ticks as the wheel spins
    const listenerId = spinAnim.addListener(({ value }) => {
      const currentSegment = Math.floor(value / SEGMENT_ANGLE)
      if (currentSegment > lastSegmentRef.current) {
        lastSegmentRef.current = currentSegment
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    })

    // 1. Start continuous fast spinning (linear)
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: currentRotationRef.current + 360,
        duration: 400,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start()

    // 2. Call Database for outcome
    const { data: payout, error } = await supabase.rpc('play_casino_spin', { p_user_id: user?.id, p_bet: SPIN_COST })

    setTimeout(() => {
      // Stop the infinite loop exactly where it is
      spinAnim.stopAnimation((currentVal) => {
        if (error) {
          setSpinning(false)
          spinAnim.removeListener(listenerId)
          Alert.alert('Error', error.message || 'Something went wrong.')
          return
        }

        // 3. Find the index of the payout in the wheel
        let targetIndex = WHEEL_SEGMENTS.indexOf(payout)
        if (payout === 0 && Math.random() > 0.5) targetIndex = 5;

        // 4. Calculate exact angle to stop on
        const targetAngle = 360 - (targetIndex * SEGMENT_ANGLE);

        // Calculate a smooth stopping target: current position + 3 full spins + final target angle
        const currentRot = currentVal + currentRotationRef.current
        const normalizedRot = currentRot % 360
        const spinsToAdd = 360 * 3
        
        currentRotationRef.current = currentRot - normalizedRot + spinsToAdd + targetAngle
        
        // Reset base value to match current continuous rotation
        spinAnim.setValue(currentRot)

        // 5. Smoothly decelerate to the final target
        Animated.timing(spinAnim, {
          toValue: currentRotationRef.current,
          duration: 3500, // 3.5 seconds of smooth slow down
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }).start(() => {
          setSpinning(false)
          spinAnim.removeListener(listenerId)
          setLastWin(payout)
          fetchBalance()

          if (payout === 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            
            // Force an unskippable ad penalty for losing!
            setTimeout(() => {
              setForcingAd(true)
              setTimeout(() => {
                setForcingAd(false)
              }, 4000) // 4 second forced ad penalty
            }, 1000) // Show loss text for 1 second before forcing ad
            
          } else if (payout >= 300) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
        })
      })
    }, 1500) // Spin fast for 1.5s before slowing down

  }

  const rotateInterpolate = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg']
  })

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#312e81']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.balanceBadge}>
          <Text style={styles.balanceText}>{balance.toLocaleString()} 🪙</Text>
        </View>
      </View>

      <View style={styles.main}>
        <Text style={styles.title}>ROULETTE</Text>
        <Text style={styles.subtitle}>Spin the wheel of fortune!</Text>

        {/* The Wheel Pointer */}
        <View style={styles.pointerContainer}>
          <Ionicons name="caret-down" size={50} color="#ec4899" />
        </View>

        {/* The Wheel */}
        <View style={styles.wheelContainer}>
          <Animated.View style={[
            styles.wheel,
            { transform: [{ rotate: rotateInterpolate }] }
          ]}>
            {WHEEL_SEGMENTS.map((amount, idx) => {
              const rotation = idx * SEGMENT_ANGLE;
              return (
                <View 
                  key={idx} 
                  style={[
                    styles.segment,
                    { transform: [{ rotate: `${rotation}deg` }, { translateY: -100 }] }
                  ]}
                >
                  <Text style={[styles.segmentText, amount === 0 && { color: '#ef4444' }, amount >= 300 && { color: '#fbbf24' }]}>
                    {amount}
                  </Text>
                </View>
              )
            })}
            
            {/* Center Hub */}
            <View style={styles.wheelHub} />
          </Animated.View>
        </View>

        <View style={{ height: 80, justifyContent: 'center' }}>
          {lastWin !== null && (
            <View style={styles.resultBox}>
              {lastWin === 0 ? (
                <Text style={[styles.resultText, { color: '#ef4444' }]}>BUST! You lost {SPIN_COST} coins.</Text>
              ) : (
                <Text style={[styles.resultText, { color: '#10b981' }]}>
                  YOU WON {lastWin} COINS!
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.spinButton, spinning && { opacity: 0.5 }]} 
          onPress={handleSpin}
          disabled={spinning}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ec4899', '#f43f5e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.spinButtonGradient}
          >
            {spinning ? (
              <Text style={styles.spinButtonText}>SPINNING...</Text>
            ) : (
              <Text style={styles.spinButtonText}>SPIN FOR {SPIN_COST} 🪙</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Forced Ad Overlay */}
      {forcingAd && (
        <View style={styles.forcedAdContainer}>
          <LinearGradient
            colors={['#000000', '#1f2937']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.adTitle}>Sponsor Ad</Text>
          <View style={styles.adContent}>
            <Ionicons name="play-circle" size={80} color="#6366f1" style={{ marginBottom: 20 }} />
            <Text style={styles.adText}>Playing forced video ad...</Text>
            <Text style={styles.adSubText}>Because you lost your spin!</Text>
          </View>
        </View>
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  balanceBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  balanceText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontSize: 42, fontWeight: '900', color: '#fff', marginBottom: 8, textShadowColor: '#ec4899', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 20 },
  
  pointerContainer: {
    zIndex: 10,
    marginBottom: -25, // Overlap the wheel
  },
  
  wheelContainer: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  wheel: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 6,
    borderColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 15,
  },
  segment: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    transform: [{ rotate: '90deg' }] // Optional: adjust text orientation if needed
  },
  wheelHub: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ec4899',
    borderWidth: 4,
    borderColor: '#fff',
  },

  resultBox: { padding: 15, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16 },
  resultText: { fontSize: 22, fontWeight: '900', textAlign: 'center' },

  footer: { padding: 30, paddingBottom: 50 },
  spinButton: { borderRadius: 100, shadowColor: '#f43f5e', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  spinButtonGradient: { height: 70, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  spinButtonText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },

  forcedAdContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  adTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', position: 'absolute', top: 60, left: 20 },
  adContent: { alignItems: 'center' },
  adText: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  adSubText: { color: '#ec4899', fontSize: 16, fontWeight: '600', textAlign: 'center' }
})
