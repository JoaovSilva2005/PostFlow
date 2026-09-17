import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Printer, RefreshCw } from 'lucide-react'
import { AppShell } from '../../components/AppShell/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import type { FiscalReport, FiscalSale } from '../../domain/fiscal'
import { localDate } from '../../domain/dates'
import { fiscalApi, currency, formatDate } from './fiscalApi'
import { PlanEconomics } from './PlanEconomics'
import { SaleForm } from './SaleForm'
import styles from './FiscalPage.module.css'

export function FiscalPage() {
  const [period, setPeriod] = useState(() => localDate().slice(0, 7))
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState<FiscalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [receipt, setReceipt] = useState<FiscalSale | null>(null)
  const receiptRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setReport(null)
    setReceipt(null)
    setError('')
    fiscalApi
      .report(period, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setReport(data)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar os dados fiscais.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [period, revision])

  useEffect(() => {
    if (receipt) receiptRef.current?.focus()
  }, [receipt])

  return (
    <AppShell>
      <PageHeader
        title="Fiscal e faturamento"
        description="Cada receita do financeiro, com seu imposto e comprovante."
      >
        <Link to="/finance">Abrir financeiro</Link>
      </PageHeader>
      <p className={styles.warning}>
        <strong>Simulação acadêmica.</strong> Alíquota fixa de 6% para
        demonstração. Não emite nota fiscal nem calcula tributos legais.
      </p>
      <div className={styles.toolbar}>
        <label>
          Período por vencimento
          <input
            aria-label="Período fiscal"
            type="month"
            value={period}
            onChange={(e) => {
              if (e.target.value) setPeriod(e.target.value)
            }}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} /> Sincronizar
        </Button>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error} Os totais não estão disponíveis. Atualize para tentar
          novamente.
        </p>
      )}
      <section
        className={styles.summary}
        aria-label="Resumo fiscal"
        aria-busy={loading}
      >
        {[
          ['Vendas lançadas', report?.totals.gross],
          ['Recebido', report?.totals.received],
          ['A receber', report?.totals.pending],
          ['Imposto estimado · 6%', report?.totals.tax],
          ['Após imposto', report?.totals.net],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
              {loading
                ? '…'
                : typeof value === 'number'
                  ? currency(value)
                  : '—'}
            </strong>
          </div>
        ))}
      </section>
      <p className={styles.note}>
        Inclui receitas pagas e pendentes. O imposto é calculado por venda e já
        está incluído no preço. Não representa recolhimento, lucro ou saldo de
        caixa.
      </p>
      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2>Vendas e serviços</h2>
            <span>
              {report
                ? `${report.sales.length} ${report.sales.length === 1 ? 'registro' : 'registros'}`
                : '—'}
            </span>
          </div>
          {loading ? (
            <p role="status">Carregando receitas...</p>
          ) : report && !report.sales.length ? (
            <p className={styles.empty}>
              Nenhuma receita neste período. Registre um serviço ou escolha
              outro mês.
            </p>
          ) : (
            report?.sales.map((sale) => (
              <article className={styles.sale} key={sale.id}>
                <div>
                  <h3>{sale.description}</h3>
                  <p>
                    {formatDate(sale.dueDate)}{' '}
                    <span className={styles[sale.status]}>
                      {sale.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Bruto</dt>
                    <dd>{currency(sale.gross)}</dd>
                  </div>
                  <div>
                    <dt>Imposto</dt>
                    <dd>{currency(sale.tax)}</dd>
                  </div>
                  <div>
                    <dt>Após imposto</dt>
                    <dd>{currency(sale.net)}</dd>
                  </div>
                </dl>
                <button
                  className={styles.receiptButton}
                  type="button"
                  onClick={() => setReceipt(sale)}
                >
                  Ver comprovante
                  <span className="sr-only"> de {sale.description}</span>
                </button>
              </article>
            ))
          )}
          {report && (
            <p className={styles.note}>
              Recebido: {currency(report.totals.received)}. Pendente:{' '}
              {currency(report.totals.pending)}. Edite ou altere o pagamento no
              financeiro.
            </p>
          )}
        </section>
        <SaleForm
          onCreated={(sale) => {
            setPeriod(sale.dueDate.slice(0, 7))
            setRevision((value) => value + 1)
            setNotice(
              'Venda registrada no financeiro. O cálculo fiscal usa a mesma receita.',
            )
          }}
        />
      </div>
      {receipt && (
        <section
          ref={receiptRef}
          tabIndex={-1}
          className={styles.receipt}
          aria-labelledby="receipt-title"
        >
          <header>
            <div>
              <p>PostFlow</p>
              <h2 id="receipt-title">Comprovante de venda de serviço</h2>
            </div>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir / salvar PDF
            </Button>
          </header>
          <p>
            <strong>Documento acadêmico sem validade fiscal.</strong>
          </p>
          <dl>
            <div>
              <dt>Referência</dt>
              <dd>{receipt.receiptReference}</dd>
            </div>
            <div>
              <dt>Serviço e cliente</dt>
              <dd>{receipt.description}</dd>
            </div>
            <div>
              <dt>Vencimento</dt>
              <dd>{formatDate(receipt.dueDate)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {receipt.status === 'paid'
                  ? 'Pago'
                  : 'Pendente — não comprova pagamento'}
              </dd>
            </div>
            <div>
              <dt>Valor bruto do serviço</dt>
              <dd>{currency(receipt.gross)}</dd>
            </div>
            <div>
              <dt>Imposto didático incluído (6%)</dt>
              <dd>{currency(receipt.tax)}</dd>
            </div>
            <div>
              <dt>Valor após imposto</dt>
              <dd>{currency(receipt.net)}</dd>
            </div>
          </dl>
          <p>
            Visualização do lançamento atualizado em{' '}
            {formatDate(receipt.updatedAt)}. O imposto é informativo, não uma
            cobrança adicional. Alterações no financeiro mudam esta visualização
            após atualizar.
          </p>
          <button
            type="button"
            className={styles.receiptButton}
            onClick={() => setReceipt(null)}
          >
            Fechar comprovante
          </button>
        </section>
      )}
      <div className={styles.internalSection}>
        <span>Simulação interna</span>
        <PlanEconomics />
      </div>
    </AppShell>
  )
}
