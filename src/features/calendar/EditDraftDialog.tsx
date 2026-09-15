import { useState, type FormEvent, type MouseEvent } from 'react'
import { Edit3, Trash2, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import type { PostDraft } from '../../domain/models'
import styles from './CalendarPage.module.css'

const PLATFORM_OPTIONS = [
  { label: 'Instagram', value: 'Instagram' },
  { label: 'LinkedIn', value: 'LinkedIn' },
  { label: 'Facebook', value: 'Facebook' },
]

interface EditDraftDialogProps {
  draft: PostDraft
  onClose: () => void
  onSave: (draft: PostDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function EditDraftDialog({
  draft,
  onClose,
  onSave,
  onDelete,
}: EditDraftDialogProps) {
  const [form, setForm] = useState(draft)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  function updateFormField<Key extends keyof PostDraft>(
    field: Key,
    value: PostDraft[Key],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await onSave(form)
    } catch {
      setError('Não foi possível editar o post no Supabase.')
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setError('')
    setIsSaving(true)

    try {
      await onDelete(form.id)
    } catch {
      setError('Não foi possível excluir o post do Supabase.')
      setIsSaving(false)
    }
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
      >
        <header>
          <div className={styles.dialogIcon}>
            <Edit3 size={18} />
          </div>
          <div>
            <h2 id="edit-title">Editar rascunho</h2>
            <p>Faça os ajustes antes de publicar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Título"
            name="draft-title"
            value={form.title}
            onChange={(event) => updateFormField('title', event.target.value)}
          />

          <label className={styles.textareaField} htmlFor="caption">
            <span>Legenda</span>
            <textarea
              id="caption"
              rows={5}
              value={form.caption}
              onChange={(event) =>
                updateFormField('caption', event.target.value)
              }
            />
          </label>

          <div className={styles.dialogRow}>
            <TextField
              label="Data"
              name="draft-date"
              type="date"
              value={form.date}
              onChange={(event) => updateFormField('date', event.target.value)}
            />
            <SelectField
              label="Plataforma"
              name="draft-platform"
              value={form.platform}
              onChange={(event) =>
                updateFormField('platform', event.target.value)
              }
              options={PLATFORM_OPTIONS}
            />
          </div>

          {error ? (
            <p className={styles.dialogError} role="alert">
              {error}
            </p>
          ) : null}

          <footer>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 size={16} /> Excluir
            </Button>
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
