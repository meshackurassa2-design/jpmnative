import { useTheme } from '../lib/theme';
import React, { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

export function SplashScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [visible, setVisible] = useState(true)
  const scale = useRef(new Animated.Value(0.85)).current
  const bgOpacity = useRef(new Animated.Value(1)).current
  const tzScaleX = useRef(new Animated.Value(0)).current
  const tzScaleY = useRef(new Animated.Value(1)).current

  const animsY = useRef([new Animated.Value(20), new Animated.Value(20), new Animated.Value(20)]).current
  const animsOpacity = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current

  useEffect(() => {
    // 1. Beautiful staggered floating entrance for the letters
    const letterAnimations = [0, 1, 2].map((i) => 
      Animated.parallel([
        Animated.timing(animsOpacity[i], { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(animsY[i], { toValue: 0, tension: 70, friction: 6, useNativeDriver: true })
      ])
    )

    Animated.parallel([
      Animated.stagger(150, letterAnimations),
      Animated.timing(scale, { toValue: 1.05, duration: 2500, useNativeDriver: true }),
      // 2. Wipe in the Tanzania flag line as a sleek pill
      Animated.spring(tzScaleX, { toValue: 1, tension: 45, friction: 5, delay: 650, useNativeDriver: true })
    ]).start()

    // 3. The Grand Finale: Circular Expanding Flag Wipe
    Animated.sequence([
      Animated.delay(1700),
      Animated.parallel([
        // Letters fade out
        Animated.timing(animsOpacity[0], { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(animsOpacity[1], { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(animsOpacity[2], { toValue: 0, duration: 150, useNativeDriver: true }),
        // Flag expands into a massive circular wipe
        Animated.timing(tzScaleX, { toValue: 25, duration: 350, useNativeDriver: true }),
        Animated.timing(tzScaleY, { toValue: 250, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.timing(bgOpacity, { toValue: 0, duration: 400, useNativeDriver: true })
    ]).start(() => setVisible(false))
  }, [])

  if (!visible) return null

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]} pointerEvents="none">
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        
        <View style={styles.textRow}>
          {['J', 'P', 'M'].map((letter, i) => (
            <Animated.Text 
              key={i}
              style={[
                styles.title, 
                { 
                  opacity: animsOpacity[i],
                  transform: [{ translateY: animsY[i] }] 
                }
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
        
        {/* Tanzania Flag Line */}
        <Animated.View style={[styles.tzLineContainer, { transform: [{ scaleX: tzScaleX }, { scaleY: tzScaleY }] }]}>
          <View style={[styles.tzSegment, { backgroundColor: '#1eb53a', flex: 2 }]} />
          <View style={[styles.tzSegment, { backgroundColor: '#fcd116', flex: 0.6 }]} />
          <View style={[styles.tzSegment, { backgroundColor: '#000000', flex: 2.5 }]} />
          <View style={[styles.tzSegment, { backgroundColor: '#fcd116', flex: 0.6 }]} />
          <View style={[styles.tzSegment, { backgroundColor: '#00a3e0', flex: 2 }]} />
        </Animated.View>

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
  textRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 4,
    color: colors.primary,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  tzLineContainer: {
    flexDirection: 'row',
    height: 6,
    width: 140,
    borderRadius: 3, // Makes it a sleek pill, and expands into a massive circle!
    overflow: 'hidden',
  },
  tzSegment: {
    height: '100%',
  }
})
