import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TrustedBadgeProps {
  isTrusted: boolean;
  size?: number;
  style?: any;
}

export function TrustedBadge({ isTrusted, size = 16, style }: TrustedBadgeProps) {
  if (!isTrusted) return null;

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={['#f59e0b', '#d97706']} // Glowing Gold
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          }
        ]}
      >
        <Ionicons name="checkmark-sharp" size={size * 0.75} color="#fff" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  }
});
