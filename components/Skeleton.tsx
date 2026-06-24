import React, { useEffect, useRef } from 'react'
import { Animated, ViewStyle, StyleSheet, StyleProp, View } from 'react-native'
import { useTheme } from '../lib/theme'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ width, height, borderRadius = 6, style }: SkeletonProps) {
  const { colors, isDark } = useTheme()
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [anim])

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isDark ? [0.3, 0.8] : [0.1, 0.4],
  })

  const backgroundColor = isDark ? '#2a2a2a' : '#d4d4d8'
  const baseColor = isDark ? '#111111' : '#e4e4e7'

  return (
    <View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor,
            opacity,
          },
        ]}
      />
    </View>
  )
}
