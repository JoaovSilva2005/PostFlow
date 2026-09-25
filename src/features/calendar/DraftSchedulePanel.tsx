import { CalendarClock } from 'lucide-react'
import { SelectField, TextField } from '../../components/ui/FormField'
import type { PostDraft } from '../../domain/models'
import { DEFAULT_POST_TIMEZONE } from '../../../shared/domain/contentTime'
import styles from './CalendarPage.module.css'

const STATUS_OPTIONS = [
  { label: 'Rascunho', value: 'draft' },
  { label: 'Agendado', value: 'scheduled' },
  { label: 'Publicado', value: 'published' },
]

interface DraftSchedulePanelProps {
  draft: PostDraft
  disabled: boolean
  onDateChange: (date: string) => Promise<void>
  onChange: <Key extends 'time' | 'status'>(
    field: Key,
    value: PostDraft[Key],
  ) => void
}

export function DraftSchedulePanel({
  draft,
  disabled,
  onDateChange,
  onChange,
}: DraftSchedulePanelProps) {
  return (
    <section className={styles.schedulePanel} aria-labelledby="schedule-title">
      <header>
        <CalendarClock size={17} aria-hidden="true" />
        <div>
          <h3 id="schedule-title">Agenda</h3>
          <p>Escolha o dia e o horário deste post.</p>
        </div>
      </header>

      <div className={styles.scheduleFields}>
        <TextField
          label="Data"
          name="draft-date"
          type="date"
          value={draft.date}
          disabled={disabled}
          onChange={(event) => void onDateChange(event.target.value)}
        />
        <TextField
          label="Horário"
          name="draft-time"
          type="time"
          value={draft.time ?? '12:00'}
          disabled={disabled}
          onChange={(event) => onChange('time', event.target.value)}
        />
        <SelectField
          label="Situação"
          name="draft-status"
          value={draft.status}
          disabled={disabled}
          onChange={(event) =>
            onChange('status', event.target.value as PostDraft['status'])
          }
          options={STATUS_OPTIONS}
        />
      </div>

      <p className={styles.scheduleNote}>
        Fuso horário de Brasília. A situação organiza sua agenda; a publicação
        nas redes ainda é manual.
      </p>

      <div className={styles.timezoneLabel}>
        <span>Fuso</span>
        <strong>{draft.timezone ?? DEFAULT_POST_TIMEZONE}</strong>
      </div>
    </section>
  )
}
