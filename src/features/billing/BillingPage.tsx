import { useEffect, useState } from 'react'
import { BadgeCheck, CalendarClock, FileText, Gauge, RefreshCw } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import type { BillingInvoice, BillingOverview } from '../../domain/billing'
import { ApiError } from '../../services/apiClient'
import { billingApi } from './billingApi'
import styles from './BillingPage.module.css'

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  )

const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00Z`),
  )

const statusLabel = {
  trialing: 'Período de teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  pending: 'Pendente',
  paid: 'Paga',
  void: 'Cancelada',
} as const

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  return (
    <div className={styles.usageItem}>
      <div><span>{label}</span><strong>{used} de {limit}</strong></div>
      <progress value={used} max={Math.max(limit, 1)} aria-label={`${label}: ${percentage.toFixed(0)}% utilizado`} />
    </div>
  )
}

export function BillingPage() {
  const { currentWorkspace } = useApp()
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!currentWorkspace) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      billingApi.overview(currentWorkspace.id, controller.signal),
      billingApi.invoices(currentWorkspace.id, controller.signal),
    ])
      .then(([nextOverview, nextInvoices]) => {
        if (!controller.signal.aborted) {
          setOverview(nextOverview)
          setInvoices(nextInvoices)
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 403) {
          setError('Você não possui permissão para consultar esta cobrança.')
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar sua assinatura.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [currentWorkspace, revision])

  return (
    <AppShell>
      <PageHeader
        title="Assinatura e cobrança"
        description="Acompanhe seu plano, consumo e faturas deste workspace."
      >
        <Button variant="ghost" onClick={() => setRevision((value) => value + 1)} disabled={loading}>
          <RefreshCw size={15} /> Atualizar
        </Button>
      </PageHeader>

      {overview?.demoMode ? (
        <p className={styles.demoNotice}>
          <strong>Ambiente demonstrativo.</strong> Pagamentos, limites e comprovantes ainda não representam uma cobrança real.
        </p>
      ) : null}
      {loading ? <p role="status">Carregando assinatura...</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {overview ? (
        <>
          <section className={styles.summary} aria-label="Resumo da assinatura">
            <article><BadgeCheck size={18} /><span>Plano atual</span><strong>{overview.plan.name}</strong><small>{currency(overview.plan.price)}/mês</small></article>
            <article><CalendarClock size={18} /><span>Situação</span><strong>{overview.subscription ? statusLabel[overview.subscription.status] : 'Sem assinatura'}</strong><small>{overview.subscription ? `${date(overview.subscription.currentPeriodStart)} a ${date(overview.subscription.currentPeriodEnd)}` : 'Nenhum período ativo'}</small></article>
            <article><Gauge size={18} /><span>Período de consumo</span><strong>{overview.usage.period}</strong><small>Atualização mensal</small></article>
          </section>

          <section className={styles.panel} aria-labelledby="usage-title">
            <div className={styles.sectionHeader}><div><span>Uso do plano</span><h2 id="usage-title">Consumo atual</h2></div></div>
            <div className={styles.usageGrid}>
              <UsageBar label="Textos gerados" used={overview.usage.textUsed} limit={overview.plan.limits.text} />
              <UsageBar label="Imagens geradas" used={overview.usage.imageUsed} limit={overview.plan.limits.image} />
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="invoices-title">
            <div className={styles.sectionHeader}><div><span>Cobranças do workspace</span><h2 id="invoices-title">Faturas</h2></div><strong>{invoices.length}</strong></div>
            {invoices.length === 0 ? <p className={styles.empty}>Nenhuma fatura emitida para este workspace.</p> : (
              <div className={styles.invoiceList}>
                {invoices.map((invoice) => (
                  <article key={invoice.id} className={styles.invoice}>
                    <div><FileText size={18} /><div><strong>{invoice.number}</strong><span>Vencimento em {date(invoice.dueDate)}</span></div></div>
                    <span className={`${styles.status} ${styles[invoice.status]}`}>{statusLabel[invoice.status]}</span>
                    <strong>{currency(invoice.amount)}</strong>
                    <button type="button" onClick={() => setSelectedInvoice(invoice)} disabled={!invoice.receipt}>Ver comprovante</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {selectedInvoice?.receipt ? (
        <section className={styles.receipt} aria-labelledby="billing-receipt-title">
          <div className={styles.sectionHeader}><div><span>PostFlow</span><h2 id="billing-receipt-title">Comprovante acadêmico</h2></div><button type="button" onClick={() => setSelectedInvoice(null)}>Fechar</button></div>
          <p><strong>Documento demonstrativo sem validade fiscal. Não é NFS-e.</strong></p>
          <dl>
            <div><dt>Referência</dt><dd>{selectedInvoice.receipt.reference}</dd></div>
            <div><dt>Valor bruto</dt><dd>{currency(selectedInvoice.amount)}</dd></div>
            <div><dt>Alíquota didática</dt><dd>{selectedInvoice.receipt.taxRate}%</dd></div>
            <div><dt>Imposto estimado</dt><dd>{currency(selectedInvoice.receipt.taxAmount)}</dd></div>
            <div><dt>Após imposto</dt><dd>{currency(selectedInvoice.receipt.netAmount)}</dd></div>
          </dl>
        </section>
      ) : null}
    </AppShell>
  )
}
