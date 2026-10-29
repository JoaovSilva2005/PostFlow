import { useEffect, useState } from 'react'
import { CalendarDays, Coins, Image, RefreshCw, Sparkles } from 'lucide-react'
import { AppShell } from '../../components/AppShell/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AiUsageMonthlyReport } from '../../domain/aiUsage'
import { aiUsageApi } from './aiUsageApi'
import styles from './AiUsagePage.module.css'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function currency(value: number, currencyCode: 'BRL' | 'USD') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'USD' ? 4 : 2,
  }).format(value)
}

function number(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function averagePerPost(cost: number, posts: number) {
  return posts > 0 ? currency(cost / posts, 'BRL') : '—'
}

export function AiUsagePage() {
  const [month, setMonth] = useState(currentMonth)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [report, setReport] = useState<AiUsageMonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void aiUsageApi
      .monthly(month)
      .then((nextReport) => {
        if (active) setReport(nextReport)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar os custos de IA.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [month, refreshVersion])

  const totals = report?.totals
  const hasIncompleteCosts = Boolean(
    totals &&
      (totals.estimatedCalls > 0 ||
        totals.unpricedCalls > 0 ||
        totals.missingExchangeRateCalls > 0),
  )

  return (
    <AppShell>
      <PageHeader
        title="Custos de IA"
        description="Uso dos modelos e custo estimado por conta para acompanhar a margem da assinatura."
      >
        <div className={styles.monthPicker}>
          <CalendarDays size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="ai-cost-month">
            Mês dos custos
          </label>
          <input
            id="ai-cost-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (month === currentMonth()) setRefreshVersion((version) => version + 1)
              else setMonth(currentMonth())
            }}
            aria-label="Voltar para o mês atual"
            title="Mês atual"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </PageHeader>

      {error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshVersion((version) => version + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Resumo de custos de IA">
        <article className={styles.summaryCard}>
          <span className={styles.cardLabel}>Custo calculado em reais</span>
          <strong>
            {loading ? '…' : currency(totals?.totalCostBrl ?? 0, 'BRL')}
          </strong>
          <small>{monthLabel(month)}</small>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.cardLabel}>Custo em dólar</span>
          <strong>
            {loading ? '…' : currency(totals?.totalCostUsd ?? 0, 'USD')}
          </strong>
          <small>Valores convertidos usando a PTAX diária</small>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.cardLabel}>Média por rascunho</span>
          <strong>
            {loading
              ? '…'
              : averagePerPost(
                  totals?.totalCostBrl ?? 0,
                  totals?.postsGenerated ?? 0,
                )}
          </strong>
          <small>
            {number(totals?.postsGenerated ?? 0)} rascunhos gerados
          </small>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.cardLabel}>Chamadas aos modelos</span>
          <strong>{loading ? '…' : number(totals?.calls ?? 0)}</strong>
          <small>
            {number(totals?.textCalls ?? 0)} de texto ·{' '}
            {number(totals?.imageCalls ?? 0)} de imagem
          </small>
        </article>
      </section>

      <section className={styles.reportCard} aria-labelledby="ai-users-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="ai-users-title">Uso por usuário</h2>
            <p>Resumo de {monthLabel(month)}</p>
          </div>
          <span className={styles.callBadge}>
            <Coins size={15} aria-hidden="true" />
            {loading ? '…' : `${number(totals?.calls ?? 0)} chamadas`}
          </span>
        </div>

        {hasIncompleteCosts ? (
          <p className={styles.costNotice} role="note">
            <Image size={16} aria-hidden="true" />
            Custos de imagem sem tokens informados pela API são estimados por
            modelo, qualidade e tamanho. Valores sem preço cadastrado ou sem
            cotação PTAX aparecem sinalizados e podem deixar o total parcial.
          </p>
        ) : null}

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">Rascunhos</th>
                <th scope="col">Tokens de entrada</th>
                <th scope="col">Tokens de saída</th>
                <th scope="col">Chamadas</th>
                <th scope="col">Custo (USD)</th>
                <th scope="col">Custo (BRL)</th>
                <th scope="col">Média por rascunho</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    Carregando uso de IA…
                  </td>
                </tr>
              ) : report?.users.length ? (
                report.users.map((user) => (
                  <tr key={user.userId}>
                    <td>
                      <strong>{user.userDisplayName || 'Usuário'}</strong>
                      <span className={styles.secondaryText}>
                        {user.userEmail || user.userId}
                      </span>
                    </td>
                    <td>{number(user.postsGenerated)}</td>
                    <td>
                      {number(user.inputTokens)}
                      <span className={styles.secondaryText}>
                        {number(user.cachedInputTokens)} em cache
                      </span>
                    </td>
                    <td>
                      {number(user.outputTokens)}
                      {user.imageOutputTokens > 0 ? (
                        <span className={styles.secondaryText}>
                          <Sparkles size={12} aria-hidden="true" />{' '}
                          {number(user.imageOutputTokens)} tokens de imagem
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={styles.callBreakdown}>
                        <span>{number(user.textCalls)} texto</span>
                        <span>{number(user.imageCalls)} imagem</span>
                      </span>
                      {user.estimatedCalls > 0 || user.unpricedCalls > 0 ? (
                        <span className={styles.warningText}>
                          {user.estimatedCalls > 0
                            ? `${number(user.estimatedCalls)} estimadas`
                            : ''}
                          {user.unpricedCalls > 0
                            ? ` · ${number(user.unpricedCalls)} sem preço`
                            : ''}
                        </span>
                      ) : null}
                    </td>
                    <td>{currency(user.totalCostUsd, 'USD')}</td>
                    <td>
                      {user.missingExchangeRateCalls > 0 ? '~ ' : ''}
                      {currency(user.totalCostBrl, 'BRL')}
                      {user.missingExchangeRateCalls > 0 ? (
                        <span className={styles.secondaryText}>
                          {number(user.missingExchangeRateCalls)} sem cotação
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {averagePerPost(user.totalCostBrl, user.postsGenerated)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    Nenhuma geração registrada em {monthLabel(month)}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className={styles.footnote}>
        Esta tela é um relatório de custo variável por conta. Ela não cria
        lançamentos automáticos no Financeiro; registre a fatura mensal da
        OpenAI uma vez para evitar duplicidade.
      </p>
    </AppShell>
  )
}
