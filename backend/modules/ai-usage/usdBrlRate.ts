import { environment } from '../../config/environment.js'

type BcbQuotation = {
  cotacaoVenda?: number
  dataHoraCotacao?: string
}

type BcbResponse = { value?: BcbQuotation[] }

const PTAX_API =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)'
const PTAX_TIMEOUT_MS = 2_500

let cachedLocalDate: string | null = null
let cachedRate: Promise<{ rate: number | null; source: string | null }> | null =
  null

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.month}-${values.day}-${values.year}`
}

function configuredFallback() {
  const rate = environment.aiCostUsdBrlFallbackRate
  return Number.isFinite(rate) && rate > 0
    ? { rate, source: 'configured_fallback' }
    : { rate: null, source: null }
}

async function loadRate() {
  const today = new Date()
  const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const url = new URL(PTAX_API)
  url.searchParams.set('@dataInicial', `'${localDate(start)}'`)
  url.searchParams.set('@dataFinalCotacao', `'${localDate(today)}'`)
  url.searchParams.set('$top', '100')
  url.searchParams.set('$format', 'json')

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PTAX_TIMEOUT_MS),
    })
    if (!response.ok) return configuredFallback()

    const body = (await response.json()) as BcbResponse
    const latest = (body.value ?? [])
      .filter(
        (quotation) =>
          typeof quotation.cotacaoVenda === 'number' &&
          Number.isFinite(quotation.cotacaoVenda) &&
          quotation.cotacaoVenda > 0,
      )
      .sort((left, right) =>
        (right.dataHoraCotacao ?? '').localeCompare(
          left.dataHoraCotacao ?? '',
        ),
      )[0]
    if (latest?.cotacaoVenda) {
      return { rate: latest.cotacaoVenda, source: 'bcb_ptax_sell' }
    }
  } catch {
    // The API cost is retained in USD when PTAX is unavailable.
  }

  return configuredFallback()
}

export function getUsdBrlRate() {
  const today = localDate(new Date())
  if (!cachedRate || cachedLocalDate !== today) {
    cachedLocalDate = today
    cachedRate = loadRate()
  }
  return cachedRate
}

