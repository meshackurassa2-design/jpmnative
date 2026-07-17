import React from 'react';
import { View } from 'react-native';

export function NativeAdCard({ fallback }: { fallback?: React.ReactNode }) {
  return fallback ? <>{fallback}</> : <View style={{ display: 'none' }} />;
}
