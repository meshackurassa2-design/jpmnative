// lib/supabase.ts
// Shared Supabase client — same DB, same tables, same realtime as the web app
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = 'https://aarqgytazwnlwveeqwdd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcnFneXRhendubHd2ZWVxd2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTgwODYsImV4cCI6MjA5ODA3NDA4Nn0._87OTPDWKmDcmTzXrrwAQVBtiKh8wz75zVBjdbCPe9w'

let client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (client) return client
  client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  return client
}
