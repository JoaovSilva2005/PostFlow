import { CalendarClock } from 'lucide-react'
import { TextField } from '../../components/ui/FormField'
import type { PostDraft } from '../../domain/models'
import { DEFAULT_POST_TIMEZONE } from '../../../shared/domain/contentTime'
import { postStatusLabel } from '../../../shared/domain/postPublishing'
import styles from './CalendarPage.module.css'

interface DraftSchedulePanelProps {
  draft: PostDraft
  disabled: boolean
  onDateChange: (date: string) => Promise<void>
  onChange: (field: 'time', value: string) => void
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
      </div>

      <p className={styles.scheduleNote}>
        Fuso horário de Brasília. Só posts aprovados são publicados, no horário
        escolhido.
      </p>

      <div className={styles.timezoneLabel}>
        <span>Situação</span>
        <strong>{postStatusLabel(draft.status, draft.publishMode)}</strong>
      </div>

      <div className={styles.timezoneLabel}>
        <span>Fuso</span>
        <strong>{draft.timezone ?? DEFAULT_POST_TIMEZONE}</strong>
      </div>
    </section>
  )
}
