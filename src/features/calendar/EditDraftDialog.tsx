import {
  useCallback,
  useEffect,
  useId,
  memo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyCheck,
  CopyPlus,
  Hash,
  Info,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import type { PostDraft } from '../../domain/models'
import { DraftPublishDialog } from './DraftPublishDialog'
import { DraftSchedulePopover } from './DraftSchedulePopover'
import {
  PostCreativePreview,
  type ImageGenerationState,
  type PostCreativePreviewHandle,
} from './PostCreativePreview'
import styles from './CalendarPage.module.css'

interface EditDraftDialogProps {
  drafts: PostDraft[]
  date: string
  previousDate: string | null
  nextDate: string | null
  onNavigate: (date: string) => void
  onClose: () => void
  onSave: (draft: PostDraft) => Promise<void>
  onDateChange: (draft: PostDraft, date: string) => Promise<void>
  onRefreshImage?: (draftId: string) => Promise<string | null>
  onGenerateImage?: (draft: PostDraft) => Promise<string | null>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (draft: PostDraft) => Promise<PostDraft>
}

interface CardState {
  hasUnsavedChanges: boolean
  isSaving: boolean
}

const STATUS_LABELS: Record<PostDraft['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  published: 'Publicado',
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}/${month}/${year}` : date
}

function captionWithHashtags(caption: string, hashtags: string[]) {
  return hashtags.length
    ? `${caption}

${hashtags.join(' ')}`
    : caption
}

function formatDateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`)
  if (Number.isNaN(value.getTime())) return date
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value)
}

export function EditDraftDialog({
  drafts,
  date,
  previousDate,
  nextDate,
  onNavigate,
  onClose,
  onSave,
  onDateChange,
  onRefreshImage,
  onGenerateImage,
  onDelete,
  onDuplicate,
}: EditDraftDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({})
  const [navigationNotice, setNavigationNotice] = useState('')
  const hasUnsavedChanges = Object.values(cardStates).some(
    (state) => state.hasUnsavedChanges,
  )
  const isSaving = Object.values(cardStates).some((state) => state.isSaving)

  const updateCardState = useCallback((id: string, state: CardState) => {
    setCardStates((current) => {
      const previous = current[id]
      if (
        previous?.hasUnsavedChanges === state.hasUnsavedChanges &&
        previous?.isSaving === state.isSaving
      ) {
        return current
      }
      return { ...current, [id]: state }
    })
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !isSaving) onClose()
    if (event.key !== 'Tab') return
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
    )
    if (!controls?.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function navigateTo(nextDate: string | null) {
    if (!nextDate || isSaving) return
    if (hasUnsavedChanges) {
      setNavigationNotice(
        'Salve ou descarte as alterações antes de trocar de data.',
      )
      return
    }
    setNavigationNotice('')
    onNavigate(nextDate)
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (!isSaving && event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
    >
      <section
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
        className={styles.detailDialog}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="edit-title"
      >
        <header className={styles.detailNavigation}>
          <div className={styles.dayNavigator}>
            <button
              type="button"
              aria-label="Dia anterior"
              disabled={!previousDate || isSaving}
              onClick={() => navigateTo(previousDate)}
            >
              <ChevronLeft size={19} />
            </button>
            <div aria-live="polite">
              <h2 id="edit-title">{formatDateLabel(date)}</h2>
              <small>
                {drafts.length}{' '}
                {drafts.length === 1 ? 'post nesta data' : 'posts nesta data'}
              </small>
            </div>
            <button
              type="button"
              aria-label="Próximo dia"
              disabled={!nextDate || isSaving}
              onClick={() => navigateTo(nextDate)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <div className={styles.dayNavigationActions}>
            {navigationNotice ? (
              <span role="status">{navigationNotice}</span>
            ) : null}
            <button
              className={styles.detailClose}
              type="button"
              onClick={onClose}
              disabled={isSaving}
              aria-label="Fechar detalhes do dia"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <div
          className={styles.dayPosts}
          aria-label={`Posts em ${formatDateLabel(date)}`}
        >
          {drafts.length > 0 ? (
            drafts.map((draft) => (
              <MemoizedEditDraftCard
                key={draft.id}
                draft={draft}
                onSave={onSave}
                onDateChange={onDateChange}
                onRefreshImage={onRefreshImage ?? noImageRefresh}
                onGenerateImage={onGenerateImage}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onStateChange={updateCardState}
              />
            ))
          ) : (
            <p className={styles.emptyDay} role="status">
              Atualizando os posts desta data…
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

interface EditDraftCardProps {
  draft: PostDraft
  onSave: (draft: PostDraft) => Promise<void>
  onDateChange: (draft: PostDraft, date: string) => Promise<void>
  onRefreshImage?: (draftId: string) => Promise<string | null>
  onGenerateImage?: (draft: PostDraft) => Promise<string | null>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (draft: PostDraft) => Promise<PostDraft>
  onStateChange: (id: string, state: CardState) => void
}

function EditDraftCard({
  draft,
  onSave,
  onDateChange,
  onRefreshImage,
  onGenerateImage,
  onDelete,
  onDuplicate,
  onStateChange,
}: EditDraftCardProps) {
  const [form, setForm] = useState(draft)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [hashtagInput, setHashtagInput] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [imageGeneration, setImageGeneration] = useState<ImageGenerationState>({
    available: false,
    busy: false,
  })
  const captionId = useId()
  const scheduleEditorId = useId()
  const resourcesTitleId = useId()
  const previewRef = useRef<PostCreativePreviewHandle>(null)
  const datePillRef = useRef<HTMLButtonElement>(null)
  const statusPillRef = useRef<HTMLButtonElement>(null)
  const lastScheduleTrigger = useRef<HTMLButtonElement | null>(null)
  const publishTriggerRef = useRef<HTMLButtonElement>(null)
  const scheduleTriggerRefs = useRef([datePillRef, statusPillRef]).current
  // Publicado (situação salva) fica somente leitura no texto, como na referência.
  const isPublished = draft.status === 'published'
  const normalizedPendingHashtag = hashtagInput.trim().replace(/[#\s,]+/g, '')
  const pendingHashtag = normalizedPendingHashtag
    ? `#${normalizedPendingHashtag}`
    : ''
  const hasUnsavedChanges =
    form.caption !== draft.caption ||
    (form.time ?? '12:00') !== (draft.time ?? '12:00') ||
    form.status !== draft.status ||
    form.hashtags.length !== draft.hashtags.length ||
    form.hashtags.some((hashtag, index) => hashtag !== draft.hashtags[index]) ||
    Boolean(
      pendingHashtag &&
      !form.hashtags.some(
        (hashtag) => hashtag.toLowerCase() === pendingHashtag.toLowerCase(),
      ),
    )

  useEffect(() => {
    setForm((currentForm) =>
      currentForm.id === draft.id
        ? { ...currentForm, date: draft.date, imageUrl: draft.imageUrl }
        : draft,
    )
    setError('')
    setCopied(false)
  }, [draft])

  useEffect(() => {
    onStateChange(draft.id, { hasUnsavedChanges, isSaving })
  }, [draft.id, hasUnsavedChanges, isSaving, onStateChange])

  useEffect(
    () => () =>
      onStateChange(draft.id, { hasUnsavedChanges: false, isSaving: false }),
    [draft.id, onStateChange],
  )

  function updateFormField<Key extends keyof PostDraft>(
    field: Key,
    value: PostDraft[Key],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setNotice('')
    setError('')
  }

  function addHashtag() {
    if (!pendingHashtag) return
    if (
      form.hashtags.some(
        (hashtag) => hashtag.toLowerCase() === pendingHashtag.toLowerCase(),
      )
    ) {
      setError('Essa hashtag já está adicionada.')
      return
    }
    if (form.hashtags.length >= 30) {
      setError('Cada post pode ter até 30 hashtags.')
      return
    }
    updateFormField('hashtags', [...form.hashtags, pendingHashtag])
    setHashtagInput('')
  }

  function removeHashtag(hashtagToRemove: string) {
    updateFormField(
      'hashtags',
      form.hashtags.filter((hashtag) => hashtag !== hashtagToRemove),
    )
  }

  async function persist(nextDraft: PostDraft, successMessage: string) {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await onSave(nextDraft)
      setForm(nextDraft)
      setNotice(successMessage)
    } catch {
      setError(
        'Não foi possível salvar as alterações. Confira os campos e tente novamente.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    let hashtags = form.hashtags
    if (pendingHashtag) {
      const alreadyAdded = hashtags.some(
        (hashtag) => hashtag.toLowerCase() === pendingHashtag.toLowerCase(),
      )
      if (!alreadyAdded && hashtags.length >= 30) {
        setError('Cada post pode ter até 30 hashtags.')
        return
      }
      if (!alreadyAdded) hashtags = [...hashtags, pendingHashtag]
    }
    const updatedDraft = { ...form, hashtags }
    setHashtagInput('')
    await persist(updatedDraft, 'Alterações salvas.')
  }

  async function handleDateChange(date: string) {
    setForm((currentForm) => ({ ...currentForm, date }))
    setError('')
    setNotice('')
    if (!date) {
      setNotice('Escolha uma data para mover o post na agenda.')
      return
    }

    setIsSaving(true)
    try {
      await onDateChange(draft, date)
      setNotice('Post movido para a nova data na agenda.')
    } catch {
      setForm((currentForm) => ({ ...currentForm, date: draft.date }))
      setError('Não foi possível mover o post. A data original foi mantida.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSchedule() {
    await persist({ ...form, status: 'scheduled' }, 'Post salvo como agendado.')
  }

  async function handleDelete() {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await onDelete(form.id)
    } catch {
      setError('Não foi possível excluir este post. Tente novamente.')
      setIsSaving(false)
    }
  }

  async function handleDuplicate() {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await onDuplicate(form)
      setNotice('Cópia criada como rascunho.')
    } catch {
      setError('Não foi possível duplicar este post. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  function openScheduleEditor(trigger: HTMLButtonElement | null) {
    lastScheduleTrigger.current = trigger
    setScheduleOpen((open) => !open)
  }

  const closeScheduleEditor = useCallback((restoreFocus: boolean) => {
    setScheduleOpen(false)
    if (restoreFocus) lastScheduleTrigger.current?.focus()
  }, [])

  const closePublishDialog = useCallback(() => setPublishOpen(false), [])

  async function handleCopyCaption() {
    try {
      await navigator.clipboard.writeText(
        captionWithHashtags(form.caption, form.hashtags),
      )
      setCopied(true)
      setNotice('Legenda copiada.')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Não foi possível copiar a legenda neste navegador.')
    }
  }

  async function handleGenerateImage(draftToGenerate: PostDraft) {
    if (!onGenerateImage) return null
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const imageUrl = await onGenerateImage(draftToGenerate)
      setNotice('Imagem gerada e salva na agenda.')
      return imageUrl
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Não foi possível gerar a imagem. Tente novamente.',
      )
      throw generationError
    } finally {
      setIsSaving(false)
    }
  }

  function renderFormatStructure() {
    const data = form.formatData
    if (!data) return null
    if (data.kind === 'carousel') {
      return (
        <section
          className={styles.contentStructure}
          aria-label="Estrutura do carrossel"
        >
          <h3>Slides do carrossel</h3>
          <ol>
            {data.slides.map((slide, index) => (
              <li key={`${slide.headline}-${index}`}>
                <strong>{slide.headline}</strong>
                <p>{slide.copy}</p>
                <small>Direção visual: {slide.visualDirection}</small>
              </li>
            ))}
          </ol>
        </section>
      )
    }
    if (data.kind === 'reels') {
      return (
        <section
          className={styles.contentStructure}
          aria-label="Roteiro do Reels"
        >
          <h3>Roteiro · {data.durationSeconds}s</h3>
          <p>
            <strong>Gancho:</strong> {data.hook}
          </p>
          <ol>
            {data.scenes.map((scene, index) => (
              <li key={`${scene.shot}-${index}`}>
                <strong>
                  Cena {index + 1}: {scene.shot}
                </strong>
                <p>{scene.narration}</p>
                {scene.onScreenText ? (
                  <small>Na tela: {scene.onScreenText}</small>
                ) : null}
              </li>
            ))}
          </ol>
          <p>
            <strong>Encerramento:</strong> {data.closingCta}
          </p>
        </section>
      )
    }
    return (
      <section
        className={styles.contentStructure}
        aria-label="Direção da peça estática"
      >
        <h3>Peça estática</h3>
        <p>
          <strong>Chamada:</strong> {data.headline}
        </p>
        <p>
          <strong>Direção visual:</strong> {data.visualDirection}
        </p>
      </section>
    )
  }

  const statusLabel = STATUS_LABELS[form.status] ?? form.status
  const timeLabel = form.time ?? '12:00'

  return (
    <article
      className={styles.detailPostCard}
      aria-label={`Post para ${form.platform}`}
      data-draft-id={draft.id}
    >
      <header
        className={styles.detailMeta}
        onKeyDown={(event) => {
          // Escape com o foco nas pílulas fecha só o editor de agenda.
          if (event.key === 'Escape' && scheduleOpen) {
            event.stopPropagation()
            closeScheduleEditor(true)
          }
        }}
      >
        <div className={styles.detailPlatform}>
          <SocialPlatformIcon platform={form.platform} size={24} />
          <h2>{form.platform}</h2>
        </div>
        <div className={styles.detailMetaActions}>
          <button
            ref={statusPillRef}
            type="button"
            className={styles.statusBadge}
            data-status={form.status}
            aria-label={`Situação: ${statusLabel}. Editar situação`}
            aria-haspopup="dialog"
            aria-expanded={scheduleOpen}
            aria-controls={scheduleOpen ? scheduleEditorId : undefined}
            onClick={() => openScheduleEditor(statusPillRef.current)}
          >
            <span />
            {statusLabel}
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <button
            ref={datePillRef}
            type="button"
            className={styles.metaDate}
            aria-label={`Editar data e horário: ${formatShortDate(form.date)} às ${timeLabel}`}
            aria-haspopup="dialog"
            aria-expanded={scheduleOpen}
            aria-controls={scheduleOpen ? scheduleEditorId : undefined}
            onClick={() => openScheduleEditor(datePillRef.current)}
          >
            <CalendarClock size={15} aria-hidden="true" />
            <span>
              {formatShortDate(form.date)} · {timeLabel}
            </span>
            <Pencil size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.metaAction}
            onClick={handleDuplicate}
            disabled={isSaving}
          >
            <Copy size={14} aria-hidden="true" />
            Duplicar
          </button>
        </div>
        {scheduleOpen ? (
          <DraftSchedulePopover
            id={scheduleEditorId}
            draft={form}
            disabled={isSaving}
            onDateChange={handleDateChange}
            onChange={updateFormField}
            onClose={closeScheduleEditor}
            triggerRefs={scheduleTriggerRefs}
          />
        ) : null}
      </header>

      <form onSubmit={handleSubmit} className={styles.detailForm}>
        <div className={styles.detailBody}>
          <PostCreativePreview
            ref={previewRef}
            draft={form}
            onRefreshImage={onRefreshImage}
            onGenerateImage={
              onGenerateImage && !isPublished ? handleGenerateImage : undefined
            }
            hideGenerateButton
            onGenerationStateChange={setImageGeneration}
            readOnlyNote={
              isPublished ? 'Post publicado não pode ser editado.' : undefined
            }
          />

          <section
            className={styles.detailEditor}
            aria-label={`Legenda para ${form.platform}`}
          >
            <div className={styles.sectionHeading}>
              <h3>Legenda</h3>
              <button
                type="button"
                className={styles.inlineAction}
                onClick={handleCopyCaption}
              >
                {copied ? (
                  <CopyCheck size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                Copiar legenda
              </button>
            </div>
            <label className={styles.textareaField} htmlFor={captionId}>
              <span id={`${captionId}-label`} className="sr-only">
                Legenda
              </span>
              <textarea
                id={captionId}
                aria-labelledby={`${captionId}-label`}
                rows={10}
                maxLength={5000}
                value={form.caption}
                disabled={isSaving}
                readOnly={isPublished}
                onChange={(event) =>
                  updateFormField('caption', event.target.value)
                }
              />
              <small>{form.caption.length}/5000 caracteres</small>
            </label>
            <div className={styles.hashtagSection}>
              <span>Hashtags</span>
              <div className={styles.hashtagChips}>
                {form.hashtags.map((hashtag) => (
                  <span className={styles.hashtagChip} key={hashtag}>
                    {hashtag}
                    {isPublished ? null : (
                      <button
                        type="button"
                        aria-label={`Remover hashtag ${hashtag}`}
                        disabled={isSaving}
                        onClick={() => removeHashtag(hashtag)}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isPublished ? null : (
                <>
                  <div className={styles.hashtagInputRow}>
                    <Hash size={15} aria-hidden="true" />
                    <input
                      type="text"
                      aria-label="Adicionar hashtag"
                      value={hashtagInput}
                      maxLength={80}
                      disabled={isSaving || form.hashtags.length >= 30}
                      placeholder="Digite uma hashtag"
                      onChange={(event) => {
                        setHashtagInput(event.target.value)
                        setError('')
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                          event.preventDefault()
                          addHashtag()
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={isSaving || !pendingHashtag}
                      onClick={addHashtag}
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                  <small>
                    Pressione Enter para adicionar. Até 30 por post.
                  </small>
                </>
              )}
            </div>
            {form.formatData ? (
              <details className={styles.formatDetails}>
                <summary>Ver estrutura do formato</summary>
                {renderFormatStructure()}
              </details>
            ) : null}
          </section>

          <aside className={styles.detailSidebar}>
            <section
              className={styles.resources}
              aria-labelledby={resourcesTitleId}
            >
              <h3 id={resourcesTitleId}>Mais recursos</h3>
              <ul className={styles.resourceList}>
                <ResourceItem
                  ref={publishTriggerRef}
                  icon={Send}
                  title="Publicar nas redes"
                  description="Escolha as contas e agende o envio"
                  onClick={() => setPublishOpen(true)}
                  hasPopup
                />
                {imageGeneration.available ? (
                  <ResourceItem
                    icon={imageGeneration.busy ? LoaderCircle : Sparkles}
                    iconClassName={
                      imageGeneration.busy ? styles.spinningIcon : undefined
                    }
                    title={
                      imageGeneration.busy
                        ? 'Gerando imagem…'
                        : 'Gerar imagem com IA'
                    }
                    description="Crie a arte do post (usa 1 imagem da franquia)"
                    disabled={imageGeneration.busy || isSaving}
                    onClick={() => previewRef.current?.generateImage()}
                  />
                ) : null}
                <ResourceItem
                  icon={copied ? CopyCheck : Copy}
                  title="Copiar legenda"
                  description={
                    copied ? 'Legenda copiada' : 'Copie o texto com as hashtags'
                  }
                  trailing={copied ? <Check size={14} /> : null}
                  onClick={handleCopyCaption}
                />
                <ResourceItem
                  icon={CopyPlus}
                  title="Duplicar como rascunho"
                  description="Crie uma cópia editável deste post"
                  disabled={isSaving}
                  onClick={handleDuplicate}
                />
              </ul>
              <p className={styles.resourceNote}>
                <Info size={14} aria-hidden="true" />
                Este post é publicado automaticamente na data agendada depois de
                aprovado.
              </p>
              <ul className={styles.resourceList}>
                <ResourceItem
                  icon={Trash2}
                  title="Excluir post"
                  description="Remove este post da agenda"
                  tone="danger"
                  disabled={isSaving}
                  onClick={handleDelete}
                />
              </ul>
            </section>
          </aside>
        </div>

        <footer className={styles.detailFooter}>
          <div className={styles.detailFeedback}>
            {error ? (
              <p className={styles.dialogError} role="alert">
                {error}
              </p>
            ) : notice ? (
              <p className={styles.saveNotice} role="status">
                {notice}
              </p>
            ) : null}
          </div>
          <div className={styles.detailFooterActions}>
            {form.status === 'draft' ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSchedule}
                disabled={isSaving}
              >
                <CalendarClock size={16} />
                {isSaving ? 'Salvando...' : 'Salvar como agendado'}
              </Button>
            ) : null}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </footer>
      </form>

      <DraftPublishDialog
        open={publishOpen}
        draft={form}
        hasUnsavedChanges={hasUnsavedChanges}
        onClose={closePublishDialog}
        returnFocusRef={publishTriggerRef}
      />
    </article>
  )
}

interface ResourceItemProps {
  icon: LucideIcon
  iconClassName?: string
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
  trailing?: ReactNode
  hasPopup?: boolean
  ref?: Ref<HTMLButtonElement>
}

function ResourceItem({
  icon: Icon,
  iconClassName,
  title,
  description,
  onClick,
  disabled = false,
  tone = 'default',
  trailing,
  hasPopup = false,
  ref,
}: ResourceItemProps) {
  const descriptionId = useId()
  return (
    <li>
      <button
        ref={ref}
        type="button"
        className={styles.resourceItem}
        data-tone={tone}
        aria-label={title}
        aria-describedby={descriptionId}
        aria-haspopup={hasPopup ? 'dialog' : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon size={17} aria-hidden="true" className={iconClassName} />
        <span className={styles.resourceText}>
          <strong>{title}</strong>
          <small id={descriptionId}>{description}</small>
        </span>
        {trailing}
      </button>
    </li>
  )
}

const MemoizedEditDraftCard = memo(EditDraftCard)

async function noImageRefresh() {
  return null
}
