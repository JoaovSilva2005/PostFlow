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
const configuredAppUrl = process.env.APP_URL?.trim()
const appUrl = configuredAppUrl || 'http://localhost:5173'

function normalizedOrigin(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.origin
      : null
  } catch {
    return null
  }
}

export function createOriginPolicy(options: {
  isProduction: boolean
  appUrl?: string
  allowedOrigins?: string[]
}) {
  const trustedOrigins = new Set(
    [options.appUrl, ...(options.allowedOrigins ?? [])]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => normalizedOrigin(value.trim()))
      .filter((value): value is string => Boolean(value)),
  )
  if (options.isProduction) {
    for (const origin of trustedOrigins) {
      if (!origin.startsWith('https://')) trustedOrigins.delete(origin)
    }
  }

  return (origin: string) => {
    if (trustedOrigins.has(normalizedOrigin(origin) ?? '')) return true
    return (
      !options.isProduction &&
      /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)
    )
  }
}

const explicitlyAllowedOrigins = (process.env.APP_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const environment = {
  apiPort: Number(process.env.API_PORT ?? 3001),
  appUrl,
  isProduction,
  allowDemoFallback:
    !isProduction && process.env.POSTFLOW_ALLOW_DEMO_FALLBACK === 'true',
  passwordResetUrl: `${appUrl}/login`,
  isAllowedOrigin: createOriginPolicy({
    isProduction,
    appUrl: configuredAppUrl ?? (isProduction ? undefined : appUrl),
    allowedOrigins: explicitlyAllowedOrigins,
  }),
  supabaseUrl: () =>
    process.env.SUPABASE_URL?.trim() ||
    requiredEnvironmentVariable('VITE_SUPABASE_URL'),
  supabasePublishableKey: () =>
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    requiredEnvironmentVariable('VITE_SUPABASE_PUBLISHABLE_KEY'),
  /** Chave privilegiada usada exclusivamente por repositórios no backend. */
  supabaseServiceRoleKey: () => {
    const serviceRoleKey =
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (serviceRoleKey?.startsWith('sb_publishable_')) {
      throw new Error(
        'A chave administrativa do Supabase não pode ser uma chave publicável.',
      )
    }

    return (
      serviceRoleKey ?? requiredEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY')
    )
  },
  openAiApiKey: () => requiredEnvironmentVariable('OPENAI_API_KEY'),
  openAiTextModel: process.env.OPENAI_TEXT_MODEL?.trim() || 'gpt-6-luna',
  openAiImageModel:
    process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2.5-flare',
  openAiQualityImageModel:
    process.env.OPENAI_IMAGE_QUALITY_MODEL?.trim() ||
    'gpt-image-2.5-sunburst',
  openAiImageQuality: process.env.OPENAI_IMAGE_QUALITY?.trim() || 'medium',
  openAiImageSize: process.env.OPENAI_IMAGE_SIZE?.trim() || '1024x1024',
}
