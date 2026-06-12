import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

export function SplashScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [visible, setVisible] = useState(true)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start()

    // Fade out after 1.5 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }).start(() => setVisible(false))
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.content, { opacity: pulseAnim }]}>
        <Text style={styles.title}>JPM</Text>
        <Text style={styles.subtitle}>socialmarket</Text>
      </Animated.View>
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
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    color: colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.textDim,
    textTransform: 'uppercase',
  }
})
