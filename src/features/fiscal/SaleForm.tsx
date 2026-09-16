import { useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import {
  calculateTax,
  ESSENTIAL_PLAN,
  type FiscalSale,
} from '../../domain/fiscal'
import { localDate } from '../../domain/dates'
import { currency, fiscalApi } from './fiscalApi'
import styles from './FiscalPage.module.css'

export function SaleForm({
  onCreated,
}: {
  onCreated: (sale: FiscalSale) => void
}) {
  const [description, setDescription] = useState(ESSENTIAL_PLAN.name as string)
  const [amount, setAmount] = useState(String(ESSENTIAL_PLAN.price))
  const [date, setDate] = useState(localDate)
  const [status, setStatus] = useState<'pending' | 'paid'>('pending')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const preview =
    amount && Number.isFinite(Number(amount)) && Number(amount) > 0
      ? calculateTax(Number(amount))
      : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const sale = await fiscalApi.create({
        description: description.trim(),
        amount: Number(amount),
        dueDate: date,
        status,
      })
      onCreated(sale)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível registrar a venda. Verifique o financeiro antes de tentar novamente.',
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return (
    <section className={styles.panel}>
      <h2>Registrar venda de serviço</h2>
      <p className={styles.note}>
        Cria uma única receita no financeiro. Não realiza cobrança.
      </p>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label="Serviço e cliente"
          value={description}
          required
          minLength={3}
          maxLength={240}
          disabled={saving}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label="Valor bruto (R$)"
          type="number"
          min="0.01"
          max="999999999.99"
          step="0.01"
          required
          value={amount}
          disabled={saving}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label="Vencimento da venda"
          type="date"
          value={date}
          required
          disabled={saving}
          onChange={(e) => setDate(e.target.value)}
        />
        <SelectField
          label="Situação da venda"
          value={status}
          disabled={saving}
          options={[
            { value: 'pending', label: 'Pendente' },
            { value: 'paid', label: 'Pago' },
          ]}
          onChange={(e) => setStatus(e.target.value as 'paid' | 'pending')}
        />
        <dl className={styles.costs}>
          <div>
            <dt>Imposto fixo de 6%</dt>
            <dd>{preview ? currency(preview.tax) : '—'}</dd>
          </div>
          <div>
            <dt>Após imposto</dt>
            <dd>{preview ? currency(preview.net) : '—'}</dd>
          </div>
        </dl>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Registrando...' : 'Registrar no financeiro'}
        </Button>
      </form>
    </section>
  )
}
