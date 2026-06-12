// MOCKED FOR EXPO GO TESTING
import { useState, useEffect } from 'react'

export function useInterstitial() {
  const showAd = async (onAdClosed?: () => void) => {
    if (onAdClosed) onAdClosed()
  }

  return { isAdLoaded: false, showAd }
}
