import { createClient } from '@supabase/supabase-js'
import { environment } from './environment.js'

export function createSupabaseServerClient() {
  return createClient(
    environment.supabaseUrl(),
    environment.supabasePublishableKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )
}
