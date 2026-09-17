import '@testing-library/jest-dom/vitest'

// A API server-side exige uma service role. Testes que exercitam somente a
// montagem/healthcheck usam este valor inofensivo e não fazem chamada remota.
const testRuntime = globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> }
}
if (testRuntime.process) {
  testRuntime.process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})
