import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Edit3, Plus, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import type { PostDraft } from '../../domain/models'
import styles from './CalendarPage.module.css'

const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface CalendarCell {
  date: Date
  inCurrentMonth: boolean
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildCalendar(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1)
  const start = new Date(year, month, 1 - firstDay.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, inCurrentMonth: date.getMonth() === month }
  })
}

export function CalendarPage() {
  const navigate = useNavigate()
  const { drafts, updateDraft, removeDraft } = useApp()
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 7, 1))
  const [selectedDraft, setSelectedDraft] = useState<PostDraft | null>(null)
  const cells = useMemo(
    () => buildCalendar(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  )

  function changeMonth(offset: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1))
  }

  return (
    <AppShell>
      <header className={styles.pageHeader}>
        <div>
          <p>PLANEJAMENTO</p>
          <h1>Agenda de conteúdo</h1>
          <span>Organize, revise e acompanhe os rascunhos da sua marca.</span>
        </div>
        <Button type="button" onClick={() => navigate('/chat')}><Plus size={17} /> Novo post</Button>
      </header>

      <section className={styles.calendarCard} aria-label="Calendário mensal">
        <div className={styles.calendarToolbar}>
          <div>
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={17} /></button>
            <h2>{monthNames[visibleMonth.getMonth()]} <span>{visibleMonth.getFullYear()}</span></h2>
          </div>
          <div className={styles.legend}><span /> Rascunho <strong>{drafts.length} {drafts.length === 1 ? 'post' : 'posts'}</strong></div>
        </div>

        <div className={styles.weekHeader}>
          {weekDays.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className={styles.grid}>
          {cells.map(({ date, inCurrentMonth }) => {
            const dateKey = toDateKey(date)
            const dateDrafts = drafts.filter((draft) => draft.date === dateKey)
            const isToday = dateKey === '2026-08-10'
            return (
              <div key={dateKey} className={`${styles.day} ${!inCurrentMonth ? styles.outside : ''}`}>
                <span className={isToday ? styles.today : ''}>{date.getDate()}</span>
                <div className={styles.dayDrafts}>
                  {dateDrafts.map((draft) => (
                    <button key={draft.id} type="button" className={styles.draft} onClick={() => setSelectedDraft(draft)}>
                      <span style={{ background: draft.color }} />
                      <div><strong>{draft.title}</strong><small>{draft.platform} · Rascunho</small></div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {selectedDraft ? (
        <EditDraftDialog
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onSave={(draft) => {
            updateDraft(draft)
            setSelectedDraft(null)
          }}
          onDelete={(id) => {
            removeDraft(id)
            setSelectedDraft(null)
          }}
        />
      ) : null}
    </AppShell>
  )
}

interface DialogProps {
  draft: PostDraft
  onClose: () => void
  onSave: (draft: PostDraft) => void
  onDelete: (id: string) => void
}

function EditDraftDialog({ draft, onClose, onSave, onDelete }: DialogProps) {
  const [form, setForm] = useState(draft)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSave(form)
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <header>
          <div className={styles.dialogIcon}><Edit3 size={18} /></div>
          <div><h2 id="edit-title">Editar rascunho</h2><p>Faça os ajustes antes de publicar.</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        <form onSubmit={handleSubmit}>
          <TextField label="Título" name="draft-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <label className={styles.textareaField} htmlFor="caption">
            <span>Legenda</span>
            <textarea id="caption" rows={5} value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} />
          </label>
          <div className={styles.dialogRow}>
            <TextField label="Data" name="draft-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            <SelectField label="Plataforma" name="draft-platform" value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} options={[
              { label: 'Instagram', value: 'Instagram' },
              { label: 'LinkedIn', value: 'LinkedIn' },
              { label: 'Facebook', value: 'Facebook' },
            ]} />
          </div>
          <footer>
            <Button type="button" variant="danger" onClick={() => onDelete(form.id)}><Trash2 size={16} /> Excluir</Button>
            <div><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar alterações</Button></div>
          </footer>
        </form>
      </section>
    </div>
  )
}
