import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import type { PostDraft } from '../../domain/models'
import {
  buildCalendar,
  DEMO_TODAY,
  INITIAL_VISIBLE_MONTH,
  MONTH_NAMES,
  toDateKey,
  WEEK_DAYS,
} from './calendarUtils'
import { EditDraftDialog } from './EditDraftDialog'
import styles from './CalendarPage.module.css'

const STATUS_LABELS: Record<PostDraft['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  published: 'Publicado',
}

export function CalendarPage() {
  const navigate = useNavigate()
  const { drafts, updateDraft, removeDraft } = useApp()
  const [visibleMonth, setVisibleMonth] = useState(INITIAL_VISIBLE_MONTH)
  const [selectedDraft, setSelectedDraft] = useState<PostDraft | null>(null)
  const calendarCells = useMemo(
    () => buildCalendar(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  )
  const draftsByDate = useMemo(() => {
    const groupedDrafts = new Map<string, PostDraft[]>()

    drafts.forEach((draft) => {
      const dateDrafts = groupedDrafts.get(draft.date) ?? []
      groupedDrafts.set(draft.date, [...dateDrafts, draft])
    })

    return groupedDrafts
  }, [drafts])

  function changeMonth(offset: number) {
    setVisibleMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offset,
          1,
        ),
    )
  }

  async function handleSaveDraft(updatedDraft: PostDraft) {
    await updateDraft(updatedDraft)
    setSelectedDraft(null)
  }

  async function handleDeleteDraft(draftId: string) {
    await removeDraft(draftId)
    setSelectedDraft(null)
  }

  return (
    <AppShell>
      <header className={styles.pageHeader}>
        <div>
          <p>PLANEJAMENTO</p>
          <h1>Agenda de conteúdo</h1>
          <span>Organize, revise e acompanhe os rascunhos da sua marca.</span>
        </div>
        <Button type="button" onClick={() => navigate('/chat')}>
          <Plus size={17} /> Novo post
        </Button>
      </header>

      <section className={styles.calendarCard} aria-label="Calendário mensal">
        <div className={styles.calendarToolbar}>
          <div>
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Próximo mês"
            >
              <ChevronRight size={17} />
            </button>
            <h2>
              {MONTH_NAMES[visibleMonth.getMonth()]}{' '}
              <span>{visibleMonth.getFullYear()}</span>
            </h2>
          </div>
          <div className={styles.legend}>
            <span /> Rascunho{' '}
            <strong>
              {drafts.length} {drafts.length === 1 ? 'post' : 'posts'}
            </strong>
          </div>
        </div>

        <div className={styles.weekHeader}>
          {WEEK_DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className={styles.grid}>
          {calendarCells.map(({ date, inCurrentMonth }) => {
            const dateKey = toDateKey(date)
            const dateDrafts = draftsByDate.get(dateKey) ?? []
            const isToday = dateKey === DEMO_TODAY

            return (
              <div
                key={dateKey}
                className={`${styles.day} ${!inCurrentMonth ? styles.outside : ''}`}
              >
                <span className={isToday ? styles.today : ''}>
                  {date.getDate()}
                </span>
                <div className={styles.dayDrafts}>
                  {dateDrafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      className={styles.draft}
                      onClick={() => setSelectedDraft(draft)}
                    >
                      <span style={{ background: draft.color }} />
                      <div>
                        <strong>{draft.title}</strong>
                        <small>
                          {draft.platform} · {STATUS_LABELS[draft.status]}
                        </small>
                      </div>
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
          onSave={handleSaveDraft}
          onDelete={handleDeleteDraft}
        />
      ) : null}
    </AppShell>
  )
}
