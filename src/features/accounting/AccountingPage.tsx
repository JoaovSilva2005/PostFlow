import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Printer, RefreshCw } from 'lucide-react'
import type { AccountingReport } from '../../../shared/domain/accounting'
import { AppShell } from '../../components/AppShell/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { localDate } from '../../domain/dates'
import { currency, formatDate } from '../fiscal/fiscalApi'
import { accountingApi } from './accountingApi'
import styles from './AccountingPage.module.css'

export function AccountingPage() {
  const [period, setPeriod] = useState(() => localDate().slice(0, 7))
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState<AccountingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setReport(null)
    setError('')
    accountingApi
      .report(period, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setReport(data)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar a DRE.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [period, revision])

  const resultLabel =
    report?.outcome === 'profit'
      ? 'Lucro'
      : report?.outcome === 'loss'
        ? 'Prejuízo'
        : 'Resultado'
  const lines = [
    ['Vendas e serviços', report?.totals.sales],
    [`(−) Impostos estimados · ${report?.taxRate ?? 6}%`, report?.totals.taxes],
    ['Receita após impostos', report?.totals.netRevenue],
    ['(−) Despesas operacionais', report?.totals.expenses],
    [resultLabel, report?.totals.result],
  ] as const

  return (
    <AppShell>
      <div className={styles.printRoot}>
        <PageHeader
          title="Contábil · DRE simples"
          description="Vendas − Impostos − Despesas = Lucro ou Prejuízo."
        >
          <div className={styles.links}>
            <Link to="/admin/finance">Abrir financeiro</Link>
            <Link to="/admin/fiscal">Abrir fiscal</Link>
          </div>
        </PageHeader>
        <p className={styles.note}>
          Competência simplificada pelo vencimento: inclui pagos e pendentes. O
          resultado difere do saldo de caixa. Imposto acadêmico de 6%, sem
          validade fiscal.
        </p>
        <div className={styles.toolbar}>
          <label>
            Período por vencimento
            <input
              aria-label="Período contábil"
              type="month"
              min="1000-01"
              max="9999-12"
              value={period}
              onChange={(event) => {
                if (event.target.value) setPeriod(event.target.value)
              }}
            />
          </label>
          <div className={styles.links}>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw size={15} /> Sincronizar
            </Button>
            <Button
              variant="ghost"
              disabled={!report || loading}
              onClick={() => window.print()}
            >
              <Printer size={15} /> Imprimir DRE
            </Button>
          </div>
        </div>
        {report?.storage === 'demo' && (
          <p className={styles.note} role="status">
            Dados demonstrativos: esta DRE usa exemplos locais porque o banco
            está indisponível.
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error} Os totais não estão disponíveis. Sincronize para tentar
            novamente.
          </p>
        )}
        {loading && <p role="status">Carregando DRE...</p>}
        <section
          className={styles.report}
          aria-label="Demonstrativo do resultado"
          aria-busy={loading}
        >
          <h2>Demonstração do resultado · {period}</h2>
          <dl>
            {lines.map(([label, value], index) => (
              <div
                key={index}
                className={index === 4 ? styles.result : undefined}
                data-outcome={index === 4 ? report?.outcome : undefined}
              >
                <dt>{label}</dt>
                <dd>
                  {loading ? '…' : value === undefined ? '—' : currency(value)}
                </dd>
              </div>
            ))}
          </dl>
          {report &&
            report.sales.length === 0 &&
            report.expenses.length === 0 && (
              <p className={styles.note}>
                Sem vendas ou despesas neste período.
              </p>
            )}
        </section>
        {report && (
          <>
            <p className={styles.note}>
              Atualizado a partir dos módulos de origem a cada consulta.
              Impostos são calculados por venda e deduzidos uma única vez.
              Registre despesas operacionais no Financeiro e vendas no Fiscal.
            </p>
            {report.excludedIncome.length > 0 && (
              <p className={styles.note}>
                Receitas manuais fora das vendas:{' '}
                {currency(report.totals.excludedIncome)}. Aportes e entradas sem
                classificação fiscal não compõem esta DRE.
              </p>
            )}
            <section
              className={styles.report}
              aria-label="Lançamentos que compõem a DRE"
            >
              <h2>Origem dos valores</h2>
              <div className={styles.tableWrapper}>
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Origem</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th>Valor</th>
                      <th>Imposto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{sale.description}</td>
                        <td>
                          {sale.sourceType === 'subscription_revenue'
                            ? 'Assinatura'
                            : 'Venda / serviço'}
                        </td>
                        <td>{formatDate(sale.dueDate)}</td>
                        <td>{sale.status === 'paid' ? 'Pago' : 'Pendente'}</td>
                        <td>{currency(sale.gross)}</td>
                        <td>{currency(sale.tax)}</td>
                      </tr>
                    ))}
                    {report.expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>{expense.description}</td>
                        <td>Despesa · {expense.category}</td>
                        <td>{formatDate(expense.dueDate)}</td>
                        <td>
                          {expense.status === 'paid' ? 'Pago' : 'Pendente'}
                        </td>
                        <td>{currency(expense.amount)}</td>
                        <td>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
