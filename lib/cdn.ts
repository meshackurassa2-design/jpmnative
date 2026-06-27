import Constants from 'expo-constants';

// The base Supabase URL that we want to replace
const SUPABASE_URL = 'https://tgfuufsgkelgjjktbugg.supabase.co';

/**
 * Replaces the Supabase Storage URL with an aggressive global caching proxy (wsrv.nl).
 * This forces the proxy to fetch the image from Supabase exactly ONCE and cache it forever globally.
 * This will instantly drop your Supabase "Cached Egress" bandwidth to practically 0.
 */
export function getCdnUrl(originalUrl?: string | null): string {
  if (!originalUrl) return '';
  
  // If it's a Supabase storage URL, route it through the global proxy
  if (originalUrl.startsWith(SUPABASE_URL)) {
    // We encode the Supabase URL and pass it to wsrv.nl
    // We also ask it to compress it slightly (q=80) to save app memory!
    const encodedUrl = encodeURIComponent(originalUrl);
    return `https://wsrv.nl/?url=${encodedUrl}&q=80&output=webp`;
  }
  
  return originalUrl;
}

// Alias for backwards compatibility
export const getCDNUrl = getCdnUrl;
