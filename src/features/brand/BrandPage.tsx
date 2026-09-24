import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Palette,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
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

const TONE_OPTIONS = [
  { label: 'Próximo e acolhedor', value: 'Próximo e acolhedor' },
  { label: 'Profissional e objetivo', value: 'Profissional e objetivo' },
  { label: 'Divertido e informal', value: 'Divertido e informal' },
  { label: 'Inspirador', value: 'Inspirador' },
]

const SECTIONS = [
  {
    id: 'identity',
    eyebrow: '01',
    label: 'Essencial',
    description: 'Identidade e paleta',
  },
  {
    id: 'context',
    eyebrow: '02',
    label: 'Contexto da IA',
    description: 'Público e oferta',
  },
  {
    id: 'editorial',
    eyebrow: '03',
    label: 'Direção editorial',
    description: 'Objetivos e regras',
  },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

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

type TextareaFieldProps = {
  label: string
  name: string
  value: string
  placeholder: string
  hint: string
  maxLength: number
  onChange: (value: string) => void
}

function TextareaField({
  label,
  name,
  value,
  placeholder,
  hint,
  maxLength,
  onChange,
}: TextareaFieldProps) {
  const generatedId = useId()
  const inputId = name || generatedId
  const hintId = `${inputId}-hint`
  const countId = `${inputId}-count`

  return (
    <div className={styles.textareaField}>
      <label className={styles.fieldLabel} htmlFor={inputId}>
        {label}
      </label>
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
        <span id={countId} aria-live="polite">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}

function contextValue(value: string | undefined) {
  return value?.trim() ?? ''
}

function getPalette(brand: BrandProfile | null | undefined) {
  if (!brand) return [...DEFAULT_PALETTE]
  const savedPalette = brand?.colorPalette?.filter(Boolean)
  return savedPalette?.length
    ? savedPalette
    : [brand?.primaryColor ?? EMPTY_BRAND_PROFILE.primaryColor]
}

export function BrandPage() {
  const navigate = useNavigate()
  const { brand, saveBrand } = useApp()
  const [form, setForm] = useState<BrandProfile>(() => ({
    ...EMPTY_BRAND_PROFILE,
    ...brand,
    colorPalette: getPalette(brand),
  }))
  const [activeSection, setActiveSection] = useState<SectionId>('identity')
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (brand && !hasChanges) {
      setForm({
        ...EMPTY_BRAND_PROFILE,
        ...brand,
        colorPalette: getPalette(brand),
      })
    }
  }, [brand, hasChanges])

  function updateFormField<Key extends keyof BrandProfile>(
    field: Key,
    value: BrandProfile[Key],
  ) {
    setHasChanges(true)
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function updatePaletteColor(index: number, color: string) {
    const palette = [...getPalette(form)]
    palette[index] = color.toUpperCase()
    updateFormField('colorPalette', palette)
    if (index === 0) updateFormField('primaryColor', color.toUpperCase())
  }

  function addPaletteColor() {
    if (getPalette(form).length >= 5) return
    updateFormField('colorPalette', [...getPalette(form), '#CBD5E1'])
  }

  function removePaletteColor(index: number) {
    if (index === 0) return
    updateFormField(
      'colorPalette',
      getPalette(form).filter((_, colorIndex) => colorIndex !== index),
    )
  }

  function moveSection(direction: -1 | 1) {
    const currentIndex = SECTIONS.findIndex(
      (section) => section.id === activeSection,
    )
    const nextSection = SECTIONS[currentIndex + direction]
    if (nextSection) setActiveSection(nextSection.id)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Informe o nome da marca.')
      setActiveSection('identity')
      return
    }

    setError('')
    setSaveError('')
    setIsSaving(true)

    try {
      await saveBrand({
        ...EMPTY_BRAND_PROFILE,
        ...form,
        name: form.name.trim(),
        primaryColor: getPalette(form)[0],
        colorPalette: getPalette(form),
      })
      navigate('/chat')
    } catch {
      setSaveError('Não foi possível salvar a marca no Supabase.')
    } finally {
      setIsSaving(false)
    }
  }

  const palette = getPalette(form)
  const brandDescription = contextValue(form.description)
  const targetAudience = contextValue(form.targetAudience)
  const products = contextValue(form.productsOrServices)
  const hasAiContext = Boolean(brandDescription || targetAudience || products)
  const currentSectionIndex = SECTIONS.findIndex(
    (section) => section.id === activeSection,
  )
  const currentSection = SECTIONS[currentSectionIndex]

  return (
    <AppShell>
      <PageHeader
        title="Configuração da marca"
        description="Organize o briefing da sua marca em poucos passos para a IA criar conteúdos mais precisos."
      />

      <div className={styles.columns}>
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.cardTitle}>
            <span>
              <Palette size={18} />
            </span>
            <div>
              <p className={styles.eyebrow}>BRIEFING DA MARCA</p>
              <h2>Uma configuração rápida e completa</h2>
              <p>
                Navegue pelas etapas. Suas informações ficam salvas enquanto
                você monta a identidade.
              </p>
            </div>
          </div>

          <nav className={styles.sectionNav} aria-label="Etapas da marca">
            {SECTIONS.map((section, index) => {
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  id={`brand-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`brand-section-${section.id}`}
                  className={`${styles.sectionTab} ${isActive ? styles.activeTab : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className={styles.sectionNumber}>0{index + 1}</span>
                  <span>
                    <strong>{section.label}</strong>
                    <small>{section.description}</small>
                  </span>
                  {index < currentSectionIndex ? (
                    <Check size={14} aria-label="Concluída" />
                  ) : null}
                </button>
              )
            })}
          </nav>

          <div
            id={`brand-section-${activeSection}`}
            role="tabpanel"
            aria-labelledby={`brand-tab-${activeSection}`}
            className={styles.sectionPanel}
          >
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>
                  ETAPA {currentSection.eyebrow} ·{' '}
                  {currentSection.label.toUpperCase()}
                </p>
                <h3>
                  {activeSection === 'identity'
                    ? 'Identidade da marca'
                    : activeSection === 'context'
                      ? 'Dê repertório para a IA'
                      : 'Defina a direção das ideias'}
                </h3>
                <p>
                  {activeSection === 'identity'
                    ? 'Defina os elementos que devem aparecer de forma consistente.'
                    : activeSection === 'context'
                      ? 'Quanto mais específico o briefing, menos genérico será o conteúdo.'
                      : 'Essas regras ajudam a manter cada publicação coerente com seus objetivos.'}
                </p>
              </div>
              <span className={styles.progressLabel}>
                {currentSectionIndex + 1}/{SECTIONS.length}
              </span>
            </div>

            {activeSection === 'identity' ? (
              <div className={styles.identityContent}>
                <div className={styles.formGrid}>
                  <TextField
                    label="Nome da marca"
                    name="brand-name"
                    placeholder="Ex.: Café Aurora"
                    value={form.name}
                    onChange={(event) =>
                      updateFormField('name', event.target.value)
                    }
                    error={error}
                  />
                  <SelectField
                    label="Segmento"
                    name="segment"
                    value={form.segment}
                    onChange={(event) =>
                      updateFormField('segment', event.target.value)
                    }
                    options={BRAND_SEGMENT_OPTIONS}
                  />
                  <SelectField
                    label="Tom de voz"
                    name="tone"
                    value={form.toneOfVoice}
                    onChange={(event) =>
                      updateFormField('toneOfVoice', event.target.value)
                    }
                    options={TONE_OPTIONS}
                  />
                </div>

                <fieldset className={styles.paletteField}>
                  <div className={styles.fieldHeading}>
                    <div>
                      <legend>Paleta de cores</legend>
                      <p>
                        Escolha qualquer cor para manter as artes alinhadas à
                        sua marca.
                      </p>
                    </div>
                    <span>{palette.length}/5 cores</span>
                  </div>
                  <div className={styles.paletteList}>
                    {palette.map((color, index) => (
                      <div
                        className={styles.paletteColor}
                        key={`${index}-${color}`}
                      >
                        <label htmlFor={`palette-color-${index}`}>
                          <span
                            className={styles.paletteSwatch}
                            style={{ backgroundColor: color }}
                          />
                          <span>
                            <strong>
                              {index === 0 ? 'Principal' : `Apoio ${index}`}
                            </strong>
                            <small>{color}</small>
                          </span>
                        </label>
                        <input
                          id={`palette-color-${index}`}
                          type="color"
                          aria-label={`Cor ${index === 0 ? 'principal' : `de apoio ${index}`}`}
                          value={color}
                          onChange={(event) =>
                            updatePaletteColor(index, event.target.value)
                          }
                        />
                        {index > 0 ? (
                          <button
                            type="button"
                            className={styles.removeColor}
                            aria-label={`Remover cor de apoio ${index}`}
                            onClick={() => removePaletteColor(index)}
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className={styles.paletteTools}>
                    <div className={styles.presetColors}>
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Selecionar cor ${color}`}
                          aria-pressed={palette.includes(color)}
                          style={{ background: color }}
                          className={
                            palette.includes(color) ? styles.selectedColor : ''
                          }
                          onClick={() => updatePaletteColor(0, color)}
                        >
                          {palette[0] === color ? <Check size={13} /> : null}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.addColor}
                      disabled={palette.length >= 5}
                      onClick={addPaletteColor}
                    >
                      <Plus size={14} /> Adicionar cor
                    </button>
                  </div>
                  <p className={styles.colorValue}>
                    A primeira cor é aplicada à prévia. Use o seletor nativo
                    para escolher qualquer tom.
                  </p>
                </fieldset>
              </div>
            ) : null}

            {activeSection === 'context' ? (
              <div className={styles.contextGrid}>
                <TextareaField
                  label="O que a marca faz?"
                  name="brand-description"
                  value={form.description ?? ''}
                  placeholder="Ex.: Torrefação artesanal que entrega cafés especiais para pessoas que gostam de descobrir novos sabores."
                  hint="Explique a história, a proposta e o momento atual."
                  maxLength={600}
                  onChange={(value) => updateFormField('description', value)}
                />
                <TextareaField
                  label="Para quem você fala?"
                  name="target-audience"
                  value={form.targetAudience ?? ''}
                  placeholder="Ex.: Adultos de 25 a 45 anos, urbanos, que valorizam qualidade e experiências locais."
                  hint="Descreva perfil, necessidades e contexto de compra."
                  maxLength={400}
                  onChange={(value) => updateFormField('targetAudience', value)}
                />
                <TextareaField
                  label="Produtos ou serviços"
                  name="products-or-services"
                  value={form.productsOrServices ?? ''}
                  placeholder="Ex.: Café em grãos, kits de degustação e assinatura mensal."
                  hint="Liste o que pode virar pauta, prova ou oferta."
                  maxLength={600}
                  onChange={(value) =>
                    updateFormField('productsOrServices', value)
                  }
                />
              </div>
            ) : null}

            {activeSection === 'editorial' ? (
              <div className={styles.editorialFields}>
                <TextareaField
                  label="Diferenciais e provas"
                  name="differentials"
                  value={form.differentials ?? ''}
                  placeholder="Ex.: Ingredientes de pequenos produtores, torra semanal e envio em até 24h."
                  hint="O que torna a marca confiável e diferente?"
                  maxLength={400}
                  onChange={(value) => updateFormField('differentials', value)}
                />
                <TextareaField
                  label="Objetivos de conteúdo"
                  name="content-goals"
                  value={form.contentGoals ?? ''}
                  placeholder="Ex.: Educar sobre café especial, gerar pedidos no site e fortalecer a comunidade."
                  hint="Resultado que você quer alcançar com os posts."
                  maxLength={400}
                  onChange={(value) => updateFormField('contentGoals', value)}
                />
                <TextField
                  label="Palavras e expressões para usar"
                  name="keywords"
                  placeholder="Ex.: torra fresca, origem, ritual, café especial"
                  value={form.keywords ?? ''}
                  hint="Separe por vírgulas."
                  onChange={(event) =>
                    updateFormField('keywords', event.target.value)
                  }
                />
                <TextField
                  label="Temas ou termos para evitar"
                  name="avoid-topics"
                  placeholder="Ex.: promessas de cura, descontos agressivos"
                  value={form.avoidTopics ?? ''}
                  hint="A IA vai respeitar estas restrições."
                  onChange={(event) =>
                    updateFormField('avoidTopics', event.target.value)
                  }
                />
                <TextField
                  label="Chamada para ação padrão"
                  name="default-cta"
                  placeholder="Ex.: Conheça o cardápio no site"
                  value={form.defaultCta ?? ''}
                  hint="Pode ser ajustada em cada pedido."
                  onChange={(event) =>
                    updateFormField('defaultCta', event.target.value)
                  }
                />
              </div>
            ) : null}

            <div className={styles.sectionActions}>
              <Button
                type="button"
                variant="secondary"
                disabled={currentSectionIndex === 0}
                onClick={() => moveSection(-1)}
              >
                <ArrowLeft size={14} /> Anterior
              </Button>
              {currentSectionIndex < SECTIONS.length - 1 ? (
                <Button type="button" onClick={() => moveSection(1)}>
                  Próxima etapa <ArrowRight size={14} />
                </Button>
              ) : null}
            </div>
          </div>

          <div className={styles.formFooter}>
            <p>
              <Sparkles size={14} /> Você pode voltar e atualizar o briefing
              quando quiser.
            </p>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar e continuar'}
            </Button>
          </div>
          {saveError ? (
            <p className={styles.saveError} role="alert">
              {saveError}
            </p>
          ) : null}
        </form>

        <aside
          className={styles.previewCard}
          aria-label="Prévia da identidade da marca"
        >
          <p className={styles.previewLabel}>Prévia da identidade</p>
          <div className={styles.previewIdentity}>
            <div
              className={styles.brandMark}
              style={{ background: palette[0] }}
            >
              {form.name.trim().slice(0, 1).toUpperCase() || 'S'}
            </div>
            <div>
              <h2>{form.name || 'Sua marca'}</h2>
              <p>{form.segment}</p>
            </div>
          </div>
          <div
            className={styles.palettePreview}
            aria-label="Paleta selecionada"
          >
            {palette.map((color, index) => (
              <span
                key={`${color}-${index}`}
                title={`${index === 0 ? 'Principal' : 'Apoio'} ${color}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className={styles.previewLine} />
          <div className={styles.contextSummary}>
            <div className={styles.summaryHeader}>
              <span>CONTEXTO CAPTURADO</span>
              <span
                className={
                  hasAiContext ? styles.readyBadge : styles.pendingBadge
                }
              >
                {hasAiContext ? 'Em uso' : 'Adicione contexto'}
              </span>
            </div>
            <dl>
              <div>
                <dt>Público</dt>
                <dd>{targetAudience || 'Ainda não informado'}</dd>
              </div>
              <div>
                <dt>Oferta</dt>
                <dd>{products || 'Ainda não informado'}</dd>
              </div>
              <div>
                <dt>Resumo</dt>
                <dd>
                  {brandDescription ||
                    'Conte o que sua marca faz para orientar a IA.'}
                </dd>
              </div>
            </dl>
          </div>
          <div className={styles.previewLine} />
          <div className={styles.examplePost}>
            <div className={styles.exampleHeader}>
              <span style={{ background: palette[0] }} />
              <div>
                <strong>{form.name || 'Sua marca'}</strong>
                <small>exemplo de direção</small>
              </div>
            </div>
            <p>
              Conteúdo feito para conversar com seu público de um jeito{' '}
              {form.toneOfVoice.toLowerCase()}.
            </p>
            <span className={styles.postTag}>
              {form.keywords?.split(',')[0]?.trim() || '#SuaMarca'}
            </span>
          </div>
          <div className={styles.previewHintRow}>
            <Info size={14} />
            <p>
              A prévia acompanha suas escolhas e mostra os sinais que a IA usará
              nos próximos conteúdos.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
