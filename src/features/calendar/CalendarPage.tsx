import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import { postStatusLabel } from '../../../shared/domain/postPublishing'
import type { BrandProfile, PostDraft } from '../../domain/models'
import {
  generationError,
  generationService,
  type Platform,
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

export function CalendarPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    brand,
    currentWorkspace,
    billingWorkspaceId,
    availableWorkspaces,
    drafts,
    updateDraft,
    removeDraft,
    addDraftsForWorkspace,
    selectWorkspace,
    refreshDraftImageUrl,
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [view, setView] = useState<'month' | 'list'>(() =>
    window.matchMedia?.('(max-width: 560px)').matches ? 'list' : 'month',
  )
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [generatorPrompt, setGeneratorPrompt] = useState('')
  const [generatorError, setGeneratorError] = useState('')
  const [generationPhase, setGenerationPhase] = useState<
    'idle' | 'generating' | 'generating-images' | 'saving'
  >('idle')
  const isGenerating = generationPhase !== 'idle'
  const [generationNotice, setGenerationNotice] = useState('')
  const [imageProgress, setImageProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const generationController = useRef<AbortController | null>(null)
  const visibleMonthKey = toDateKey(visibleMonth).slice(0, 7)
  const monthDrafts = useMemo(
    () =>
      drafts
        .filter((draft) => draft.date.startsWith(visibleMonthKey))
        .sort((left, right) => left.date.localeCompare(right.date)),
    [drafts, visibleMonthKey],
  )
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
  const orderedDrafts = useMemo(
    () =>
      [...drafts].sort((left, right) => {
        const leftSchedule = `${left.date}T${left.time ?? '12:00'}`
        const rightSchedule = `${right.date}T${right.time ?? '12:00'}`
        return (
          leftSchedule.localeCompare(rightSchedule) ||
          left.platform.localeCompare(right.platform) ||
          left.id.localeCompare(right.id)
        )
      }),
    [drafts],
  )
  const availableDates = useMemo(
    () => [...new Set(orderedDrafts.map((draft) => draft.date))],
    [orderedDrafts],
  )
  const selectedDayDrafts = selectedDate
    ? orderedDrafts.filter((draft) => draft.date === selectedDate)
    : []
  const selectedDateIndex = selectedDate
    ? availableDates.indexOf(selectedDate)
    : -1

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

  const handleSaveDraft = useCallback(
    async (updatedDraft: PostDraft) => {
      await updateDraft(updatedDraft)
    },
    [updateDraft],
  )

  const handleDraftDateChange = useCallback(
    async (draft: PostDraft, date: string) => {
      // Use the last persisted post as the base so unsaved caption/time/status
      // edits in the open dialog are not included in this automatic update.
      const updatedDraft = { ...draft, date }
      await updateDraft(updatedDraft)
      setSelectedDate(date)
    },
    [updateDraft],
  )

  const generateDraftImage = useCallback(
    async (
      draft: PostDraft,
      workspaceId: string,
      imageBillingWorkspaceId: string | undefined,
      imageBrand: BrandProfile | null,
      signal: AbortSignal,
      prompt = `${draft.title}\n\n${draft.caption}`,
    ) => {
      if (!generationService.generateImage) {
        throw new Error('Geração de imagem indisponível neste momento.')
      }
      return generationService.generateImage(
        {
          workspaceId,
          billingWorkspaceId: imageBillingWorkspaceId,
          prompt,
          platform: draft.platform as Platform,
          date: draft.date,
          brand: imageBrand,
          history: [],
          previousDraft: draft,
          imageTier: 'standard',
          format: draft.format,
          formatData: draft.formatData,
        },
        signal,
      )
    },
    [],
  )

  const handleDeleteDraft = useCallback(
    async (draftId: string) => {
      await removeDraft(draftId)
      setSelectedDate((currentDate) => {
        if (!currentDate) return null
        const remainingDrafts = orderedDrafts.filter(
          (draft) => draft.id !== draftId,
        )
        if (remainingDrafts.some((draft) => draft.date === currentDate))
          return currentDate
        const remainingDates = [
          ...new Set(remainingDrafts.map((draft) => draft.date)),
        ]
        if (remainingDates.includes(currentDate)) return currentDate
        if (remainingDates.length === 0) return null
        const currentDatePosition = availableDates.indexOf(currentDate)
        const nextDate = availableDates
          .slice(currentDatePosition + 1)
          .find((date) => remainingDates.includes(date))
        const previousDate = availableDates
          .slice(0, currentDatePosition)
          .reverse()
          .find((date) => remainingDates.includes(date))
        return nextDate ?? previousDate ?? remainingDates[0]
      })
    },
    [availableDates, orderedDrafts, removeDraft],
  )

  const handleDuplicateDraft = useCallback(
    async (draft: PostDraft) => {
      if (!currentWorkspace)
        throw new Error('Selecione uma marca para duplicar.')
      const duplicate: PostDraft = {
        ...draft,
        id: crypto.randomUUID(),
        title: `${draft.title} (cópia)`.slice(0, 160),
        status: 'draft',
        imageUrl: undefined,
      }
      const [createdDraft] = await addDraftsForWorkspace(currentWorkspace.id, [
        duplicate,
      ])
      if (!createdDraft) throw new Error('A cópia do post não foi criada.')
      return createdDraft
    },
    [addDraftsForWorkspace, currentWorkspace],
  )

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
    setImageProgress(null)
    let savedDrafts: PostDraft[] = []
    let draftsWereSaved = false
    let generatedImages = 0
    let targetWorkspaceId: string | undefined

    try {
      if (!generationService.generateBatch) {
        throw new Error('Geração em lote indisponível.')
      }
      const selectedWorkspace = availableWorkspaces.find(
        ({ id }) => id === values.brandId,
      )
      const selectedBrand = selectedWorkspace?.brand ?? brand
      const selectedWorkspaceId =
        selectedWorkspace?.id ?? currentWorkspace?.id
      if (!selectedWorkspaceId) throw new Error('Selecione uma marca para gerar.')
      targetWorkspaceId = selectedWorkspaceId
      const selectedWorkspaceHasPlan =
        selectedWorkspace?.billingStatus === 'active' ||
        selectedWorkspace?.billingStatus === 'trialing'
      const imageBillingWorkspaceId = selectedWorkspaceHasPlan
        ? selectedWorkspace?.id
        : billingWorkspaceId ?? selectedWorkspaceId
      const generated = await generationService.generateBatch(
        {
          workspaceId: selectedWorkspaceId,
          billingWorkspaceId: imageBillingWorkspaceId,
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
      const draftsByDate = new Map<string, PostDraft[]>()
      for (const draft of generated) {
        const dateDrafts = draftsByDate.get(draft.date) ?? []
        dateDrafts.push(draft)
        draftsByDate.set(draft.date, dateDrafts)
      }
      const imageGroups = [...draftsByDate.values()]
      const imagesByDate = new Map<string, string>()

      let imageFailure: unknown = null
      if (generationService.generateImage && generated.length > 0) {
        setGenerationPhase('generating-images')
        setImageProgress({ completed: 0, total: imageGroups.length })
        let nextImageGroupIndex = 0
        const generateNextDateImage = async () => {
          while (!controller.signal.aborted && !imageFailure) {
            const imageGroupIndex = nextImageGroupIndex++
            const draftsForDate = imageGroups[imageGroupIndex]
            const representativeDraft = draftsForDate?.[0]
            if (!draftsForDate || !representativeDraft) return
            try {
              const imageUrl = await generateDraftImage(
                representativeDraft,
                selectedWorkspaceId,
                imageBillingWorkspaceId,
                selectedBrand,
                controller.signal,
                values.prompt,
              )
              imagesByDate.set(representativeDraft.date, imageUrl)
              generatedImages += 1
              setImageProgress({
                completed: generatedImages,
                total: imageGroups.length,
              })
            } catch (error) {
              if (!controller.signal.aborted) imageFailure = error
              return
            }
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(3, imageGroups.length) },
            () => generateNextDateImage(),
          ),
        )
        controller.signal.throwIfAborted()
        if (imageFailure) throw imageFailure
      }

      const completedDrafts = generated.map((draft) => {
        const imageUrl = imagesByDate.get(draft.date)
        return imageUrl ? { ...draft, imageUrl } : draft
      })
      controller.signal.throwIfAborted()
      setGenerationPhase('saving')
      savedDrafts = await addDraftsForWorkspace(
        selectedWorkspaceId,
        completedDrafts,
        imageBillingWorkspaceId,
      )
      draftsWereSaved = true
      const generatedDate = new Date(
        `${savedDrafts[0]?.date ?? generated[0]?.date}T12:00:00`,
      )
      if (!Number.isNaN(generatedDate.getTime())) {
        setVisibleMonth(
          new Date(generatedDate.getFullYear(), generatedDate.getMonth(), 1),
        )
      }

      if (selectedWorkspaceId !== currentWorkspace?.id) {
        await selectWorkspace(selectedWorkspaceId)
      }
      setGeneratorPrompt('')
      const draftCount = savedDrafts.length
      const draftLabel = draftCount === 1 ? 'rascunho' : 'rascunhos'
      if (generationService.generateImage) {
        setGenerationNotice(
          `${draftCount} ${draftLabel} com imagens salvos na agenda para revisão. A publicação é manual.`,
        )
      } else {
        setGenerationNotice(
          `${draftCount} ${draftLabel} salvos na agenda para revisão. A publicação é manual.`,
        )
      }
      setIsGeneratorOpen(false)
    } catch (error) {
      if (controller.signal.aborted) {
        if (draftsWereSaved) {
          const draftCount = savedDrafts.length
          setGenerationNotice(
            `${draftCount} ${draftCount === 1 ? 'rascunho salvo' : 'rascunhos salvos'} com as imagens geradas.`,
          )
          if (
            targetWorkspaceId &&
            targetWorkspaceId !== currentWorkspace?.id
          ) {
            await selectWorkspace(targetWorkspaceId)
          }
          setIsGeneratorOpen(false)
        } else {
          setGeneratorError('Geração cancelada. Sua agenda não foi alterada.')
        }
      } else if (draftsWereSaved) {
        const draftCount = savedDrafts.length
        setGenerationNotice(
          `${draftCount} ${draftCount === 1 ? 'rascunho foi salvo' : 'rascunhos foram salvos'} com as imagens geradas. A publicação é manual.`,
        )
        setIsGeneratorOpen(false)
      } else {
        setGeneratorError(`${generationError(error)} Nenhum rascunho foi salvo.`)
      }
    } finally {
      if (generationController.current === controller) {
        generationController.current = null
      }
      setImageProgress(null)
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
          {location.state.createdDraftCount > 1
            ? `${location.state.createdDraftCount} rascunhos adicionados à agenda, um por rede social. Selecione cada post para fazer novos ajustes.`
            : 'Rascunho adicionado à agenda. Selecione o post para fazer novos ajustes.'}
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
                          onClick={() => setSelectedDate(draft.date)}
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
                              · {postStatusLabel(draft.status)}
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
                  onClick={() => setSelectedDate(draft.date)}
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
                      · {postStatusLabel(draft.status)}
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

      {selectedDate ? (
        <EditDraftDialog
          drafts={selectedDayDrafts}
          date={selectedDate}
          previousDate={
            selectedDateIndex > 0 ? availableDates[selectedDateIndex - 1] : null
          }
          nextDate={
            selectedDateIndex >= 0 &&
            selectedDateIndex < availableDates.length - 1
              ? availableDates[selectedDateIndex + 1]
              : null
          }
          onNavigate={setSelectedDate}
          onClose={() => setSelectedDate(null)}
          onSave={handleSaveDraft}
          onDateChange={handleDraftDateChange}
          onRefreshImage={refreshDraftImageUrl}
          onDelete={handleDeleteDraft}
          onDuplicate={handleDuplicateDraft}
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
          imageProgress={imageProgress}
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
