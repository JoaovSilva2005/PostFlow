import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  LoaderCircle,
  MessageSquare,
  Plus,
  Sparkles,
  Square,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { BrandSelector } from '../../components/ui/BrandSelector'
import { DateField } from '../../components/ui/DateField'
import { PostPreview } from './PostPreview'
import {
  draftSchema,
  generationService,
  localDate,
  PLATFORMS,
  type GenerationService,
  type ImageGenerationTier,
  type Platform,
} from './generationService'
import { useContentStudio } from './useContentStudio'
import styles from './ChatPage.module.css'

const suggestions = [
  {
    title: 'Apresentar uma novidade',
    detail: 'Dê destaque ao próximo lançamento.',
    prompt:
      'Crie um post para apresentar uma novidade da nossa marca. Destaque o benefício para o cliente e termine com um convite para conhecer.',
  },
  {
    title: 'Compartilhar conhecimento',
    detail: 'Transforme uma dica em conteúdo útil.',
    prompt:
      'Crie um post com uma dica prática sobre nosso segmento. Use uma linguagem simples e convide o público a compartilhar sua experiência.',
  },
  {
    title: 'Mostrar os bastidores',
    detail: 'Aproxime as pessoas da sua marca.',
    prompt:
      'Crie um post sobre os bastidores da nossa marca, valorizando as pessoas e o cuidado por trás do nosso trabalho.',
  },
]

export function ChatPage({
  service = generationService,
}: {
  service?: GenerationService
}) {
  const navigate = useNavigate()
  const {
    brand,
    currentWorkspace,
    availableWorkspaces,
    addDraftsForWorkspace,
    selectWorkspace,
  } = useApp()
  const studio = useContentStudio(service)
  const [prompt, setPrompt] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>(['Instagram'])
  const [imageTier, setImageTier] = useState<ImageGenerationTier>('standard')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [date, setDate] = useState(localDate)
  const [mobilePanel, setMobilePanel] = useState('conversation')
  const [isAdding, setIsAdding] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [promptError, setPromptError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const platformPickerRef = useRef<HTMLDetailsElement>(null)
  const saving = useRef(false)
  const lastReviewedMessage = useRef<string | null>(null)
  const busy = studio.isGenerating || isAdding
  const pendingCount = Math.max(0, platforms.length - studio.drafts.length)
  const latestMessage = studio.messages[studio.messages.length - 1]
  const selectedWorkspace = availableWorkspaces.find(
    ({ id }) => id === selectedBrandId,
  )
  const selectedBrand = selectedWorkspace?.brand ?? brand

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== platform)
        : PLATFORMS.filter(
            (item) => current.includes(item) || item === platform,
          ),
    )
  }

  useEffect(() => {
    if (
      !selectedBrandId &&
      (currentWorkspace?.id || availableWorkspaces[0]?.id)
    ) {
      setSelectedBrandId(currentWorkspace?.id ?? availableWorkspaces[0].id)
    }
  }, [availableWorkspaces, currentWorkspace?.id, selectedBrandId])

  useEffect(() => {
    if (messagesRef.current && studio.messages.length > 0)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [studio.messages.length, studio.isGenerating])

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const picker = platformPickerRef.current
      if (picker && !picker.contains(event.target as Node)) picker.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && platformPickerRef.current?.open) {
        platformPickerRef.current.open = false
        platformPickerRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    if (mobilePanel === 'draft')
      document.getElementById('post-preview')?.focus()
  }, [mobilePanel])

  useEffect(() => {
    if (
      studio.draft &&
      latestMessage?.role === 'assistant' &&
      latestMessage.id !== lastReviewedMessage.current
    ) {
      lastReviewedMessage.current = latestMessage.id
      setMobilePanel('draft')
    }
  }, [studio.draft, latestMessage])

  function handleGenerate(event: FormEvent) {
    event.preventDefault()
    if (busy || (studio.draft && pendingCount > 0)) return
    if (prompt.trim().length < 3) {
      setPromptError('Descreva sua ideia com pelo menos 3 caracteres.')
      inputRef.current?.focus()
      return
    }
    setPromptError('')
    setSaveError('')
    const request = {
      workspaceId: selectedBrandId || currentWorkspace?.id,
      prompt: prompt.trim(),
      imageTier,
      date,
      brand: selectedBrand,
      history: studio.messages
        .slice(-12)
        .map(({ role, content }) => ({ role, content })),
    }
    if (studio.draft) {
      void studio.generate({
        ...request,
        platform: studio.draft.platform as Platform,
        previousDraft: studio.draft,
      })
    } else {
      const requests = platforms.map((platform) => ({
        ...request,
        platform,
        previousDraft: null,
      }))
      void (requests.length === 1
        ? studio.generate(requests[0])
        : studio.generateMany(requests))
    }
    setPrompt('')
  }

  async function handleAddToCalendar() {
    if (
      !studio.drafts.length ||
      pendingCount > 0 ||
      saving.current ||
      studio.isGenerating
    )
      return
    const drafts = []
    for (const draft of studio.drafts) {
      const result = draftSchema.safeParse(draft)
      if (!result.success) {
        studio.setActivePlatform(draft.platform)
        setSaveError(
          `Revise o rascunho de ${draft.platform}: título de 3 a 160 caracteres, legenda, texto da arte, hashtags sem espaços e uma data válida.`,
        )
        return
      }
      drafts.push({
        ...result.data,
        hashtags: [...new Set(result.data.hashtags)],
      })
    }
    saving.current = true
    setIsAdding(true)
    setSaveError('')
    try {
      const targetWorkspaceId = studio.draftWorkspaceId || currentWorkspace?.id
      if (!targetWorkspaceId) throw new Error('Selecione uma marca.')
      await addDraftsForWorkspace(targetWorkspaceId, drafts)
      if (targetWorkspaceId !== currentWorkspace?.id) {
        await selectWorkspace(targetWorkspaceId)
      }
      navigate('/calendar', {
        state: {
          draftDate: drafts[0].date,
          createdDraft: true,
          createdDraftCount: drafts.length,
        },
      })
    } catch {
      setSaveError(
        'Não foi possível salvar os rascunhos. Verifique a conexão e a configuração da marca. Seus ajustes continuam aqui.',
      )
    } finally {
      saving.current = false
      setIsAdding(false)
    }
  }

  function startOver() {
    studio.reset()
    setPrompt('')
    setSaveError('')
    setPromptError('')
    setConfirmReset(false)
    setMobilePanel('conversation')
    inputRef.current?.focus()
  }

  return (
    <AppShell>
      <PageHeader
        title="Criar com IA"
        description="Descreva sua ideia, revise cada rede e salve os rascunhos na agenda."
      >
        <span className={styles.mode}>
          <span />
          {service.mode === 'demo' ? 'Modo demonstrativo' : 'Geração via API'}
        </span>
      </PageHeader>
      <div className={styles.brief}>
        <BrandSelector
          value={selectedBrandId || currentWorkspace?.id || ''}
          disabled={busy || studio.drafts.length > 0}
          onChange={setSelectedBrandId}
        />
        <div className={styles.brandContext}>
          <span className={styles.brandMark}>
            {selectedBrand?.name.slice(0, 1) || 'P'}
          </span>
          <div>
            <strong>
              {selectedBrand?.name || 'Sua marca ainda não foi configurada'}
            </strong>
            <span>
              {selectedBrand?.toneOfVoice ||
                'Configure a marca para personalizar e salvar seus posts.'}
            </span>
          </div>
          <Link
            to="/brand"
            aria-label="Configurar marca"
            title="Configurar marca"
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className={styles.platformField}>
          <span id="studio-platform-label">Redes sociais</span>
          <details ref={platformPickerRef} className={styles.platformPicker}>
            <summary aria-label={`Redes sociais: ${platforms.join(', ')}`}>
              <span>
                {platforms.length === 1
                  ? platforms[0]
                  : `${platforms.length} redes selecionadas`}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div
              className={styles.platformOptions}
              role="group"
              aria-labelledby="studio-platform-label"
            >
              {PLATFORMS.map((platform) => (
                <label key={platform}>
                  <input
                    type="checkbox"
                    checked={platforms.includes(platform)}
                    disabled={
                      busy ||
                      studio.drafts.length > 0 ||
                      (platforms.length === 1 && platforms[0] === platform)
                    }
                    onChange={() => togglePlatform(platform)}
                  />
                  {platform}
                </label>
              ))}
            </div>
          </details>
          <small>Um rascunho separado por rede.</small>
        </div>
        <DateField
          label="Data sugerida"
          className={styles.briefField}
          value={date}
          required
          disabled={busy || studio.drafts.length > 0}
          onChange={(e) => setDate(e.target.value || localDate())}
        />
        {service.mode === 'api' ? (
          <label className={styles.imageTierField}>
            Qualidade da imagem
            <select
              aria-label="Qualidade da imagem"
              value={imageTier}
              disabled={busy || studio.drafts.length > 0}
              onChange={(event) =>
                setImageTier(event.target.value as ImageGenerationTier)
              }
            >
              <option value="standard">Padrão · GPT Image 2.5 Flare</option>
              <option value="quality">
                Mais qualidade · GPT Image 2.5 Sunburst
              </option>
            </select>
          </label>
        ) : null}
      </div>
      <div className={styles.mobileSwitch} aria-label="Painel do estúdio">
        <button
          type="button"
          aria-pressed={mobilePanel === 'conversation'}
          onClick={() => setMobilePanel('conversation')}
        >
          Conversa
        </button>
        <button
          type="button"
          aria-pressed={mobilePanel === 'draft'}
          onClick={() => setMobilePanel('draft')}
        >
          {studio.drafts.length > 1
            ? `${studio.drafts.length} rascunhos`
            : studio.draft
              ? 'Rascunho pronto'
              : 'Rascunho'}
        </button>
      </div>
      <div className={styles.workspace}>
        <section
          className={`${styles.conversation} ${mobilePanel !== 'conversation' ? styles.mobileHidden : ''}`}
          aria-label="Conversa com a inteligência artificial"
        >
          <header className={styles.panelHeader}>
            <span>
              <MessageSquare size={16} /> Conversa
            </span>
            <button
              type="button"
              className={styles.textButton}
              disabled={busy || !studio.messages.length}
              onClick={() => setConfirmReset(true)}
            >
              <Plus size={15} /> Nova criação
            </button>
          </header>
          {confirmReset && (
            <div className={styles.resetNotice} role="alert">
              <p>Descartar esta conversa e o rascunho não salvo?</p>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Continuar editando
              </Button>
              <Button variant="danger" onClick={startOver}>
                Descartar e começar
              </Button>
            </div>
          )}
          <div
            className={styles.messages}
            ref={messagesRef}
            role="log"
            aria-label="Histórico da conversa"
          >
            {!studio.messages.length && (
              <div className={styles.welcome}>
                <Sparkles size={25} strokeWidth={1.4} />
                <h2>
                  O que sua marca
                  <br />
                  tem para contar?
                </h2>
                <p>
                  Conte o assunto, para quem é o post e o que você quer
                  destacar. Ou comece por uma ideia.
                </p>
                <div className={styles.suggestions}>
                  {suggestions.map((item) => (
                    <button
                      type="button"
                      key={item.title}
                      onClick={() => {
                        setPrompt(item.prompt)
                        inputRef.current?.focus()
                      }}
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {studio.messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'user'
                    ? styles.userMessage
                    : styles.assistantMessage
                }
              >
                <small>{message.role === 'user' ? 'Você' : 'PostFlow'}</small>
                <p>{message.content}</p>
              </article>
            ))}
            {studio.isGenerating && (
              <p className={styles.loading} role="status">
                <LoaderCircle className={styles.spinner} size={16} /> Preparando
                {platforms.length > 1
                  ? ' seus rascunhos...'
                  : ' seu rascunho...'}
              </p>
            )}
            {studio.draft && !studio.isGenerating && (
              <button
                type="button"
                className={styles.reviewLink}
                onClick={() => {
                  setMobilePanel('draft')
                  document.getElementById('post-preview')?.focus()
                }}
              >
                {studio.drafts.length > 1
                  ? `Revisar ${studio.drafts.length} rascunhos`
                  : 'Revisar rascunho'}{' '}
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
          <form className={styles.composer} onSubmit={handleGenerate}>
            {studio.error && (
              <div className={styles.error} role="alert">
                <p>{studio.error}</p>
                {studio.retry && (
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={busy}
                    onClick={() => void studio.retry?.()}
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            )}
            <label htmlFor="studio-prompt" className={styles.composerLabel}>
              {studio.draft
                ? `Peça um ajuste no rascunho de ${studio.draft.platform}`
                : 'Descreva sua ideia'}
            </label>
            <div className={styles.inputBox}>
              <textarea
                id="studio-prompt"
                ref={inputRef}
                aria-label="Pedido para a IA"
                aria-invalid={Boolean(promptError)}
                aria-describedby={
                  promptError ? 'prompt-error' : 'generation-disclaimer'
                }
                value={prompt}
                disabled={busy || (Boolean(studio.draft) && pendingCount > 0)}
                maxLength={2000}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  studio.draft
                    ? 'Ex.: deixe a legenda mais curta e direta…'
                    : 'Ex.: um post sobre nosso novo serviço, para pequenos negócios…'
                }
                rows={3}
              />
              <div className={styles.composerActions}>
                <small>{prompt.length}/2000</small>
                {studio.isGenerating ? (
                  <Button type="button" variant="ghost" onClick={studio.cancel}>
                    <Square size={13} /> Cancelar
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={
                      isAdding || (Boolean(studio.draft) && pendingCount > 0)
                    }
                  >
                    <ArrowUp size={16} />
                    {studio.draft
                      ? 'Gerar ajuste'
                      : platforms.length > 1
                        ? `Gerar ${platforms.length} posts`
                        : 'Gerar post'}
                  </Button>
                )}
              </div>
            </div>
            {promptError && (
              <p className={styles.error} id="prompt-error" role="alert">
                {promptError}
              </p>
            )}
            <p id="generation-disclaimer" className={styles.disclaimer}>
              {service.mode === 'demo'
                ? 'Simulação por modelos de texto. A arte exibida é uma composição ilustrativa.'
                : platforms.length > 1
                  ? 'Cada rede gera um texto e uma imagem próprios e usa a franquia do plano. Revise antes de salvar.'
                  : 'Revise as informações geradas antes de salvar. Nada será publicado automaticamente.'}
            </p>
            <span className={styles.srOnly} aria-live="polite">
              {studio.notice}
            </span>
          </form>
        </section>
        <div
          className={`${styles.reviewPanel} ${mobilePanel !== 'draft' ? styles.mobileHidden : ''}`}
        >
          <PostPreview
            brandName={selectedBrand?.name}
            draft={studio.draft}
            drafts={studio.drafts}
            activePlatform={studio.draft?.platform ?? null}
            onSelectPlatform={studio.setActivePlatform}
            pendingCount={pendingCount}
            generationIssue={studio.error}
            onRetry={studio.retry}
            isAdding={isAdding}
            isGenerating={studio.isGenerating}
            error={saveError}
            onAdd={handleAddToCalendar}
            onChange={(draft) => {
              studio.setDraft(draft)
              setSaveError('')
            }}
          />
        </div>
      </div>
    </AppShell>
  )
}
