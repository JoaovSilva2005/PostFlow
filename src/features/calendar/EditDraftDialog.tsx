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
} from 'react'
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyCheck,
  Hash,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import type { PostDraft } from '../../domain/models'
import { DraftSchedulePanel } from './DraftSchedulePanel'
import { PostCreativePreview } from './PostCreativePreview'
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
  const captionId = useId()
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

  async function handleCopyCaption() {
    try {
      await navigator.clipboard.writeText(form.caption)
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

  return (
    <article
      className={styles.detailPostCard}
      aria-label={`Post para ${form.platform}`}
      data-draft-id={draft.id}
    >
      <header className={styles.detailMeta}>
        <div className={styles.detailPlatform}>
          <SocialPlatformIcon platform={form.platform} size={24} />
          <h2>{form.platform}</h2>
        </div>
        <span className={styles.statusBadge} data-status={form.status}>
          <span />
          {form.status === 'draft'
            ? 'Rascunho'
            : form.status === 'scheduled'
              ? 'Agendado'
              : 'Publicado'}
        </span>
        <div className={styles.metaDate}>
          <CalendarClock size={15} />
          <span>
            {form.date} · {form.time ?? '12:00'}
          </span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className={styles.detailForm}>
        <div className={styles.detailBody}>
          <PostCreativePreview
            draft={form}
            onRefreshImage={onRefreshImage}
            onGenerateImage={onGenerateImage ? handleGenerateImage : undefined}
          />

          <section
            className={styles.detailEditor}
            aria-label={`Legenda para ${form.platform}`}
          >
            <div className={styles.sectionHeading}>
              <div>
                <h3>Legenda</h3>
              </div>
            </div>
            <label className={styles.textareaField} htmlFor={captionId}>
              <span id={`${captionId}-label`}>Legenda</span>
              <textarea
                id={captionId}
                aria-labelledby={`${captionId}-label`}
                rows={10}
                maxLength={5000}
                value={form.caption}
                disabled={isSaving}
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
                    <button
                      type="button"
                      aria-label={`Remover hashtag ${hashtag}`}
                      disabled={isSaving}
                      onClick={() => removeHashtag(hashtag)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
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
              <small>Pressione Enter para adicionar. Até 30 por post.</small>
            </div>
            {form.formatData ? (
              <details className={styles.formatDetails}>
                <summary>Ver estrutura do formato</summary>
                {renderFormatStructure()}
              </details>
            ) : null}
          </section>

          <aside className={styles.detailSidebar}>
            <DraftSchedulePanel
              draft={form}
              disabled={isSaving}
              onDateChange={handleDateChange}
              onChange={updateFormField}
            />
            <section
              className={styles.detailActions}
              aria-label={`Ações do post para ${form.platform}`}
            >
              <h3>Mais opções</h3>
              <button
                type="button"
                onClick={handleCopyCaption}
                disabled={isSaving}
              >
                {copied ? <CopyCheck size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Legenda copiada' : 'Copiar legenda'}</span>
                {copied ? <Check size={14} /> : null}
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={isSaving}
              >
                <Copy size={16} />
                <span>Duplicar como rascunho</span>
                <ChevronRight size={15} />
              </button>
            </section>
          </aside>
        </div>

        <footer className={styles.detailFooter}>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isSaving}
            aria-label="Excluir post"
          >
            <Trash2 size={16} /> Excluir
          </Button>
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
    </article>
  )
}

const MemoizedEditDraftCard = memo(EditDraftCard)

async function noImageRefresh() {
  return null
}
