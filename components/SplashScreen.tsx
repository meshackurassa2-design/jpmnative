import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import { View, StyleSheet, Animated, Easing } from 'react-native'

export function SplashScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [visible, setVisible] = useState(true)

  // Logo animations
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.7)).current

  // Dot / glow pulse
  const glowScale = useRef(new Animated.Value(0)).current
  const glowOpacity = useRef(new Animated.Value(0)).current

  // Exit animations
  const containerOpacity = useRef(new Animated.Value(1)).current
  const exitScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // ── Phase 1: Logo pops in ────────────────────────────────────────
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()

    // ── Phase 2: Glow pulse once ─────────────────────────────────────
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.25, duration: 300, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 300, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.8, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start()

    // ── Phase 3: Exit — logo zooms in then fade out ──────────────────
    Animated.sequence([
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(exitScale, {
          toValue: 1.15,
          duration: 250,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setVisible(false))
  }, [])

  if (!visible) return null

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]} pointerEvents="none">

      {/* Glow ring behind logo */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Logo */}
      <Animated.Text
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
            transform: [
              { scale: Animated.multiply(logoScale, exitScale) },
            ],
          },
        ]}
      >
        JPM
      </Animated.Text>

    </Animated.View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logo: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: 6,
    color: colors.primary,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
  },
})
