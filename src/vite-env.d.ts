/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_API_URL?: string
  readonly VITE_AI_MODE?: 'api' | 'demo'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
