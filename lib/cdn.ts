import Constants from 'expo-constants';

// The base Supabase URL that we want to replace
const SUPABASE_URL = 'https://tgfuufsgkelgjjktbugg.supabase.co';
// The new Cloudflare CDN domain
const CDN_URL = 'https://cdn.jpmtz.online';

/**
 * Replaces the Supabase Storage URL with our Cloudflare CDN URL.
 * This ensures that images are served from the edge cache, 
 * avoiding Supabase egress quotas.
 */
export function getCdnUrl(originalUrl?: string | null): string {
  if (!originalUrl) return '';
  // Bypass Cloudflare CDN temporarily because it seems to be timing out/failing
  // which is causing images to show up as blank grey boxes.
  return originalUrl;
}

// Alias for backwards compatibility where the old getCDNUrl was used
export const getCDNUrl = getCdnUrl;
