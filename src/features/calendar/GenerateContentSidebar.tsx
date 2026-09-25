import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Images,
  Sparkles,
  Square,
  Video,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormField'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import type { BrandProfile, BrandWorkspace } from '../../domain/models'
import {
  DEFAULT_POST_TIMEZONE,
  dateTimePartsInZone,
} from '../../../shared/domain/contentTime'
import {
  MONTH_NAMES,
  toDateKey,
  WEEK_DAYS,
  buildCalendar,
} from './calendarUtils'
import {
  PLATFORMS,
  type ContentFormat,
  type Platform,
} from '../content/generationService'
import styles from './GenerateContentSidebar.module.css'

const FORMATS: Array<{
  value: ContentFormat
  label: string
  description: string
  icon: typeof Images
}> = [
  {
    value: 'carousel',
    label: 'Carrossel',
    description: 'Sequência de slides',
    icon: Images,
  },
  {
    value: 'static',
    label: 'Estático',
    description: 'Uma peça visual',
    icon: Square,
  },
  {
    value: 'reels',
    label: 'Reels',
    description: 'Roteiro de vídeo curto',
    icon: Video,
  },
]

export interface GenerateContentValues {
  prompt: string
  dates: string[]
  time: string
  timezone: string
  persona: string
  format: ContentFormat
  platforms: Platform[]
  brandId: string
}

interface GenerateContentSidebarProps {
  brand: BrandProfile | null
  workspaces: BrandWorkspace[]
  initialBrandId: string
  initialDate: string
  initialPrompt: string
  phase: 'idle' | 'generating' | 'saving'
  error: string
  onEditPrompt: () => void
  onClose: () => void
  onCancel: () => void
  onGenerate: (values: GenerateContentValues) => Promise<void>
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return new Date()
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day), 12)
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(parseDateKey(value))
}

export function GenerateContentSidebar({
  brand,
  workspaces,
  initialBrandId,
  initialDate,
  initialPrompt,
  phase,
  error,
  onEditPrompt,
  onClose,
  onCancel,
  onGenerate,
}: GenerateContentSidebarProps) {
  const today =
    dateTimePartsInZone(new Date(), DEFAULT_POST_TIMEZONE)?.date ?? initialDate
  const [persona, setPersona] = useState('')
  const [brandId, setBrandId] = useState(
    initialBrandId || workspaces[0]?.id || '',
  )
  const [selectedDates, setSelectedDates] = useState<string[]>([
    initialDate || today,
  ])
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = parseDateKey(initialDate || today)
    return new Date(selected.getFullYear(), selected.getMonth(), 1)
  })
  const [time, setTime] = useState('16:30')
  const [format, setFormat] = useState<ContentFormat>('carousel')
  const [platforms, setPlatforms] = useState<Platform[]>(['Instagram'])
  const [formError, setFormError] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const isBusy = phase !== 'idle'
  const calendarCells = useMemo(
    () => buildCalendar(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  )
  const nextSevenDays = useMemo(() => {
    const first = parseDateKey(today)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first)
      date.setDate(date.getDate() + index)
      return toDateKey(date)
    })
  }, [today])
  const isNextSevenSelected =
    selectedDates.length === nextSevenDays.length &&
    nextSevenDays.every((date) => selectedDates.includes(date))
  const plannedCount = selectedDates.length * platforms.length
  const selectedBrand =
    workspaces.find(({ id }) => id === brandId)?.brand ?? brand

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary',
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

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [isBusy, onClose])

  function selectDate(date: string) {
    setFormError('')
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter((selected) => selected !== date))
      return
    }
    if (selectedDates.length >= 7) {
      setFormError('Escolha até sete datas por geração.')
      return
    }
    setSelectedDates([...selectedDates, date].sort())
  }

  function toggleNextSeven(checked: boolean) {
    setFormError('')
    setSelectedDates((current) => {
      if (checked) return nextSevenDays
      return current.filter((date) => !nextSevenDays.includes(date))
    })
    setVisibleMonth(() => {
      const date = parseDateKey(today)
      return new Date(date.getFullYear(), date.getMonth(), 1)
    })
  }

  function togglePlatform(platform: Platform) {
    setFormError('')
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((selected) => selected !== platform)
        : [...current, platform],
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (initialPrompt.trim().length < 3) {
      setFormError('Escreva uma ideia no campo da agenda antes de gerar.')
      return
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setFormError('Informe o horário no formato 24 horas, como 16:30.')
      return
    }
    if (selectedDates.length === 0) {
      setFormError('Selecione pelo menos uma data para a agenda.')
      return
    }
    if (platforms.length === 0) {
      setFormError('Selecione pelo menos um destino para adaptar o conteúdo.')
      return
    }
    setFormError('')
    void onGenerate({
      prompt: initialPrompt.trim(),
      dates: [...selectedDates].sort(),
      time,
      timezone: DEFAULT_POST_TIMEZONE,
      persona: persona.trim(),
      format,
      platforms: PLATFORMS.filter((platform) => platforms.includes(platform)),
      brandId,
    })
  }

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isBusy) onClose()
  }

  return (
    <div className={styles.layer} onMouseDown={handleBackdrop}>
      <aside
        ref={panelRef}
        className={styles.sidebar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-content-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="generate-content-title">Configurar geração</h2>
            <p>
              Uma variação por data e destino. Todos ficam como rascunhos para
              revisão.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={isBusy}
            aria-label="Fechar geração de conteúdo"
          >
            <X size={18} />
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.section}>
            {workspaces.length ? (
              <label className={styles.brandField}>
                <span>Marca para este conteúdo</span>
                <span className={styles.brandControl}>
                  <span
                    className={styles.brandSwatch}
                    style={{
                      backgroundColor: selectedBrand?.primaryColor ?? '#4F46E5',
                    }}
                    aria-hidden="true"
                  />
                  <select
                    value={brandId}
                    onChange={(event) => setBrandId(event.target.value)}
                    disabled={isBusy}
                    aria-label="Marca para este conteúdo"
                  >
                    {workspaces.map(({ id, brand: optionBrand }) => (
                      <option key={id} value={id}>
                        {optionBrand.name} · {optionBrand.segment}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            ) : null}
            <TextField
              label="Público ou persona (opcional)"
              name="content-persona"
              value={persona}
              onChange={(event) => setPersona(event.target.value.slice(0, 160))}
              placeholder="Ex.: pessoas que estão começando..."
              disabled={isBusy}
            />
            <span className={styles.helper}>
              {selectedBrand
                ? `Referência da marca: ${selectedBrand.segment} · ${selectedBrand.toneOfVoice}`
                : 'A ideia continua aberta a qualquer segmento.'}
            </span>
          </div>

          <section
            className={styles.ideaSummary}
            aria-label="Ideia do conteúdo"
          >
            <div>
              <strong>Ideia do conteúdo</strong>
              <p>
                {initialPrompt.trim() ||
                  'Escreva primeiro a ideia que deseja transformar em conteúdo.'}
              </p>
            </div>
            <button type="button" onClick={onEditPrompt} disabled={isBusy}>
              Editar ideia
            </button>
          </section>

          <section className={styles.section} aria-labelledby="schedule-title">
            <div className={styles.sectionTitle}>
              <CalendarDays size={16} />
              <h3 id="schedule-title">Em quais dias?</h3>
            </div>
            <div className={styles.monthHeader}>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    (month) =>
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
                disabled={
                  isBusy ||
                  toDateKey(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth(),
                      0,
                      12,
                    ),
                  ) < today
                }
                aria-label="Mês anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <strong>
                {MONTH_NAMES[visibleMonth.getMonth()]}{' '}
                {visibleMonth.getFullYear()}
              </strong>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    (month) =>
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
                disabled={isBusy}
                aria-label="Próximo mês"
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <div className={styles.weekdays} aria-hidden="true">
              {WEEK_DAYS.map((day) => (
                <span key={day}>{day.slice(0, 3)}</span>
              ))}
            </div>
            <div
              className={styles.monthGrid}
              role="group"
              aria-label="Selecione até sete datas"
            >
              {calendarCells.map(({ date, inCurrentMonth }) => {
                const dateKey = toDateKey(date)
                const selected = selectedDates.includes(dateKey)
                const disabled =
                  isBusy ||
                  !inCurrentMonth ||
                  dateKey < today ||
                  (!selected && selectedDates.length >= 7)
                return (
                  <button
                    key={dateKey}
                    type="button"
                    className={`${styles.dateButton} ${selected ? styles.dateSelected : ''} ${dateKey === today ? styles.dateToday : ''}`}
                    aria-label={formatDateLabel(dateKey)}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => selectDate(dateKey)}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
            <div className={styles.calendarActions}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={isNextSevenSelected}
                  onChange={(event) => toggleNextSeven(event.target.checked)}
                  disabled={isBusy}
                />
                <span>Próximos 7 dias</span>
              </label>
              <button
                type="button"
                className={styles.clearDates}
                onClick={() => {
                  setSelectedDates([])
                  setFormError('')
                }}
                disabled={isBusy || selectedDates.length === 0}
              >
                Limpar
              </button>
            </div>
            <p className={styles.helper}>
              {selectedDates.length === 0
                ? 'Nenhuma data selecionada.'
                : `${selectedDates.length} ${selectedDates.length === 1 ? 'dia selecionado' : 'dias selecionados'}${selectedDates.length <= 3 ? ` · ${selectedDates.map(formatDateLabel).join(', ')}` : ''}`}
            </p>
          </section>

          <div className={styles.timeSection}>
            <TextField
              label="Horário de Brasília"
              name="content-time"
              value={time}
              inputMode="numeric"
              placeholder="16:30"
              pattern="(?:[01]\d|2[0-3]):[0-5]\d"
              maxLength={5}
              onChange={(event) => setTime(event.target.value)}
              disabled={isBusy}
            />
            <span className={styles.timezone}>
              <Clock3 size={13} /> Fuso {DEFAULT_POST_TIMEZONE}
            </span>
          </div>

          <fieldset className={styles.section}>
            <legend>Formato do conteúdo</legend>
            <div className={styles.choiceGrid}>
              {FORMATS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={styles.choice}
                  aria-pressed={format === value}
                  onClick={() => setFormat(value)}
                  disabled={isBusy}
                >
                  <Icon size={20} strokeWidth={1.8} />
                  <strong>{label}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Destinos do conteúdo</legend>
            <p className={styles.helper}>
              Cada rede recebe um rascunho adaptado. A publicação continua com
              você.
            </p>
            <div className={styles.platformGrid}>
              {PLATFORMS.map((platform) => {
                const selected = platforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type="button"
                    className={styles.platform}
                    aria-pressed={selected}
                    onClick={() => togglePlatform(platform)}
                    disabled={isBusy}
                  >
                    <span className={styles.platformMark} aria-hidden="true">
                      <SocialPlatformIcon platform={platform} size={18} />
                    </span>
                    <span>{platform}</span>
                    <span className={styles.platformCheck} aria-hidden="true">
                      {selected ? <Check size={14} /> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {formError || error ? (
            <p className={styles.error} role="alert">
              {formError || error}
            </p>
          ) : null}

          <footer className={styles.footer}>
            <p className={styles.plannedCount} aria-live="polite">
              {plannedCount > 0
                ? `${selectedDates.length} ${selectedDates.length === 1 ? 'data' : 'datas'} × ${platforms.length} ${platforms.length === 1 ? 'destino' : 'destinos'} = ${plannedCount} ${plannedCount === 1 ? 'rascunho' : 'rascunhos'}`
                : 'Selecione datas e destinos para continuar.'}
            </p>
            {phase === 'generating' ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                <Clock3 size={15} /> Cancelar geração
              </Button>
            ) : null}
            <Button
              type="submit"
              fullWidth
              disabled={isBusy || plannedCount === 0}
            >
              <Sparkles size={16} />
              {phase === 'generating'
                ? `Gerando ${plannedCount} rascunhos...`
                : phase === 'saving'
                  ? 'Salvando na agenda...'
                  : `Gerar ${plannedCount || ''} ${plannedCount === 1 ? 'rascunho' : 'rascunhos'}`}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
