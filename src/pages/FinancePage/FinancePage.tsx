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
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import type {
  FinancialSummary,
  FinancialTransaction,
  FinancialTransactionInput,
} from '../../domain/finance'
import { financialApi } from '../../services/financialApi'
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
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadFinance() {
    try {
      setError(null)
      const [loadedTransactions, loadedSummary] = await Promise.all([
        financialApi.list(),
        financialApi.summary(),
      ])
      setTransactions(loadedTransactions)
      setSummary(loadedSummary)
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
      } else {
        await financialApi.create(form)
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
  }

  async function toggleStatus(transaction: FinancialTransaction) {
    setError(null)
    try {
      await financialApi.updateStatus(
        transaction.id,
        transaction.status === 'paid' ? 'pending' : 'paid',
      )
      await loadFinance()
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Não foi possível alterar o status.',
      )
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
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ÉPICO 3 · FINANCEIRO</span>
          <h1>Controle financeiro</h1>
          <p>Acompanhe entradas, saídas, saldo atual e valores pendentes.</p>
        </div>
        <div className={`${styles.apiBadge} ${error ? styles.apiError : ''}`}>
          <span /> {error ? 'API sem conexão' : 'API + Supabase'}
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.summaryGrid} aria-label="Resumo financeiro">
        <article className={styles.summaryCard}>
          <div className={`${styles.icon} ${styles.income}`}>
            <ArrowUpRight size={20} />
          </div>
          <span>Receitas pagas</span>
          <strong>{currency(summary.paidIncome)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.icon} ${styles.expense}`}>
            <ArrowDownRight size={20} />
          </div>
          <span>Despesas pagas</span>
          <strong>{currency(summary.paidExpenses)}</strong>
        </article>
        <article className={`${styles.summaryCard} ${styles.balanceCard}`}>
          <div className={styles.icon}>
            <WalletCards size={20} />
          </div>
          <span>Saldo atual</span>
          <strong>{currency(summary.balance)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.icon} ${styles.pending}`}>
            <Clock3 size={20} />
          </div>
          <span>Pendências</span>
          <strong>{summary.pendingCount}</strong>
          <small>
            +{currency(summary.pendingIncome)} / -
            {currency(summary.pendingExpenses)}
          </small>
        </article>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.formCard}>
          <div className={styles.sectionTitle}>
            <div>
              <span>{editingId ? 'EDITANDO' : 'NOVO LANÇAMENTO'}</span>
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
                  { label: 'Entrada (receita)', value: 'income' },
                  { label: 'Saída (despesa)', value: 'expense' },
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
              <TextField
                label="Vencimento"
                type="date"
                value={form.dueDate}
                required
                onChange={(event) => updateForm('dueDate', event.target.value)}
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

        <section className={styles.tableCard}>
          <div className={styles.sectionTitle}>
            <div>
              <span>HISTÓRICO</span>
              <h2>Entradas e saídas</h2>
            </div>
            <small>{transactions.length} lançamentos</small>
          </div>

          {loading ? (
            <div className={styles.empty}>Carregando dados da API...</div>
          ) : transactions.length === 0 ? (
            <div className={styles.empty}>Nenhum lançamento cadastrado.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
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
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <strong>{transaction.description}</strong>
                        <span>{transaction.category}</span>
                      </td>
                      <td>{formatDate(transaction.dueDate)}</td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.status} ${styles[transaction.status]}`}
                          onClick={() => void toggleStatus(transaction)}
                          aria-label={`Alterar status de ${transaction.description}`}
                        >
                          {transaction.status === 'paid' ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <Clock3 size={13} />
                          )}
                          {transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                        </button>
                      </td>
                      <td
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
                            onClick={() => void removeTransaction(transaction)}
                            aria-label={`Excluir ${transaction.description}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
