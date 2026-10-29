import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import { PageHeader } from '../../components/ui/PageHeader'
import { readableTextOn } from '../../components/ui/color'
import { BRAND_SEGMENT_OPTIONS } from '../../domain/brandCatalog'
import type { BrandProfile } from '../../domain/models'
import styles from './BrandPage.module.css'

const COLOR_PRESETS = [
  '#4F46E5',
  '#F97316',
  '#16A34A',
  '#171720',
  '#0EA5E9',
  '#DB2777',
]

const DEFAULT_PALETTE = ['#4F46E5', '#F97316', '#16A34A']
const MAX_PALETTE_COLORS = 5

const TONE_OPTIONS = [
  { label: 'Próximo e acolhedor', value: 'Próximo e acolhedor' },
  { label: 'Profissional e objetivo', value: 'Profissional e objetivo' },
  { label: 'Divertido e informal', value: 'Divertido e informal' },
  { label: 'Inspirador', value: 'Inspirador' },
]

/** Opening line of the sample caption, so the preview reacts to the tone. */
const TONE_OPENINGS: Record<string, string> = {
  'Próximo e acolhedor': 'Que bom ter você por aqui.',
  'Profissional e objetivo': 'Veja como podemos ajudar.',
  'Divertido e informal': 'Bora conhecer a gente?',
  Inspirador: 'Cada dia é uma chance de começar algo bom.',
}

const SETUP_STEPS = [
  { id: 'identity', label: 'Identidade' },
  { id: 'audience', label: 'Público e oferta' },
  { id: 'voice', label: 'Como a marca fala' },
] as const

const SETTINGS_SECTIONS = [
  { id: 'identity', label: 'Identidade' },
  { id: 'audience', label: 'Público e oferta' },
  { id: 'voice', label: 'Voz e regras' },
] as const

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

const EMPTY_BRAND_PROFILE: BrandProfile = {
  name: '',
  segment: 'Alimentação e bebidas',
  toneOfVoice: 'Próximo e acolhedor',
  primaryColor: '#4F46E5',
  colorPalette: DEFAULT_PALETTE,
  description: '',
  targetAudience: '',
  productsOrServices: '',
  differentials: '',
  contentGoals: '',
  keywords: '',
  avoidTopics: '',
  defaultCta: '',
}

const NAME_REQUIRED = 'Informe o nome da marca.'
const BRAND_LIMIT = 'Sua conta pode cadastrar até duas marcas.'

function getPalette(brand: BrandProfile | null | undefined) {
  if (!brand) return [...DEFAULT_PALETTE]
  const savedPalette = brand.colorPalette?.filter(Boolean)
  return savedPalette?.length
    ? savedPalette
    : [brand.primaryColor ?? EMPTY_BRAND_PROFILE.primaryColor]
}

const KNOWN_SEGMENTS = new Set<string>(
  BRAND_SEGMENT_OPTIONS.map(({ value }) => value),
)

function formFromBrand(brand: BrandProfile | null | undefined): BrandProfile {
  const form = {
    ...EMPTY_BRAND_PROFILE,
    ...brand,
    colorPalette: getPalette(brand),
  }
  // Accounts start with a placeholder segment; show what will be saved.
  if (!KNOWN_SEGMENTS.has(form.segment))
    form.segment = EMPTY_BRAND_PROFILE.segment
  return form
}

/** A brand counts as set up once any of its AI context has been filled in. */
function hasBrandContext(brand: BrandProfile) {
  return [
    brand.description,
    brand.targetAudience,
    brand.productsOrServices,
    brand.differentials,
    brand.contentGoals,
  ].some((value) => Boolean(value?.trim()))
}

function toPayload(form: BrandProfile): BrandProfile {
  const palette = getPalette(form)
  return {
    ...EMPTY_BRAND_PROFILE,
    ...form,
    name: form.name.trim(),
    primaryColor: palette[0],
    colorPalette: palette,
  }
}

function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'Não foi possível salvar a marca no Supabase.'
}

/* -------------------------------------------------------------------------- */
/* Shared fields                                                              */
/* -------------------------------------------------------------------------- */

type TextareaFieldProps = {
  label: string
  name: string
  value: string
  placeholder: string
  hint: string
  maxLength: number
  optional?: boolean
  onChange: (value: string) => void
}

function TextareaField({
  label,
  name,
  value,
  placeholder,
  hint,
  maxLength,
  optional,
  onChange,
}: TextareaFieldProps) {
  const generatedId = useId()
  const inputId = name || generatedId
  const hintId = `${inputId}-hint`
  const countId = `${inputId}-count`

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.fieldLabel} htmlFor={inputId}>
          {label}
        </label>
        {optional ? <span className={styles.optional}>Opcional</span> : null}
      </div>
      <textarea
        id={inputId}
        name={name}
        className={styles.textarea}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-describedby={`${hintId} ${countId}`}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
      />
      <div className={styles.fieldMeta}>
        <span id={hintId}>{hint}</span>
        <span id={countId} aria-live="polite" className={styles.count}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}

type FormUpdater = <Key extends keyof BrandProfile>(
  field: Key,
  value: BrandProfile[Key],
) => void

function PaletteEditor({
  palette,
  onChangeColor,
  onAddColor,
  onRemoveColor,
}: {
  palette: string[]
  onChangeColor: (index: number, color: string) => void
  onAddColor: () => void
  onRemoveColor: (index: number) => void
}) {
  return (
    <fieldset className={styles.palette}>
      <div className={styles.labelRow}>
        <legend className={styles.fieldLabel}>Paleta de cores</legend>
        <span className={styles.count}>
          {palette.length}/{MAX_PALETTE_COLORS}
        </span>
      </div>
      <ul className={styles.paletteList}>
        {palette.map((color, index) => {
          const name = index === 0 ? 'principal' : `de apoio ${index}`
          return (
            <li className={styles.paletteChip} key={`${index}-${color}`}>
              <label
                className={styles.paletteSwatch}
                style={{ backgroundColor: color }}
                title="Escolher cor"
              >
                <input
                  type="color"
                  aria-label={`Cor ${name}`}
                  value={color}
                  onChange={(event) => onChangeColor(index, event.target.value)}
                />
              </label>
              <span className={styles.paletteHex}>{color.toUpperCase()}</span>
              {index === 0 ? (
                <span className={styles.primaryTag}>Principal</span>
              ) : (
                <button
                  type="button"
                  className={styles.removeColor}
                  aria-label={`Remover cor de apoio ${index}`}
                  onClick={() => onRemoveColor(index)}
                >
                  <X size={14} />
                </button>
              )}
            </li>
          )
        })}
        {palette.length < MAX_PALETTE_COLORS ? (
          <li>
            <button
              type="button"
              className={styles.addColor}
              onClick={onAddColor}
            >
              <Plus size={14} /> Adicionar cor
            </button>
          </li>
        ) : null}
      </ul>
      <div className={styles.presets}>
        <span className={styles.helper}>Sugestões para a cor principal</span>
        <div className={styles.presetList}>
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Selecionar cor ${color}`}
              aria-pressed={palette[0] === color}
              style={{ background: color, color: readableTextOn(color) }}
              className={styles.preset}
              onClick={() => onChangeColor(0, color)}
            >
              {palette[0] === color ? <Check size={12} /> : null}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.helper}>
        A cor principal aparece nas artes e na prévia. As outras entram como
        apoio.
      </p>
    </fieldset>
  )
}

function IdentityFields({
  form,
  error,
  update,
  palette,
  onChangeColor,
  onAddColor,
  onRemoveColor,
}: {
  form: BrandProfile
  error: string
  update: FormUpdater
  palette: string[]
  onChangeColor: (index: number, color: string) => void
  onAddColor: () => void
  onRemoveColor: (index: number) => void
}) {
  return (
    <div className={styles.fields}>
      <div className={styles.fieldPair}>
        <TextField
          label="Nome da marca"
          name="brand-name"
          placeholder="Ex.: Café Aurora"
          value={form.name}
          autoComplete="organization"
          onChange={(event) => update('name', event.target.value)}
          error={error}
        />
        <SelectField
          label="Segmento"
          name="segment"
          value={form.segment}
          onChange={(event) => update('segment', event.target.value)}
          options={BRAND_SEGMENT_OPTIONS}
        />
      </div>
      <PaletteEditor
        palette={palette}
        onChangeColor={onChangeColor}
        onAddColor={onAddColor}
        onRemoveColor={onRemoveColor}
      />
    </div>
  )
}

function AudienceFields({
  form,
  update,
}: {
  form: BrandProfile
  update: FormUpdater
}) {
  return (
    <div className={styles.fields}>
      <TextareaField
        label="O que a marca faz?"
        name="brand-description"
        value={form.description ?? ''}
        placeholder="Ex.: Torrefação artesanal que entrega cafés especiais para quem gosta de descobrir novos sabores."
        hint="A proposta da marca em uma ou duas frases."
        maxLength={600}
        onChange={(value) => update('description', value)}
      />
      <TextareaField
        label="Para quem você fala?"
        name="target-audience"
        value={form.targetAudience ?? ''}
        placeholder="Ex.: Adultos de 25 a 45 anos que valorizam qualidade e comércio local."
        hint="Perfil, necessidades e momento de compra."
        maxLength={400}
        onChange={(value) => update('targetAudience', value)}
      />
      <TextareaField
        label="Produtos ou serviços"
        name="products-or-services"
        value={form.productsOrServices ?? ''}
        placeholder="Ex.: Café em grãos, kits de degustação e assinatura mensal."
        hint="O que pode virar pauta ou oferta."
        maxLength={600}
        optional
        onChange={(value) => update('productsOrServices', value)}
      />
      <TextareaField
        label="Diferenciais e provas"
        name="differentials"
        value={form.differentials ?? ''}
        placeholder="Ex.: Grãos de pequenos produtores, torra semanal e envio em até 24h."
        hint="O que torna a marca confiável e diferente."
        maxLength={400}
        optional
        onChange={(value) => update('differentials', value)}
      />
    </div>
  )
}

function VoiceFields({
  form,
  update,
}: {
  form: BrandProfile
  update: FormUpdater
}) {
  return (
    <div className={styles.fields}>
      <SelectField
        label="Tom de voz"
        name="tone"
        value={form.toneOfVoice}
        onChange={(event) => update('toneOfVoice', event.target.value)}
        options={TONE_OPTIONS}
        hint="Define o jeito de escrever das legendas."
      />
      <TextareaField
        label="Objetivos de conteúdo"
        name="content-goals"
        value={form.contentGoals ?? ''}
        placeholder="Ex.: Ensinar sobre café especial e gerar pedidos no site."
        hint="O resultado que você espera dos posts."
        maxLength={400}
        optional
        onChange={(value) => update('contentGoals', value)}
      />
      <TextField
        label="Palavras e expressões para usar"
        name="keywords"
        placeholder="Ex.: torra fresca, origem, café especial"
        value={form.keywords ?? ''}
        hint="Separe por vírgulas. Viram hashtags na prévia."
        optional
        onChange={(event) => update('keywords', event.target.value)}
      />
      <TextField
        label="Temas ou termos para evitar"
        name="avoid-topics"
        placeholder="Ex.: promessas de cura, descontos agressivos"
        value={form.avoidTopics ?? ''}
        hint="A IA não usa estes temas nos posts."
        optional
        onChange={(event) => update('avoidTopics', event.target.value)}
      />
      <TextField
        label="Chamada para ação padrão"
        name="default-cta"
        placeholder="Ex.: Conheça o cardápio no site"
        value={form.defaultCta ?? ''}
        hint="Pode ser trocada em cada pedido."
        optional
        onChange={(event) => update('defaultCta', event.target.value)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Live post preview                                                          */
/* -------------------------------------------------------------------------- */

function toHashtag(keyword: string) {
  const compact = keyword
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
  return compact ? `#${compact.toLowerCase()}` : ''
}

function BrandPostPreview({
  form,
  palette,
}: {
  form: BrandProfile
  palette: string[]
}) {
  const name = form.name.trim() || 'Sua marca'
  const primary = palette[0]
  const onPrimary = readableTextOn(primary)
  const description = form.description?.trim()
  const cta = form.defaultCta?.trim()
  const hashtags = (form.keywords ?? '')
    .split(',')
    .map((keyword) => toHashtag(keyword.trim()))
    .filter(Boolean)
    .slice(0, 3)
  const opening =
    TONE_OPENINGS[form.toneOfVoice] ?? TONE_OPENINGS['Próximo e acolhedor']

  return (
    <aside className={styles.preview} aria-label="Prévia do post">
      <div className={styles.previewHeading}>
        <h2>Prévia</h2>
        <span className={styles.helper}>Atualiza enquanto você digita</span>
      </div>
      <article className={styles.post}>
        <header className={styles.postHeader}>
          <span
            className={styles.postAvatar}
            style={{ backgroundColor: primary, color: onPrimary }}
            aria-hidden="true"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.postIdentity}>
            <strong data-testid="preview-brand-name">{name}</strong>
            <small>{form.segment}</small>
          </span>
        </header>
        <div
          className={styles.postArt}
          data-testid="preview-art"
          style={{ backgroundColor: primary, color: onPrimary }}
        >
          <span className={styles.postArtName}>{name}</span>
          <span className={styles.postArtLine}>{opening}</span>
          <span className={styles.postArtPalette} aria-hidden="true">
            {palette.slice(1).map((color, index) => (
              <i key={`${color}-${index}`} style={{ backgroundColor: color }} />
            ))}
          </span>
        </div>
        <div className={styles.postCaption}>
          <p>
            <strong>{name}</strong> {opening}{' '}
            {description ||
              'Conte o que a marca faz e esta legenda passa a falar do seu negócio.'}
          </p>
          {cta ? <p>{cta}</p> : null}
          {hashtags.length ? (
            <p className={styles.postTags}>{hashtags.join(' ')}</p>
          ) : null}
        </div>
      </article>
      <p className={styles.helper}>
        Exemplo ilustrativo. Os posts reais são gerados pela IA a partir destas
        informações, no tom {form.toneOfVoice.toLowerCase()}.
      </p>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

function useBrandForm(initial: BrandProfile) {
  const [form, setForm] = useState<BrandProfile>(initial)
  const [hasChanges, setHasChanges] = useState(false)

  const update: FormUpdater = (field, value) => {
    setHasChanges(true)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const palette = getPalette(form)

  function changeColor(index: number, color: string) {
    const next = [...palette]
    next[index] = color.toUpperCase()
    setHasChanges(true)
    setForm((current) => ({
      ...current,
      colorPalette: next,
      ...(index === 0 ? { primaryColor: color.toUpperCase() } : {}),
    }))
  }

  function addColor() {
    if (palette.length >= MAX_PALETTE_COLORS) return
    update('colorPalette', [...palette, '#CBD5E1'])
  }

  function removeColor(index: number) {
    if (index === 0) return
    update(
      'colorPalette',
      palette.filter((_, colorIndex) => colorIndex !== index),
    )
  }

  function reset(next: BrandProfile) {
    setForm(next)
    setHasChanges(false)
  }

  return {
    form,
    palette,
    hasChanges,
    update,
    changeColor,
    addColor,
    removeColor,
    reset,
  }
}

/* -------------------------------------------------------------------------- */
/* First registration: three-step setup                                       */
/* -------------------------------------------------------------------------- */

function BrandSetup({
  initialBrand,
  isCreating,
  canCreateBrand,
  onSkip,
}: {
  initialBrand: BrandProfile | null
  isCreating: boolean
  canCreateBrand: boolean
  onSkip?: () => void
}) {
  const navigate = useNavigate()
  const { saveBrand, createWorkspace } = useApp()
  const brandForm = useBrandForm(formFromBrand(initialBrand))
  const { form, palette, update } = brandForm
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const isLastStep = step === SETUP_STEPS.length - 1
  const blockedByLimit = isCreating && !canCreateBrand

  useEffect(() => {
    if (previousStep.current !== step) headingRef.current?.focus()
    previousStep.current = step
  }, [step])

  const updateField: FormUpdater = (field, value) => {
    if (field === 'name' && error) setError('')
    update(field, value)
  }

  function goTo(nextStep: number) {
    if (nextStep > 0 && !form.name.trim()) {
      setError(NAME_REQUIRED)
      setStep(0)
      return
    }
    setStep(Math.max(0, Math.min(nextStep, SETUP_STEPS.length - 1)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isLastStep) {
      goTo(step + 1)
      return
    }
    if (blockedByLimit) {
      setSaveError(BRAND_LIMIT)
      return
    }
    if (!form.name.trim()) {
      setError(NAME_REQUIRED)
      setStep(0)
      return
    }
    setError('')
    setSaveError('')
    setIsSaving(true)
    try {
      const payload = toPayload(form)
      if (isCreating) await createWorkspace(payload)
      else await saveBrand(payload)
      navigate('/chat')
    } catch (cause) {
      setSaveError(errorMessage(cause))
    } finally {
      setIsSaving(false)
    }
  }

  const stepCopy = [
    {
      title: 'Identidade da marca',
      description: 'O nome e as cores que aparecem em todos os posts.',
    },
    {
      title: 'Público e oferta',
      description:
        'Para quem a marca fala e o que vende. Quanto mais específico, menos genérico fica o texto.',
    },
    {
      title: 'Como a marca fala',
      description:
        'O tom das legendas e as regras que a IA deve seguir. Dá para completar depois.',
    },
  ][step]

  return (
    <div className={styles.setup}>
      <div className={styles.setupMain}>
        <header className={styles.setupHeader}>
          <h1>{isCreating ? 'Nova marca' : 'Cadastre sua marca'}</h1>
          <p>
            Três passos curtos. A IA usa estas informações em todo post que
            criar para você.
          </p>
          {onSkip ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={onSkip}
            >
              Ver todos os campos de uma vez
            </button>
          ) : null}
        </header>

        <ol className={styles.steps} aria-label="Etapas do cadastro">
          {SETUP_STEPS.map((item, index) => {
            const state =
              index === step ? 'current' : index < step ? 'done' : 'todo'
            return (
              <li
                key={item.id}
                className={styles.step}
                data-state={state}
                aria-current={index === step ? 'step' : undefined}
              >
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  disabled={index > step && !form.name.trim()}
                >
                  <span className={styles.stepNumber} aria-hidden="true">
                    {state === 'done' ? <Check size={12} /> : index + 1}
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {blockedByLimit ? (
          <p className={styles.notice} role="status">
            {BRAND_LIMIT} Edite uma marca existente ou fale com o suporte.
          </p>
        ) : null}

        <form className={styles.setupForm} onSubmit={handleSubmit} noValidate>
          <div className={styles.stepHeading}>
            <h2 ref={headingRef} tabIndex={-1}>
              {stepCopy.title}
            </h2>
            <p>{stepCopy.description}</p>
          </div>

          {step === 0 ? (
            <IdentityFields
              form={form}
              error={error}
              update={updateField}
              palette={palette}
              onChangeColor={brandForm.changeColor}
              onAddColor={brandForm.addColor}
              onRemoveColor={brandForm.removeColor}
            />
          ) : null}
          {step === 1 ? <AudienceFields form={form} update={update} /> : null}
          {step === 2 ? <VoiceFields form={form} update={update} /> : null}

          {saveError ? (
            <p className={styles.saveError} role="alert">
              {saveError}
            </p>
          ) : null}

          <div className={styles.setupActions}>
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={16} /> Voltar
              </Button>
            ) : (
              <span />
            )}
            {isLastStep ? (
              <Button type="submit" disabled={isSaving || blockedByLimit}>
                {isSaving ? 'Salvando...' : 'Salvar e criar o primeiro post'}
              </Button>
            ) : (
              <Button type="submit">
                Continuar <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </form>
      </div>
      <BrandPostPreview form={form} palette={palette} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Existing brand: settings layout                                            */
/* -------------------------------------------------------------------------- */

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: SettingsSectionId
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section
      id={`brand-section-${id}`}
      className={styles.section}
      aria-labelledby={`brand-section-${id}-title`}
    >
      <div className={styles.sectionHeading}>
        <h2 id={`brand-section-${id}-title`}>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  )
}

function BrandSettings({
  brand,
  canCreateBrand,
}: {
  brand: BrandProfile
  canCreateBrand: boolean
}) {
  const navigate = useNavigate()
  const { saveBrand } = useApp()
  const brandForm = useBrandForm(formFromBrand(brand))
  const { form, palette, hasChanges, update, reset } = brandForm
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>('identity')
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!hasChanges) reset(formFromBrand(brand))
    // Only follow external brand updates while the form is untouched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand])

  const updateField: FormUpdater = (field, value) => {
    if (field === 'name' && error) setError('')
    setSaved(false)
    update(field, value)
  }

  function discard() {
    reset(formFromBrand(brand))
    setError('')
    setSaveError('')
  }

  function goToSection(id: SettingsSectionId) {
    setActiveSection(id)
    document
      .getElementById(`brand-section-${id}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError(NAME_REQUIRED)
      goToSection('identity')
      return
    }
    setError('')
    setSaveError('')
    setIsSaving(true)
    try {
      const payload = toPayload(form)
      await saveBrand(payload)
      reset(formFromBrand(payload))
      setSaved(true)
    } catch (cause) {
      setSaveError(errorMessage(cause))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Minha marca"
        description="O que a IA sabe sobre a sua marca. Toda alteração vale para os próximos posts."
      >
        {canCreateBrand ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/brand/new')}
          >
            <Plus size={16} /> Nova marca
          </Button>
        ) : (
          <small className={styles.helper}>
            Limite de duas marcas atingido.
          </small>
        )}
      </PageHeader>

      <div className={styles.settings}>
        <nav className={styles.sectionNav} aria-label="Seções da marca">
          {SETTINGS_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#brand-section-${section.id}`}
              aria-current={activeSection === section.id ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault()
                goToSection(section.id)
              }}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <form
          className={styles.settingsForm}
          onSubmit={handleSubmit}
          noValidate
        >
          <SettingsSection
            id="identity"
            title="Identidade da marca"
            description="Nome, segmento e cores usados nas artes."
          >
            <IdentityFields
              form={form}
              error={error}
              update={updateField}
              palette={palette}
              onChangeColor={(index, color) => {
                setSaved(false)
                brandForm.changeColor(index, color)
              }}
              onAddColor={brandForm.addColor}
              onRemoveColor={brandForm.removeColor}
            />
          </SettingsSection>
          <SettingsSection
            id="audience"
            title="Público e oferta"
            description="Para quem a marca fala, o que vende e por que é diferente."
          >
            <AudienceFields form={form} update={updateField} />
          </SettingsSection>
          <SettingsSection
            id="voice"
            title="Voz e regras"
            description="Tom das legendas, objetivos e o que a IA deve usar ou evitar."
          >
            <VoiceFields form={form} update={updateField} />
          </SettingsSection>

          {saved && !hasChanges ? (
            <p className={styles.savedNote} role="status">
              <Check size={16} /> Marca salva. Os próximos posts já usam estas
              informações.
            </p>
          ) : null}
          {saveError && !hasChanges ? (
            <p className={styles.saveError} role="alert">
              {saveError}
            </p>
          ) : null}

          {hasChanges ? (
            <div
              className={styles.saveBar}
              role="region"
              aria-label="Alterações"
            >
              <div className={styles.saveBarText}>
                <span>Alterações não salvas</span>
                {saveError ? (
                  <span className={styles.saveBarError} role="alert">
                    {saveError}
                  </span>
                ) : null}
              </div>
              <div className={styles.saveBarActions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={discard}
                  disabled={isSaving}
                >
                  Descartar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          ) : null}
        </form>

        <BrandPostPreview form={form} palette={palette} />
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function BrandPage() {
  const location = useLocation()
  const {
    brand,
    currentWorkspace,
    availableWorkspaces,
    platformRole,
    databaseStatus,
  } = useApp()
  const isCreating = location.pathname.endsWith('/new')
  const ownedBrandCount = availableWorkspaces.filter(
    (workspace) => workspace.isOwnedByUser ?? workspace.role === 'owner',
  ).length
  const canCreateBrand =
    platformRole === 'platform_owner' || ownedBrandCount < 2
  const workspaceKey = currentWorkspace?.id ?? 'none'
  const [skippedSetupFor, setSkippedSetupFor] = useState<string | null>(null)
  const showSettings =
    !isCreating &&
    brand !== null &&
    (hasBrandContext(brand) || skippedSetupFor === workspaceKey)

  return (
    <AppShell>
      {!isCreating && !brand && databaseStatus === 'connecting' ? (
        <p className={styles.loading} role="status">
          Carregando a marca...
        </p>
      ) : showSettings && brand ? (
        <BrandSettings
          key={`settings-${workspaceKey}`}
          brand={brand}
          canCreateBrand={canCreateBrand}
        />
      ) : (
        <BrandSetup
          key={`setup-${workspaceKey}-${isCreating}`}
          initialBrand={isCreating ? null : brand}
          isCreating={isCreating}
          canCreateBrand={canCreateBrand}
          onSkip={
            !isCreating && brand
              ? () => setSkippedSetupFor(workspaceKey)
              : undefined
          }
        />
      )}
    </AppShell>
  )
}
