import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { DateField } from '../../components/ui/DateField'
import { useApp } from '../../app/AppContext'
import { SelectField, TextField } from '../../components/ui/FormField'
import type {
  FinancialSummary,
  FinancialTransaction,
  FinancialTransactionInput,
} from '../../domain/finance'
import { financialApi } from './financialApi'
import styles from './FinancePage.module.css'

const emptySummary: FinancialSummary = {
  paidIncome: 0,
  paidExpenses: 0,
  balance: 0,
  pendingIncome: 0,
  pendingExpenses: 0,
  pendingCount: 0,
}

function today() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function emptyForm(): FinancialTransactionInput {
  return {
    type: 'income',
    category: '',
    description: '',
    amount: 0,
    dueDate: today(),
    status: 'pending',
  }
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  )
}

export function FinancePage() {
  const { platformRole } = useApp()
  const canWrite =
    platformRole === 'platform_owner' || platformRole === 'finance_admin'
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [hasLoadedSummary, setHasLoadedSummary] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [storageMode, setStorageMode] = useState<'supabase' | 'demo'>(
    'supabase',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const filteredTransactions = transactions.filter((transaction) => {
    const text =
      `${transaction.description} ${transaction.category}`.toLocaleLowerCase(
        'pt-BR',
      )
    return (
      text.includes(search.trim().toLocaleLowerCase('pt-BR')) &&
      (statusFilter === 'all' || transaction.status === statusFilter)
    )
  })
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'all'

  async function loadFinance() {
    setLoading(true)
    try {
      setError(null)
      const [loadedTransactions, loadedSummary] = await Promise.all([
        financialApi.list(),
        financialApi.summary(),
      ])
      setTransactions(loadedTransactions)
      setSummary(loadedSummary)
      setHasLoadedSummary(true)
      const health = await financialApi.health()
      setStorageMode(health.storage === 'demo' ? 'demo' : 'supabase')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o financeiro.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFinance()
  }, [])

  function updateForm<K extends keyof FinancialTransactionInput>(
    field: K,
    value: FinancialTransactionInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingId) {
        await financialApi.update(editingId, form)
        setNotice('Lançamento atualizado.')
      } else {
        await financialApi.create(form)
        setNotice('Lançamento adicionado ao financeiro.')
      }
      resetForm()
      await loadFinance()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar o lançamento.',
      )
    } finally {
      setSaving(false)
    }
  }

  function startEditing(transaction: FinancialTransaction) {
    setEditingId(transaction.id)
    setForm({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      amount: transaction.amount,
      dueDate: transaction.dueDate,
      status: transaction.status,
    })
    document
      .getElementById('transaction-form')
      ?.scrollIntoView({ block: 'start' })
    document
      .querySelector<HTMLInputElement>('#transaction-form input')
      ?.focus({ preventScroll: true })
  }

  async function toggleStatus(transaction: FinancialTransaction) {
    setError(null)
    setUpdatingId(transaction.id)
    try {
      const nextStatus = transaction.status === 'paid' ? 'pending' : 'paid'
      await financialApi.updateStatus(transaction.id, nextStatus)
      setNotice(
        nextStatus === 'paid'
          ? 'Lançamento marcado como pago.'
          : 'Lançamento marcado como pendente.',
      )
      await loadFinance()
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Não foi possível alterar o status.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeTransaction(transaction: FinancialTransaction) {
    const confirmed = window.confirm(
      `Excluir o lançamento “${transaction.description}”?`,
    )
    if (!confirmed) return

    setError(null)
    try {
      await financialApi.delete(transaction.id)
      setNotice('Lançamento excluído.')
      if (editingId === transaction.id) resetForm()
      await loadFinance()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível excluir o lançamento.',
      )
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Controle financeiro"
        description="Acompanhe receitas, despesas e o que ainda está pendente."
      >
        <div className={styles.headerActions}>
          <Link className={styles.moduleLink} to="/fiscal">
            Abrir fiscal
          </Link>
          <div
            className={`${styles.apiBadge} ${error ? styles.apiError : ''} ${storageMode === 'demo' ? styles.apiDemo : ''}`}
          >
            <span />{' '}
            {loading
              ? 'Sincronizando...'
              : error
                ? 'Requer atenção'
                : storageMode === 'demo'
                  ? 'Dados demonstrativos'
                  : 'Dados sincronizados'}
          </div>
        </div>
      </PageHeader>

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadFinance()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      <section
        className={styles.summaryGrid}
        aria-label="Resumo financeiro"
        aria-busy={loading}
      >
        <article className={styles.summaryCard}>
          <div className={`${styles.icon} ${styles.income}`}>
            <ArrowUpRight size={20} />
          </div>
          <span>Receitas pagas</span>
          <strong>
            {loading
              ? '…'
              : hasLoadedSummary
                ? currency(summary.paidIncome)
                : '—'}
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.icon} ${styles.expense}`}>
            <ArrowDownRight size={20} />
          </div>
          <span>Despesas pagas</span>
          <strong>
            {loading
              ? '…'
              : hasLoadedSummary
                ? currency(summary.paidExpenses)
                : '—'}
          </strong>
        </article>
        <article className={`${styles.summaryCard} ${styles.balanceCard}`}>
          <div className={styles.icon}>
            <WalletCards size={20} />
          </div>
          <span>Saldo atual</span>
          <strong>
            {loading ? '…' : hasLoadedSummary ? currency(summary.balance) : '—'}
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.icon} ${styles.pending}`}>
            <Clock3 size={20} />
          </div>
          <span>Pendências</span>
          <strong>
            {loading ? '…' : hasLoadedSummary ? summary.pendingCount : '—'}
          </strong>
          {hasLoadedSummary && !loading ? (
            <small>
              A receber {currency(summary.pendingIncome)} · A pagar{' '}
              {currency(summary.pendingExpenses)}
            </small>
          ) : (
            <small>Aguardando dados</small>
          )}
        </article>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.tableCard}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>Entradas e saídas</h2>
            </div>
            <small aria-live="polite">
              {loading
                ? 'Carregando lançamentos…'
                : error && !hasLoadedSummary
                  ? 'Dados indisponíveis'
                  : hasActiveFilters
                    ? `${filteredTransactions.length} de ${transactions.length} lançamentos`
                    : `${transactions.length} ${transactions.length === 1 ? 'lançamento' : 'lançamentos'}`}
            </small>
          </div>

          <div className={styles.filters}>
            <label className={styles.filterField}>
              <span>Buscar lançamentos</span>
              <input
                type="search"
                placeholder="Descrição ou categoria"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className={styles.filterField}>
              <span>Status</span>
              <select
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="paid">Pagos</option>
                <option value="pending">Pendentes</option>
              </select>
            </label>
            {hasActiveFilters ? (
              <button
                className={styles.clearFilters}
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                }}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className={styles.empty} role="status">
              Carregando lançamentos...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className={styles.empty}>
              {error
                ? 'Os dados não puderam ser atualizados.'
                : transactions.length === 0
                  ? 'Nenhum lançamento cadastrado. Comece registrando uma receita ou despesa.'
                  : 'Nenhum lançamento corresponde aos filtros.'}
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <caption className="sr-only">Lançamentos financeiros</caption>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <strong>{transaction.description}</strong>
                        <span>{transaction.category}</span>
                      </td>
                      <td data-label="Vencimento">
                        {formatDate(transaction.dueDate)}
                      </td>
                      <td data-label="Status">
                        <button
                          type="button"
                          className={`${styles.status} ${styles[transaction.status]}`}
                          onClick={() => void toggleStatus(transaction)}
                          disabled={!canWrite || updatingId === transaction.id}
                          aria-label={`Marcar ${transaction.description} como ${transaction.status === 'paid' ? 'pendente' : 'pago'}`}
                        >
                          {transaction.status === 'paid' ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <Clock3 size={13} />
                          )}
                          {updatingId === transaction.id
                            ? 'Atualizando'
                            : transaction.status === 'paid'
                              ? 'Pago'
                              : 'Pendente'}
                        </button>
                      </td>
                      <td
                        data-label="Valor"
                        className={
                          transaction.type === 'income'
                            ? styles.positive
                            : styles.negative
                        }
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {currency(transaction.amount)}
                      </td>
                      <td>
                        {canWrite ? (
                          <div className={styles.actions}>
                            <button
                              type="button"
                              onClick={() => startEditing(transaction)}
                              aria-label={`Editar ${transaction.description}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void removeTransaction(transaction)
                              }
                              aria-label={`Excluir ${transaction.description}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="sr-only">Somente leitura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {canWrite ? (
          <section id="transaction-form" className={styles.formCard}>
            <div className={styles.sectionTitle}>
              <div>
                <h2>
                  {editingId
                    ? 'Atualizar registro'
                    : 'Cadastrar entrada ou saída'}
                </h2>
              </div>
              {editingId ? (
                <button
                  className={styles.iconButton}
                  type="button"
                  onClick={resetForm}
                  aria-label="Cancelar edição"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.twoColumns}>
                <SelectField
                  label="Tipo"
                  value={form.type}
                  options={[
                    { label: 'Receita', value: 'income' },
                    { label: 'Despesa', value: 'expense' },
                  ]}
                  onChange={(event) =>
                    updateForm(
                      'type',
                      event.target.value as FinancialTransactionInput['type'],
                    )
                  }
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  options={[
                    { label: 'Pendente', value: 'pending' },
                    { label: 'Pago', value: 'paid' },
                  ]}
                  onChange={(event) =>
                    updateForm(
                      'status',
                      event.target.value as FinancialTransactionInput['status'],
                    )
                  }
                />
              </div>
              <TextField
                label="Descrição"
                value={form.description}
                placeholder="Ex.: Assinatura do plano mensal"
                minLength={3}
                required
                onChange={(event) =>
                  updateForm('description', event.target.value)
                }
              />
              <TextField
                label="Categoria"
                value={form.category}
                placeholder="Ex.: Assinaturas, Marketing"
                minLength={2}
                required
                onChange={(event) => updateForm('category', event.target.value)}
              />
              <div className={styles.twoColumns}>
                <TextField
                  label="Valor (R$)"
                  type="number"
                  value={form.amount || ''}
                  min="0.01"
                  step="0.01"
                  required
                  onChange={(event) =>
                    updateForm('amount', Number(event.target.value))
                  }
                />
                <DateField
                  label="Vencimento"
                  value={form.dueDate}
                  required
                  onChange={(event) =>
                    updateForm('dueDate', event.target.value)
                  }
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={saving}
                fullWidth
              >
                <Plus size={17} />
                {saving
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar alteração'
                    : 'Adicionar lançamento'}
              </Button>
            </form>
          </section>
        ) : (
          <section className={styles.formCard} aria-label="Permissão de acesso">
            <h2>Acesso somente leitura</h2>
            <p>
              O perfil de suporte pode consultar lançamentos, mas não pode
              criar, alterar ou excluir dados financeiros.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  )
}
