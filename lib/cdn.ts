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
  if (!SUPABASE_URL) return originalUrl;

  if (originalUrl.startsWith(SUPABASE_URL)) {
    // Bypass CDN for videos because Cloudflare often strips byte-range headers
    // which are absolutely required by expo-av to play mp4 files on mobile
    if (originalUrl.includes('/videos/')) {
      return originalUrl;
    }
    return originalUrl.replace(SUPABASE_URL, CDN_URL);
  }
  
  return originalUrl;
}

// Alias for backwards compatibility where the old getCDNUrl was used
export const getCDNUrl = getCdnUrl;
