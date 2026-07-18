import Constants from 'expo-constants';

// The current base Supabase URL that we want to proxy
const SUPABASE_URL = 'https://aarqgytazwnlwveeqwdd.supabase.co';

// The legacy Supabase URL that might still be saved in older database rows
const LEGACY_SUPABASE_URL = 'https://tgfuufsgkelgjjktbugg.supabase.co';

/**
 * Replaces the Supabase Storage URL with an aggressive global caching proxy (wsrv.nl).
 * This forces the proxy to fetch the image from Supabase exactly ONCE and cache it forever globally.
 * This will instantly drop your Supabase "Cached Egress" bandwidth to practically 0.
 */
export function getCdnUrl(originalUrl?: string | null): string {
  if (!originalUrl) return '';
  
  // Route current DB and legacy DB images through wsrv.nl
  if (originalUrl.startsWith(SUPABASE_URL) || originalUrl.startsWith(LEGACY_SUPABASE_URL)) {
    const encodedUrl = encodeURIComponent(originalUrl);
    // q=80 compresses the image slightly to save memory, output=webp ensures modern format
    // maxage=1y completely forces the CDN and Browser to cache it for 1 full year without hitting Supabase again!
    return `https://wsrv.nl/?url=${encodedUrl}&q=80&output=webp&maxage=1y`;
  }
  
  return originalUrl;
}

// Alias for backwards compatibility
export const getCDNUrl = getCdnUrl;
