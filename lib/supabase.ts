// lib/supabase.ts
// Shared Supabase client — same DB, same tables, same realtime as the web app
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = 'https://tgfuufsgkelgjjktbugg.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_BfvqG2R0d19EpcX8Xeu9nQ_93liMI2h'

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
