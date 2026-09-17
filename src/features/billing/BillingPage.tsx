import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Gauge,
  Image,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import type {
  BillingInvoice,
  BillingOverview,
  BillingPlan,
} from '../../domain/billing'
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
  cancelled: 'Cancelada',
  pending: 'Pendente',
  paid: 'Paga',
  void: 'Cancelada',
} as const

type SubscriptionFlow =
  | 'idle'
  | 'selection'
  | 'confirmation'
  | 'processing'
  | 'invoice_pending'
  | 'payment_processing'
  | 'success'
  | 'error'

function idempotencyKey() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `billing-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  return (
    <div className={styles.usageItem}>
      <div>
        <span>{label}</span>
        <strong>
          {used} de {limit}
        </strong>
      </div>
      <progress
        value={used}
        max={Math.max(limit, 1)}
        aria-label={`${label}: ${percentage.toFixed(0)}% utilizado`}
      />
    </div>
  )
}

export function BillingPage() {
  const { currentWorkspace } = useApp()
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [subscriptionFlow, setSubscriptionFlow] =
    useState<SubscriptionFlow>('idle')
  const [flowError, setFlowError] = useState('')
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const subscriptionKey = useRef<string | null>(null)
  const paymentKeys = useRef(new Map<string, string>())
  const [pendingSubscriptionInvoice, setPendingSubscriptionInvoice] =
    useState<BillingInvoice | null>(null)
  const professionalPlan =
    plans.find((plan) => plan.code === 'professional') ?? plans[0] ?? null
  const canManageBilling =
    currentWorkspace?.role === 'owner' || currentWorkspace?.role === 'admin'

  useEffect(() => {
    if (!currentWorkspace) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      billingApi.plans(currentWorkspace.id, controller.signal),
      billingApi.overview(currentWorkspace.id, controller.signal),
      billingApi.invoices(currentWorkspace.id, controller.signal),
    ])
      .then(([nextPlans, nextOverview, nextInvoices]) => {
        if (!controller.signal.aborted) {
          setPlans(nextPlans)
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

  function startPlanSelection() {
    if (!professionalPlan || !canManageBilling) return
    setFlowError('')
    setSubscriptionFlow('selection')
  }

  function confirmPlanSelection() {
    setFlowError('')
    setSubscriptionFlow('confirmation')
  }

  async function subscribe() {
    if (!currentWorkspace || !professionalPlan || !canManageBilling) return
    const key = subscriptionKey.current ?? idempotencyKey()
    subscriptionKey.current = key
    setSubscriptionFlow('processing')
    setFlowError('')
    try {
      const invoice = await billingApi.subscribe(
        currentWorkspace.id,
        professionalPlan.code,
        key,
      )
      setInvoices((current) => [
        invoice,
        ...current.filter((currentInvoice) => currentInvoice.id !== invoice.id),
      ])
      setPendingSubscriptionInvoice(invoice)
      setSubscriptionFlow('invoice_pending')
      subscriptionKey.current = null
      setRevision((value) => value + 1)
    } catch (cause) {
      setSubscriptionFlow('error')
      setFlowError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível confirmar a assinatura demonstrativa.',
      )
    }
  }

  async function payInvoice(invoice: BillingInvoice) {
    if (!currentWorkspace || !canManageBilling) return
    const isSubscriptionPayment = pendingSubscriptionInvoice?.id === invoice.id
    const key = paymentKeys.current.get(invoice.id) ?? idempotencyKey()
    paymentKeys.current.set(invoice.id, key)
    setPayingInvoiceId(invoice.id)
    setPaymentError('')
    if (isSubscriptionPayment) {
      setSubscriptionFlow('payment_processing')
      setFlowError('')
    }
    try {
      const paidInvoice = await billingApi.payInvoice(
        currentWorkspace.id,
        invoice.id,
        key,
      )
      setInvoices((current) =>
        current.map((currentInvoice) =>
          currentInvoice.id === paidInvoice.id ? paidInvoice : currentInvoice,
        ),
      )
      setSelectedInvoice(paidInvoice.receipt ? paidInvoice : null)
      paymentKeys.current.delete(invoice.id)
      if (isSubscriptionPayment) {
        setPendingSubscriptionInvoice(null)
        setSubscriptionFlow('success')
      }
      setRevision((value) => value + 1)
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Não foi possível registrar o pagamento demonstrativo.'
      if (isSubscriptionPayment) {
        setSubscriptionFlow('invoice_pending')
        setFlowError(message)
      } else {
        setPaymentError(message)
      }
    } finally {
      setPayingInvoiceId(null)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Assinatura e cobrança"
        description="Acompanhe seu plano, consumo e faturas deste workspace."
      >
        <Button
          variant="ghost"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} /> Atualizar
        </Button>
      </PageHeader>

      {overview?.demoMode ? (
        <p className={styles.demoNotice}>
          <strong>Ambiente acadêmico demonstrativo.</strong> Nenhuma cobrança
          real será feita e nenhum dado financeiro é solicitado nesta tela.
        </p>
      ) : null}
      {loading ? (
        <p className={styles.loading} role="status">
          <LoaderCircle size={16} aria-hidden="true" /> Carregando assinatura...
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {overview ? (
        <>
          {!overview.plan && professionalPlan ? (
            <section
              className={styles.offer}
              aria-labelledby="plan-offer-title"
            >
              <div className={styles.offerCopy}>
                <span className={styles.offerEyebrow}>Plano disponível</span>
                <h2 id="plan-offer-title">PostFlow {professionalPlan.name}</h2>
                <p>
                  Uma assinatura mensal para manter a produção de conteúdo do
                  seu workspace em movimento.
                </p>
                <ul className={styles.limitList} aria-label="Limites do plano">
                  <li>
                    <Sparkles size={16} aria-hidden="true" />
                    <strong>{professionalPlan.limits.text} textos</strong> por
                    mês
                  </li>
                  <li>
                    <Image size={16} aria-hidden="true" />
                    <strong>{professionalPlan.limits.image} imagens</strong> por
                    mês
                  </li>
                </ul>
              </div>
              <div className={styles.priceBlock}>
                <span>A partir de</span>
                <strong>{currency(professionalPlan.price)}</strong>
                <small>por mês</small>
                {canManageBilling ? (
                  <Button onClick={startPlanSelection}>
                    Escolher {professionalPlan.name}
                  </Button>
                ) : (
                  <small>Somente owner ou admin pode contratar o plano.</small>
                )}
              </div>
            </section>
          ) : !overview.plan ? (
            <section className={styles.panel} aria-label="Planos indisponíveis">
              <p className={styles.empty}>
                Nenhum plano está disponível para contratação agora.
              </p>
            </section>
          ) : null}

          {subscriptionFlow !== 'idle' && professionalPlan ? (
            <section
              className={styles.checkout}
              aria-labelledby="checkout-title"
              aria-live="polite"
            >
              <div className={styles.sectionHeader}>
                <div>
                  <span>Resumo da assinatura</span>
                  <h2 id="checkout-title">
                    {subscriptionFlow === 'success'
                      ? 'Pagamento demonstrativo confirmado'
                      : subscriptionFlow === 'invoice_pending' ||
                          subscriptionFlow === 'payment_processing'
                        ? 'Fatura demonstrativa emitida'
                        : `PostFlow ${professionalPlan.name}`}
                  </h2>
                </div>
                <CircleDollarSign size={22} aria-hidden="true" />
              </div>

              {subscriptionFlow === 'success' ? (
                <div className={styles.successState}>
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <p>
                    Sua fatura foi marcada como paga no ambiente acadêmico. O
                    comprovante demonstrativo fica disponível abaixo.
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => setSubscriptionFlow('idle')}
                  >
                    Fechar resumo
                  </Button>
                </div>
              ) : (
                <>
                  <dl className={styles.checkoutDetails}>
                    <div>
                      <dt>Plano</dt>
                      <dd>{professionalPlan.name}</dd>
                    </div>
                    <div>
                      <dt>Franquia mensal</dt>
                      <dd>
                        {professionalPlan.limits.text} textos e{' '}
                        {professionalPlan.limits.image} imagens
                      </dd>
                    </div>
                    <div>
                      <dt>Total mensal</dt>
                      <dd>{currency(professionalPlan.price)}</dd>
                    </div>
                  </dl>
                  <p className={styles.checkoutNotice}>
                    Simulação acadêmica: ao confirmar, o PostFlow apenas
                    registra uma assinatura e uma fatura de demonstração. Não há
                    cobrança real.
                  </p>
                  {subscriptionFlow === 'error' || flowError ? (
                    <p className={styles.inlineError} role="alert">
                      {flowError}
                    </p>
                  ) : null}
                  <div className={styles.checkoutActions}>
                    <Button
                      variant="ghost"
                      onClick={() => setSubscriptionFlow('idle')}
                      disabled={
                        subscriptionFlow === 'processing' ||
                        subscriptionFlow === 'payment_processing'
                      }
                    >
                      Cancelar
                    </Button>
                    {subscriptionFlow === 'selection' ? (
                      <Button onClick={confirmPlanSelection}>Ver resumo</Button>
                    ) : subscriptionFlow === 'invoice_pending' ||
                      subscriptionFlow === 'payment_processing' ? (
                      <Button
                        onClick={() =>
                          pendingSubscriptionInvoice
                            ? void payInvoice(pendingSubscriptionInvoice)
                            : undefined
                        }
                        disabled={subscriptionFlow === 'payment_processing'}
                      >
                        {subscriptionFlow === 'payment_processing' ? (
                          <>
                            <LoaderCircle size={16} aria-hidden="true" />
                            Processando pagamento...
                          </>
                        ) : (
                          'Confirmar pagamento demonstrativo'
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void subscribe()}
                        disabled={subscriptionFlow === 'processing'}
                      >
                        {subscriptionFlow === 'processing' ? (
                          <>
                            <LoaderCircle size={16} aria-hidden="true" />
                            Processando...
                          </>
                        ) : (
                          'Confirmar assinatura demonstrativa'
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </section>
          ) : null}

          <section className={styles.summary} aria-label="Resumo da assinatura">
            <article>
              <BadgeCheck size={18} />
              <span>Plano atual</span>
              <strong>{overview.plan?.name ?? 'Nenhum plano ativo'}</strong>
              <small>
                {overview.plan
                  ? `${currency(overview.plan.price)}/mês`
                  : 'Escolha um plano para começar'}
              </small>
            </article>
            <article>
              <CalendarClock size={18} />
              <span>Situação</span>
              <strong>
                {overview.subscription
                  ? statusLabel[overview.subscription.status]
                  : 'Sem assinatura'}
              </strong>
              <small>
                {overview.subscription
                  ? `${date(overview.subscription.currentPeriodStart)} a ${date(overview.subscription.currentPeriodEnd)}`
                  : 'Nenhum período ativo'}
              </small>
            </article>
            <article>
              <Gauge size={18} />
              <span>Período de consumo</span>
              <strong>{overview.usage.period}</strong>
              <small>Atualização mensal</small>
            </article>
          </section>

          {overview.plan ? (
            <section className={styles.panel} aria-labelledby="usage-title">
              <div className={styles.sectionHeader}>
                <div>
                  <span>Uso do plano</span>
                  <h2 id="usage-title">Consumo atual</h2>
                </div>
              </div>
              <div className={styles.usageGrid}>
                <UsageBar
                  label="Textos gerados"
                  used={overview.usage.textUsed}
                  limit={overview.plan.limits.text}
                />
                <UsageBar
                  label="Imagens geradas"
                  used={overview.usage.imageUsed}
                  limit={overview.plan.limits.image}
                />
              </div>
            </section>
          ) : null}

          <section className={styles.panel} aria-labelledby="invoices-title">
            <div className={styles.sectionHeader}>
              <div>
                <span>Cobranças do workspace</span>
                <h2 id="invoices-title">Faturas</h2>
              </div>
              <strong>{invoices.length}</strong>
            </div>
            {invoices.length === 0 ? (
              <p className={styles.empty}>
                Nenhuma fatura emitida para este workspace.
              </p>
            ) : (
              <div className={styles.invoiceList}>
                {invoices.map((invoice) => (
                  <article key={invoice.id} className={styles.invoice}>
                    <div>
                      <FileText size={18} />
                      <div>
                        <strong>{invoice.number}</strong>
                        <span>Vencimento em {date(invoice.dueDate)}</span>
                      </div>
                    </div>
                    <span
                      className={`${styles.status} ${styles[invoice.status]}`}
                    >
                      {statusLabel[invoice.status]}
                    </span>
                    <strong>{currency(invoice.amount)}</strong>
                    <div className={styles.invoiceActions}>
                      {invoice.status === 'pending' && canManageBilling ? (
                        <button
                          type="button"
                          onClick={() => void payInvoice(invoice)}
                          disabled={payingInvoiceId === invoice.id}
                        >
                          {payingInvoiceId === invoice.id
                            ? 'Processando...'
                            : 'Pagar em demonstração'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(invoice)}
                        disabled={!invoice.receipt}
                      >
                        Ver comprovante
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {paymentError ? (
              <p className={styles.inlineError} role="alert">
                {paymentError}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      {selectedInvoice?.receipt ? (
        <section
          className={styles.receipt}
          aria-labelledby="billing-receipt-title"
        >
          <div className={styles.sectionHeader}>
            <div>
              <span>PostFlow</span>
              <h2 id="billing-receipt-title">Comprovante acadêmico</h2>
            </div>
            <button type="button" onClick={() => setSelectedInvoice(null)}>
              Fechar
            </button>
          </div>
          <p>
            <strong>
              Documento demonstrativo acadêmico sem validade fiscal. Não é
              NFS-e.
            </strong>
          </p>
          <dl>
            <div>
              <dt>Referência</dt>
              <dd>{selectedInvoice.receipt.reference}</dd>
            </div>
            <div>
              <dt>Valor bruto</dt>
              <dd>{currency(selectedInvoice.amount)}</dd>
            </div>
            <div>
              <dt>Alíquota didática</dt>
              <dd>
                {selectedInvoice.receipt.taxRate <= 1
                  ? selectedInvoice.receipt.taxRate * 100
                  : selectedInvoice.receipt.taxRate}
                %
              </dd>
            </div>
            <div>
              <dt>Imposto estimado</dt>
              <dd>{currency(selectedInvoice.receipt.taxAmount)}</dd>
            </div>
            <div>
              <dt>Após imposto</dt>
              <dd>{currency(selectedInvoice.receipt.netAmount)}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </AppShell>
  )
}
