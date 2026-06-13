import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type VibeType = {
  emoji: string;
  text: string;
  expires_at: string;
};

type VibeBadgeProps = {
  vibe?: VibeType | null;
  size?: number;
  style?: any;
};

export function VibeBadge({ vibe, size = 20, style }: VibeBadgeProps) {
  if (!vibe || !vibe.emoji || !vibe.expires_at) return null;

  // Check if vibe has expired
  if (new Date(vibe.expires_at) < new Date()) {
    return null;
  }

  const fontSize = size * 0.6;
  const padding = size * 0.15;

  return (
    <View style={[
      styles.badgeContainer, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
      },
      style
    ]}>
      <Text style={{ fontSize, lineHeight: fontSize + 2 }}>{vibe.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
});
