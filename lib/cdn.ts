import Constants from 'expo-constants';

// The base Supabase URL that we want to replace
const SUPABASE_URL = 'https://tgfuufsgkelgjjktbugg.supabase.co';
// The Cloudflare CDN domain (zero egress fees)
const CDN_URL = 'https://cdn.jpmtz.online';

/**
 * Replaces the Supabase Storage URL with our Cloudflare CDN URL.
 * This ensures images are served from Cloudflare's edge cache,
 * avoiding Supabase egress quotas entirely.
 */
export function getCdnUrl(originalUrl?: string | null): string {
  if (!originalUrl) return '';
  // Route all Supabase storage URLs through our Cloudflare CDN
  if (originalUrl.startsWith(SUPABASE_URL)) {
    return originalUrl.replace(SUPABASE_URL, CDN_URL);
  }
  return originalUrl;
}

// Alias for backwards compatibility
export const getCDNUrl = getCdnUrl;
