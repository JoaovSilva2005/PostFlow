const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:3001/api'

async function read(path) {
  const response = await fetch(`${apiUrl}${path}`)
  const body = await response.json()

  if (!response.ok) {
    throw new Error(body.error ?? `Falha HTTP ${response.status}`)
  }

  return body.data ?? body
}

const health = await read('/health')
const transactions = await read('/finance/transactions')
const summary = await read('/finance/summary')

console.log('\nPostFlow API: OK')
console.table(health)
console.log('Resumo financeiro calculado pela API')
console.table(summary)
console.log('Lançamentos retornados pelo Supabase')
console.table(transactions)
