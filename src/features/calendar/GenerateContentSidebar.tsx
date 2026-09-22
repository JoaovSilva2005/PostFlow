import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { CalendarDays, Check, ChevronDown, Clock3, Images, Sparkles, Square, Video, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import type { BrandProfile } from '../../domain/models'
import { type Platform } from '../content/generationService'
import styles from './GenerateContentSidebar.module.css'

export type ContentFormat = 'Carrossel' | 'Estático' | 'Reels'

export interface GenerateContentValues {
  prompt: string
  date: string
  time: string
  nextSevenDays: boolean
  format: ContentFormat
  platform: Platform
}

interface GenerateContentSidebarProps {
  brand: BrandProfile | null
  initialDate: string
  initialPrompt: string
  isGenerating: boolean
  error: string
  onClose: () => void
  onCancel: () => void
  onGenerate: (values: GenerateContentValues) => Promise<void>
}

const formats: Array<{ label: ContentFormat; description: string; icon: typeof Images }> = [
  { label: 'Carrossel', description: 'Sequência de cards', icon: Images },
  { label: 'Estático', description: 'Uma peça visual', icon: Square },
  { label: 'Reels', description: 'Vídeo curto', icon: Video },
]

const platformOptions = [
  { label: 'Instagram', supported: true },
  { label: 'Facebook', supported: true },
  { label: 'X / Twitter', supported: false },
  { label: 'LinkedIn', supported: true },
  { label: 'TikTok', supported: false },
  { label: 'Blog', supported: false },
] as const

export function GenerateContentSidebar({
  brand,
  initialDate,
  initialPrompt,
  isGenerating,
  error,
  onClose,
  onCancel,
  onGenerate,
}: GenerateContentSidebarProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('16:30')
  const [nextSevenDays, setNextSevenDays] = useState(false)
  const [format, setFormat] = useState<ContentFormat>('Carrossel')
  const [platform, setPlatform] = useState<Platform>('Instagram')
  const [promptError, setPromptError] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !isGenerating) {
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
  }, [isGenerating, onClose])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (prompt.trim().length < 3) {
      setPromptError('Descreva sua ideia com pelo menos 3 caracteres.')
      return
    }
    setPromptError('')
    void onGenerate({ prompt: prompt.trim(), date, time, nextSevenDays, format, platform })
  }

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isGenerating) onClose()
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
            <span className={styles.kicker}><Sparkles size={14} /> Estúdio de conteúdo</span>
            <h2 id="generate-content-title">Gerar conteúdo</h2>
            <p>Configure a publicação antes de transformar a ideia em rascunho.</p>
          </div>
          <button ref={closeButtonRef} type="button" className={styles.close} onClick={onClose} disabled={isGenerating} aria-label="Fechar geração de conteúdo">
            <X size={18} />
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.section}>
            <SelectField
              label="Persona da marca"
              value={brand?.name || 'default'}
              onChange={() => undefined}
              options={[{ label: brand?.name || 'Persona padrão', value: brand?.name || 'default' }]}
              disabled={isGenerating}
            />
            <span className={styles.hint}>{brand ? `${brand.segment} · ${brand.toneOfVoice}` : 'Configure sua marca para personalizar a criação.'}</span>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}><CalendarDays size={16} /><h3>Quando publicar?</h3></div>
            <div className={styles.fieldGrid}>
              <TextField label="Data principal" type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={isGenerating} />
              <TextField label="Horário" type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={isGenerating} />
            </div>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={nextSevenDays} onChange={(event) => setNextSevenDays(event.target.checked)} disabled={isGenerating} />
              <span><strong>Próximos 7 dias</strong><small>Usar a agenda da próxima semana como referência.</small></span>
            </label>
          </div>

          <label className={styles.promptField}>
            <span>O que você quer criar?</span>
            <textarea aria-label="Ideia do conteúdo" rows={4} maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={isGenerating} placeholder="Ex.: apresente o novo serviço para pequenos negócios..." />
            <small>{prompt.length}/2000</small>
          </label>

          <fieldset className={styles.section}>
            <legend>Formato do conteúdo</legend>
            <div className={styles.choiceGrid}>
              {formats.map(({ label, description, icon: Icon }) => (
                <button key={label} type="button" className={styles.choice} aria-pressed={format === label} onClick={() => setFormat(label)} disabled={isGenerating}>
                  <Icon size={21} strokeWidth={1.8} />
                  <strong>{label}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Plataforma</legend>
            <div className={styles.platformGrid}>
              {platformOptions.map(({ label, supported }) => {
                const value = label === 'X / Twitter' ? 'Instagram' : label
                const isSelected = supported && platform === value
                return (
                  <button key={label} type="button" className={styles.platform} aria-pressed={isSelected} disabled={!supported || isGenerating} onClick={() => supported && setPlatform(value as Platform)} title={supported ? undefined : 'Disponível em uma próxima versão'}>
                    <span className={styles.platformDot}>{isSelected ? <Check size={13} /> : null}</span>
                    {label}
                    {!supported ? <small>Em breve</small> : null}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <details className={styles.advanced}>
            <summary><span><ChevronDown size={16} /> Configurações avançadas</span></summary>
            <p>O tom, as cores e o contexto da sua marca serão usados automaticamente. Mais opções editoriais serão adicionadas aqui.</p>
          </details>

          {promptError || error ? <p className={styles.error} role="alert">{promptError || error}</p> : null}

          <footer className={styles.footer}>
            {isGenerating ? <Button type="button" variant="ghost" onClick={onCancel}><Clock3 size={15} /> Cancelar geração</Button> : null}
            <Button type="submit" fullWidth disabled={isGenerating}>
              <Sparkles size={16} /> {isGenerating ? 'Gerando conteúdo...' : 'Gerar conteúdo'}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
