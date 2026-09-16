import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import type { PostDraft } from '../../domain/models'
import {
  buildCalendar,
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
  const location = useLocation()
  const { drafts, updateDraft, removeDraft } = useApp()
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const draftDate = location.state?.draftDate
    if (
      typeof draftDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(draftDate)
    ) {
      const date = new Date(`${draftDate}T12:00:00`)
      if (!Number.isNaN(date.getTime()))
        return new Date(date.getFullYear(), date.getMonth(), 1)
    }
    return INITIAL_VISIBLE_MONTH
  })
  const [selectedDraft, setSelectedDraft] = useState<PostDraft | null>(null)
  const [view, setView] = useState<'month' | 'list'>(() =>
    window.matchMedia?.('(max-width: 560px)').matches ? 'list' : 'month',
  )
  const monthDrafts = drafts
    .filter((draft) =>
      draft.date.startsWith(toDateKey(visibleMonth).slice(0, 7)),
    )
    .sort((left, right) => left.date.localeCompare(right.date))
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
      <PageHeader
        title="Agenda de conteúdo"
        description="Veja o que está planejado e ajuste cada post antes de publicar."
      >
        <Button type="button" onClick={() => navigate('/chat')}>
          <Plus size={17} /> Novo post
        </Button>
      </PageHeader>

      {location.state?.createdDraft ? (
        <p className={styles.savedNotice} role="status">
          Rascunho adicionado à agenda. Selecione o post para fazer novos
          ajustes.
        </p>
      ) : null}
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
              {monthDrafts.length}{' '}
              {monthDrafts.length === 1 ? 'post no mês' : 'posts no mês'}
            </strong>
          </div>
          <div
            className={styles.viewControls}
            aria-label="Visualização da agenda"
          >
            <button
              type="button"
              aria-pressed={view === 'month'}
              onClick={() => setView('month')}
            >
              Mês
            </button>
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              Lista
            </button>
          </div>
        </div>

        {view === 'month' ? (
          <>
            <div className={styles.weekHeader}>
              {WEEK_DAYS.map((day) => (
                <div key={day} aria-label={day} title={day}>
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>
            <div className={styles.grid}>
              {calendarCells.map(({ date, inCurrentMonth }) => {
                const dateKey = toDateKey(date)
                const dateDrafts = draftsByDate.get(dateKey) ?? []
                const isToday = dateKey === toDateKey(new Date())

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
          </>
        ) : (
          <div className={styles.agendaList}>
            {monthDrafts.length ? (
              monthDrafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className={styles.agendaEntry}
                  onClick={() => setSelectedDraft(draft)}
                >
                  <time dateTime={draft.date}>{draft.date.slice(-2)}</time>
                  <div>
                    <strong>{draft.title}</strong>
                    <small>
                      {draft.platform} · {STATUS_LABELS[draft.status]}
                    </small>
                  </div>
                  <span>Editar</span>
                </button>
              ))
            ) : (
              <div className={styles.empty}>
                <strong>Nenhum post planejado neste mês.</strong>
                <p>Crie um rascunho ou navegue para outro mês.</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/chat')}
                >
                  Criar um post
                </Button>
              </div>
            )}
          </div>
        )}
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
