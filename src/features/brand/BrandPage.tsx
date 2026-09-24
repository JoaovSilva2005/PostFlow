import { useEffect, useState, type FormEvent } from 'react'
import { Check, Palette, Sparkles } from 'lucide-react'
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
}

export function BrandPage() {
  const navigate = useNavigate()
  const { brand, saveBrand } = useApp()
  const [form, setForm] = useState<BrandProfile>(brand ?? EMPTY_BRAND_PROFILE)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (brand && !hasChanges) setForm(brand)
  }, [brand, hasChanges])

  function updateFormField<Key extends keyof BrandProfile>(
    field: Key,
    value: BrandProfile[Key],
  ) {
    setHasChanges(true)
    if (field === 'name') setError('')
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSaving) return

    if (!form.name.trim()) {
      setError('Informe o nome da marca.')
      document.getElementById('brand-name')?.focus()
      return
    }

    setError('')
    setSaveError('')
    setIsSaving(true)

    try {
      await saveBrand({ ...form, name: form.name.trim() })
      navigate('/chat')
    } catch {
      setSaveError(
        'Não foi possível salvar a marca. Verifique sua conexão e tente novamente. Seus ajustes continuam aqui.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Configuração da marca"
        description="Defina como sua marca aparece e conversa com o público."
      />

      <div className={styles.columns}>
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.cardTitle}>
            <span>
              <Palette size={18} />
            </span>
            <div>
              <h2>Identidade da marca</h2>
              <p>
                Essas informações serão usadas pela IA para personalizar seus
                posts.
              </p>
            </div>
          </div>

          <fieldset className={styles.formGrid} disabled={isSaving}>
            <legend className="sr-only">Informações da marca</legend>
            <TextField
              label="Nome da marca"
              name="brand-name"
              placeholder="Ex.: Café Aurora"
              value={form.name}
              onChange={(event) => updateFormField('name', event.target.value)}
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
              hint="Escolha o segmento mais próximo da sua atividade."
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
                {form.primaryColor} · Cor aplicada à prévia
              </p>
            </fieldset>
          </fieldset>

          <div className={styles.formFooter}>
            <p>
              <Sparkles size={14} /> Você poderá alterar essas informações
              quando quiser.
            </p>
            <Button type="submit" loading={isSaving}>
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
          <p className={styles.previewLabel}>Sua identidade, em contexto</p>
          <div
            className={styles.brandMark}
            style={{ background: form.primaryColor }}
          >
            {form.name.trim().slice(0, 1).toUpperCase() || 'S'}
          </div>
          <h2>{form.name || 'Sua marca'}</h2>
          <p>{form.segment}</p>
          <div className={styles.previewLine} />
          <div className={styles.examplePost}>
            <div className={styles.exampleHeader}>
              <span style={{ background: form.primaryColor }} />
              <div>
                <strong>{form.name || 'Sua marca'}</strong>
                <small>agora</small>
              </div>
            </div>
            <p>
              Conteúdo feito para conversar com seu público de um jeito{' '}
              {form.toneOfVoice.toLowerCase()}.
            </p>
            <span className={styles.postTag}>#SuaMarca</span>
          </div>
          <p className={styles.previewHint}>
            A prévia é atualizada enquanto você configura.
          </p>
        </aside>
      </div>
    </AppShell>
  )
}
