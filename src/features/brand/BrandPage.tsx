import { useEffect, useId, useState, type FormEvent } from 'react'
import { Check, Info, Palette, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import { BRAND_SEGMENT_OPTIONS } from '../../domain/brandCatalog'
import type { BrandProfile } from '../../domain/models'
import styles from './BrandPage.module.css'

const BRAND_COLORS = ['#4F46E5', '#F97316', '#16A34A', '#171720']

const TONE_OPTIONS = [
  { label: 'Próximo e acolhedor', value: 'Próximo e acolhedor' },
  { label: 'Profissional e objetivo', value: 'Profissional e objetivo' },
  { label: 'Divertido e informal', value: 'Divertido e informal' },
  { label: 'Inspirador', value: 'Inspirador' },
]

const EMPTY_BRAND_PROFILE: BrandProfile = {
  name: '',
  segment: 'Alimentação e bebidas',
  toneOfVoice: 'Próximo e acolhedor',
  primaryColor: '#4F46E5',
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

export function BrandPage() {
  const navigate = useNavigate()
  const { brand, saveBrand } = useApp()
  const [form, setForm] = useState<BrandProfile>({
    ...EMPTY_BRAND_PROFILE,
    ...brand,
  })
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showEditorialGuidance, setShowEditorialGuidance] = useState(
    Boolean(
      brand?.differentials ||
      brand?.contentGoals ||
      brand?.keywords ||
      brand?.avoidTopics ||
      brand?.defaultCta,
    ),
  )

  useEffect(() => {
    if (brand && !hasChanges) setForm({ ...EMPTY_BRAND_PROFILE, ...brand })
  }, [brand, hasChanges])

  function updateFormField<Key extends keyof BrandProfile>(
    field: Key,
    value: BrandProfile[Key],
  ) {
    setHasChanges(true)
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Informe o nome da marca.')
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
      })
      navigate('/chat')
    } catch {
      setSaveError('Não foi possível salvar a marca no Supabase.')
    } finally {
      setIsSaving(false)
    }
  }

  const brandDescription = contextValue(form.description)
  const targetAudience = contextValue(form.targetAudience)
  const products = contextValue(form.productsOrServices)
  const hasAiContext = Boolean(brandDescription || targetAudience || products)

  return (
    <AppShell>
      <PageHeader
        title="Configuração da marca"
        description="Monte um briefing claro para a IA criar conteúdos que tenham a cara do seu negócio."
      />

      <div className={styles.columns}>
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.cardTitle}>
            <span>
              <Palette size={18} />
            </span>
            <div>
              <p className={styles.eyebrow}>ETAPA 1 · FUNDAMENTOS</p>
              <h2>Identidade da marca</h2>
              <p>
                Comece pelo que é fixo em toda comunicação: quem você é e como
                quer ser percebido.
              </p>
            </div>
          </div>

          <section
            className={styles.formSection}
            aria-labelledby="identity-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h3 id="identity-title">Base da identidade</h3>
                <p>
                  Esses dados aparecem como referência em todas as gerações.
                </p>
              </div>
              <span className={styles.stepBadge}>Obrigatório</span>
            </div>
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

              <fieldset className={styles.colorField}>
                <legend>Cor principal</legend>
                <div className={styles.colors}>
                  {BRAND_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Selecionar cor ${color}`}
                      aria-pressed={form.primaryColor === color}
                      style={{ background: color }}
                      className={
                        form.primaryColor === color ? styles.selectedColor : ''
                      }
                      onClick={() => updateFormField('primaryColor', color)}
                    >
                      {form.primaryColor === color ? <Check size={15} /> : null}
                    </button>
                  ))}
                </div>
                <p className={styles.colorValue}>
                  {form.primaryColor} · usada nas prévias e artes sugeridas
                </p>
              </fieldset>
            </div>
          </section>

          <section
            className={styles.formSection}
            aria-labelledby="context-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>ETAPA 2 · CONTEXTO</p>
                <h3 id="context-title">Dê repertório para a IA</h3>
                <p>
                  Quanto mais específico o briefing, menos genérico será o
                  conteúdo. Você pode completar aos poucos.
                </p>
              </div>
              <Info
                size={16}
                className={styles.sectionIcon}
                aria-hidden="true"
              />
            </div>
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
          </section>

          <section
            className={styles.editorialSection}
            aria-labelledby="editorial-title"
          >
            <button
              type="button"
              className={styles.editorialToggle}
              aria-expanded={showEditorialGuidance}
              aria-controls="editorial-fields"
              onClick={() => setShowEditorialGuidance((current) => !current)}
            >
              <span>
                <strong id="editorial-title">Direção editorial</strong>
                <small>Opcional · refine temas, objetivos e chamadas</small>
              </span>
              <span className={styles.toggleChevron} aria-hidden="true">
                {showEditorialGuidance ? '−' : '+'}
              </span>
            </button>
            {showEditorialGuidance ? (
              <div id="editorial-fields" className={styles.editorialFields}>
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
          </section>

          <div className={styles.formFooter}>
            <p>
              <Sparkles size={14} /> Seus dados ficam disponíveis para você
              atualizar quando quiser.
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
          <p className={styles.previewLabel}>Prévia do briefing da IA</p>
          <div
            className={styles.brandMark}
            style={{ background: form.primaryColor }}
          >
            {form.name.trim().slice(0, 1).toUpperCase() || 'S'}
          </div>
          <h2>{form.name || 'Sua marca'}</h2>
          <p>{form.segment}</p>
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
              <span style={{ background: form.primaryColor }} />
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
          <p className={styles.previewHint}>
            A prévia mostra os sinais que a IA vai considerar nos próximos
            conteúdos.
          </p>
        </aside>
      </div>
    </AppShell>
  )
}
