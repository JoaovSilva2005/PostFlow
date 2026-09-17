import { createClient } from '@supabase/supabase-js'
import { environment } from './environment.js'

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const

/**
 * Client privilegiado para repositórios de dados do backend.
 *
 * Este módulo nunca é importado pelo frontend. A chave é lida somente do
 * ambiente do servidor e não deve ser colocada em nenhuma variável VITE_.
 */
export function createSupabaseAdminDataClient() {
  return createClient(
    environment.supabaseUrl(),
    environment.supabaseServiceRoleKey(),
    clientOptions,
  )
}

/**
 * Client com chave pública para operações do Supabase Auth.
 *
 * O acesso a tabelas continua passando pelos repositórios server-side; este
 * cliente existe apenas para validar e criar sessões do usuário.
 */
export function createSupabaseAuthClient() {
  return createClient(
    environment.supabaseUrl(),
    environment.supabasePublishableKey(),
    clientOptions,
  )
}
