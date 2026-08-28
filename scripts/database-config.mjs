import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'

if (existsSync('.env')) {
  loadEnvFile('.env')
}

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `Variável ${name} ausente. Copie .env.example para .env e informe os dados do Supabase.`,
    )
  }

  return value
}

export function createDatabaseClient() {
  const url = requiredEnvironmentVariable('VITE_SUPABASE_URL')
  const publishableKey = requiredEnvironmentVariable(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  )

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
