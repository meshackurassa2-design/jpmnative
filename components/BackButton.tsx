// components/BackButton.tsx
// Reusable, professional back button used across all screens
import { useTheme } from '../lib/theme';
import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'

interface Props {
  color?: string
  onPress?: () => void
  style?: object
}

export function BackButton({ color, onPress, style }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={() => {
        Haptics.selectionAsync();
        if (onPress) onPress();
        else router.back();
      }}
      activeOpacity={0.7}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
    >
      <Ionicons name="arrow-back" size={24} color={color || colors.text} />
    </TouchableOpacity>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  btn: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
})
