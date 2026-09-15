import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (existsSync('.env')) {
  loadEnvFile('.env')
}

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `Variável ${name} ausente. Copie .env.example para .env e configure o projeto.`,
    )
  }

  return value
}

export const environment = {
  apiPort: Number(process.env.API_PORT ?? 3001),
  supabaseUrl: () =>
    process.env.SUPABASE_URL?.trim() ||
    requiredEnvironmentVariable('VITE_SUPABASE_URL'),
  supabasePublishableKey: () =>
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    requiredEnvironmentVariable('VITE_SUPABASE_PUBLISHABLE_KEY'),
}
