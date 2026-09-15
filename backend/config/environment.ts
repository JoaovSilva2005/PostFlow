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

const isProduction = process.env.NODE_ENV === 'production'
const appUrl = process.env.APP_URL?.trim() || 'http://localhost:5173'
const deploymentUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : null

export const environment = {
  apiPort: Number(process.env.API_PORT ?? 3001),
  appUrl,
  isProduction,
  passwordResetUrl: `${appUrl}/login`,
  isAllowedOrigin: (origin: string) =>
    origin === appUrl ||
    origin === deploymentUrl ||
    (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)),
  supabaseUrl: () =>
    process.env.SUPABASE_URL?.trim() ||
    requiredEnvironmentVariable('VITE_SUPABASE_URL'),
  supabasePublishableKey: () =>
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    requiredEnvironmentVariable('VITE_SUPABASE_PUBLISHABLE_KEY'),
}
