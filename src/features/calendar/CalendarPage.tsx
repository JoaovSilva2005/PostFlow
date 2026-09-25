import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import type { PostDraft } from '../../domain/models'
import {
  generationError,
  generationService,
} from '../content/generationService'
import {
  DEFAULT_POST_TIMEZONE,
  dateTimePartsInZone,
} from '../../../shared/domain/contentTime'
import {
  buildCalendar,
  INITIAL_VISIBLE_MONTH,
  MONTH_NAMES,
  toDateKey,
  WEEK_DAYS,
} from './calendarUtils'
import { EditDraftDialog } from './EditDraftDialog'
import {
  GenerateContentSidebar,
  type GenerateContentValues,
} from './GenerateContentSidebar'
import styles from './CalendarPage.module.css'

const STATUS_LABELS: Record<PostDraft['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  published: 'Publicado',
}

export function CalendarPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    brand,
    currentWorkspace,
    availableWorkspaces,
    drafts,
    updateDraft,
    removeDraft,
    addDraftsForWorkspace,
    selectWorkspace,
  } = useApp()
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
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [generatorPrompt, setGeneratorPrompt] = useState('')
  const [generatorError, setGeneratorError] = useState('')
  const [generationPhase, setGenerationPhase] = useState<
    'idle' | 'generating' | 'saving'
  >('idle')
  const isGenerating = generationPhase !== 'idle'
  const [generationNotice, setGenerationNotice] = useState('')
  const generationController = useRef<AbortController | null>(null)
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

  useEffect(() => {
    return () => generationController.current?.abort()
  }, [])

  async function handleGenerate(values: GenerateContentValues) {
    if (isGenerating) return
    const controller = new AbortController()
    generationController.current = controller
    setGenerationPhase('generating')
    setGeneratorError('')
    setGenerationNotice('')

    try {
      if (!generationService.generateBatch) {
        throw new Error('Geração em lote indisponível.')
      }
      const selectedWorkspace = availableWorkspaces.find(
        ({ id }) => id === values.brandId,
      )
      const selectedBrand = selectedWorkspace?.brand ?? brand
      const targetWorkspaceId = selectedWorkspace?.id ?? currentWorkspace?.id
      const generated = await generationService.generateBatch(
        {
          workspaceId: targetWorkspaceId,
          prompt: values.prompt,
          dates: values.dates,
          time: values.time,
          timezone: values.timezone,
          format: values.format,
          persona: values.persona,
          platforms: values.platforms,
          brand: selectedBrand,
        },
        controller.signal,
      )
      controller.signal.throwIfAborted()
      setGenerationPhase('saving')
      if (!targetWorkspaceId) throw new Error('Selecione uma marca para gerar.')
      const savedDrafts = await addDraftsForWorkspace(
        targetWorkspaceId,
        generated,
      )
      if (targetWorkspaceId !== currentWorkspace?.id) {
        await selectWorkspace(targetWorkspaceId)
      }
      const generatedDate = new Date(
        `${savedDrafts[0]?.date ?? generated[0]?.date}T12:00:00`,
      )
      if (!Number.isNaN(generatedDate.getTime())) {
        setVisibleMonth(
          new Date(generatedDate.getFullYear(), generatedDate.getMonth(), 1),
        )
      }
      setGeneratorPrompt('')
      setGenerationNotice(
        `${savedDrafts.length} ${savedDrafts.length === 1 ? 'rascunho salvo' : 'rascunhos salvos'} na agenda para revisão. A publicação é manual.`,
      )
      setIsGeneratorOpen(false)
    } catch (error) {
      if (controller.signal.aborted) {
        setGeneratorError('Geração cancelada. Sua agenda não foi alterada.')
      } else {
        setGeneratorError(generationError(error))
      }
    } finally {
      if (generationController.current === controller) {
        generationController.current = null
      }
      setGenerationPhase('idle')
    }
  }

  function cancelGeneration() {
    generationController.current?.abort()
  }

  const closeGenerator = useCallback(() => setIsGeneratorOpen(false), [])
  const editComposerIdea = useCallback(() => {
    setIsGeneratorOpen(false)
    window.setTimeout(
      () => document.getElementById('calendar-content-prompt')?.focus(),
      0,
    )
  }, [])

  return (
    <AppShell>
      <PageHeader
        title="Agenda de conteúdo"
        description="Encontre seus posts por data e revise cada rascunho."
      >
        <Button type="button" onClick={() => navigate('/chat')}>
          <Plus size={17} /> Criar no estúdio
        </Button>
      </PageHeader>

      <section
        className={styles.creationStudio}
        aria-labelledby="creation-title"
      >
        <div className={styles.creationIntro}>
          <h2 id="creation-title">Criar pela agenda</h2>
          <p>
            Descreva a ideia aqui. Em Gerar conteúdo, escolha público, dias,
            horário, formato e redes. Os itens ficam como rascunhos para
            revisão.
          </p>
        </div>
        <div className={styles.creationComposer}>
          <label htmlFor="calendar-content-prompt">
            O que você gostaria de criar?
          </label>
          <textarea
            id="calendar-content-prompt"
            aria-label="Ideia do conteúdo na agenda"
            value={generatorPrompt}
            onChange={(event) => setGeneratorPrompt(event.target.value)}
            placeholder="Ex.: apresente nosso novo serviço para pequenos negócios..."
            rows={2}
            maxLength={2000}
          />
          <div className={styles.creationActions}>
            <small>{generatorPrompt.length}/2000</small>
            <Button
              type="button"
              onClick={() => {
                setGeneratorError('')
                setIsGeneratorOpen(true)
              }}
            >
              <Sparkles size={16} /> Gerar conteúdo
            </Button>
          </div>
        </div>
      </section>

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
                          data-status={draft.status}
                          onClick={() => setSelectedDraft(draft)}
                        >
                          <span />
                          <div>
                            <strong>{draft.title}</strong>
                            <small>
                              {draft.time ? `${draft.time} · ` : ''}
                              <span className={styles.platformLabel}>
                                <SocialPlatformIcon
                                  platform={draft.platform}
                                  size={12}
                                />
                                {draft.platform}
                              </span>{' '}
                              · {STATUS_LABELS[draft.status]}
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {!monthDrafts.length && (
              <div className={styles.monthEmpty}>
                Nenhum post neste mês. Use “Criar no estúdio” para começar um
                rascunho.
              </div>
            )}
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
                      {draft.time ? `${draft.time} · ` : ''}
                      <span className={styles.platformLabel}>
                        <SocialPlatformIcon
                          platform={draft.platform}
                          size={14}
                        />
                        {draft.platform}
                      </span>{' '}
                      · {STATUS_LABELS[draft.status]}
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
      {generationNotice ? (
        <p className={styles.savedNotice} role="status">
          {generationNotice}
        </p>
      ) : null}
      {isGeneratorOpen ? (
        <GenerateContentSidebar
          brand={brand}
          workspaces={availableWorkspaces}
          initialBrandId={
            currentWorkspace?.id ?? availableWorkspaces[0]?.id ?? ''
          }
          initialDate={
            dateTimePartsInZone(new Date(), DEFAULT_POST_TIMEZONE)?.date ??
            toDateKey(new Date())
          }
          initialPrompt={generatorPrompt}
          phase={generationPhase}
          error={generatorError}
          onClose={closeGenerator}
          onCancel={cancelGeneration}
          onEditPrompt={editComposerIdea}
          onGenerate={handleGenerate}
        />
      ) : null}
    </AppShell>
  )
}
