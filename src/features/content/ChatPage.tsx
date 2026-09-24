import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUp,
  ArrowUpRight,
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
import { DateField } from '../../components/ui/DateField'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import { PostPreview } from './PostPreview'
import {
  draftSchema,
  generationService,
  localDate,
  PLATFORMS,
  type GenerationService,
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
  const { brand, currentWorkspace, addDraft } = useApp()
  const studio = useContentStudio(service)
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState<Platform>('Instagram')
  const [date, setDate] = useState(localDate)
  const [mobilePanel, setMobilePanel] = useState('conversation')
  const [isAdding, setIsAdding] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [promptError, setPromptError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const saving = useRef(false)
  const lastReviewedMessage = useRef<string | null>(null)
  const busy = studio.isGenerating || isAdding
  const latestMessage = studio.messages[studio.messages.length - 1]

  useEffect(() => {
    if (messagesRef.current && studio.messages.length > 0)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [studio.messages.length, studio.isGenerating])

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
    if (busy) return
    if (prompt.trim().length < 3) {
      setPromptError('Descreva sua ideia com pelo menos 3 caracteres.')
      inputRef.current?.focus()
      return
    }
    setPromptError('')
    setSaveError('')
    void studio.generate({
      workspaceId: currentWorkspace?.id,
      prompt: prompt.trim(),
      platform,
      date,
      brand,
      history: studio.messages
        .slice(-12)
        .map(({ role, content }) => ({ role, content })),
      previousDraft: studio.draft,
    })
    setPrompt('')
  }

  async function handleAddToCalendar() {
    if (!studio.draft || saving.current || studio.isGenerating) return
    const result = draftSchema.safeParse(studio.draft)
    if (!result.success) {
      setSaveError(
        'Revise os campos: título de 3 a 160 caracteres, legenda, texto da arte, hashtags sem espaços e uma data válida.',
      )
      return
    }
    saving.current = true
    setIsAdding(true)
    setSaveError('')
    try {
      await addDraft({
        ...result.data,
        hashtags: [...new Set(result.data.hashtags)],
      })
      navigate('/calendar', {
        state: { draftDate: result.data.date, createdDraft: true },
      })
    } catch {
      setSaveError(
        'Não foi possível salvar. Verifique a conexão e a configuração da marca. Seus ajustes continuam aqui.',
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
        description="Descreva sua ideia, revise o resultado e salve um rascunho na agenda."
      >
        <span className={styles.mode}>
          <span />
          {service.mode === 'demo'
            ? 'Modo demonstrativo'
            : 'Assistente de conteúdo'}
        </span>
      </PageHeader>
      <div className={styles.brief}>
        <div className={styles.brandContext}>
          <span className={styles.brandMark}>
            {brand?.name.slice(0, 1) || 'P'}
          </span>
          <div>
            <strong>
              {brand?.name || 'Sua marca ainda não foi configurada'}
            </strong>
            <span>
              {brand?.toneOfVoice ||
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
        <label>
          Rede social
          <span className={styles.platformControl}>
            <SocialPlatformIcon platform={platform} size={18} />
            <select
              value={platform}
              disabled={busy}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              {PLATFORMS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </span>
        </label>
        <DateField
          label="Data sugerida"
          value={date}
          required
          disabled={busy}
          onChange={(e) => setDate(e.target.value || localDate())}
        />
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
          {studio.draft ? 'Rascunho pronto' : 'Rascunho'}
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
                seu rascunho...
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
                Revisar rascunho <ArrowUpRight size={15} />
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
                ? 'Peça um ajuste no rascunho'
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
                disabled={busy}
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
                  <Button type="submit" disabled={isAdding}>
                    <ArrowUp size={16} />
                    {studio.draft ? 'Gerar ajuste' : 'Gerar post'}
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
            brandName={brand?.name}
            draft={studio.draft}
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
