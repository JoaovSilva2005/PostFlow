const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:3001/api'

async function read(path, cookie = '') {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  })
  const body = await response.json()

  if (!response.ok) {
    throw new Error(body.error ?? `Falha HTTP ${response.status}`)
  }

  return body.data ?? body
}

const health = await read('/health')
const email = process.env.POSTFLOW_TEST_EMAIL
const password = process.env.POSTFLOW_TEST_PASSWORD

console.log('\nPostFlow API: OK')
console.table(health)

if (!email || !password) {
  const protectedResponse = await fetch(`${apiUrl}/admin/finance/summary`)

  if (protectedResponse.status !== 401) {
    throw new Error('A rota financeira deveria rejeitar acesso anônimo.')
  }

  console.log('Proteção de rotas: acesso anônimo rejeitado com HTTP 401.')
  console.log(
    'Defina POSTFLOW_TEST_EMAIL e POSTFLOW_TEST_PASSWORD para validar o fluxo autenticado.',
  )
} else {
  const loginResponse = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!loginResponse.ok) {
    throw new Error(`Falha no login de teste: HTTP ${loginResponse.status}`)
  }

  const cookie = loginResponse.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  const transactions = await read('/admin/finance/transactions', cookie)
  const summary = await read('/admin/finance/summary', cookie)

  console.log('Login e rotas protegidas: OK')
  console.log('Resumo financeiro calculado pela API')
  console.table(summary)
  console.log(
    health.storage === 'supabase'
      ? 'Lançamentos retornados pelo Supabase'
      : 'Lançamentos retornados pelo modo de demonstração',
  )
  console.table(transactions)
}
