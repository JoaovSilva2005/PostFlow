import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AtSign, Check, LoaderCircle, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppShell } from '../../components/AppShell/AppShell'
import type { PostDraft } from '../../domain/models'
import { MockAiService } from './mockAiService'
import { PostPreview } from './PostPreview'
import styles from './ChatPage.module.css'

const PLATFORM_OPTIONS = ['Instagram', 'LinkedIn', 'Facebook']

const PROMPT_SUGGESTIONS = [
  {
    label: 'Post para sexta-feira',
    prompt: 'Um post de sexta-feira sobre nosso café especial',
  },
  {
    label: 'Divulgar uma novidade',
    prompt: 'Divulgue uma novidade da marca de forma acolhedora',
  },
]

export function ChatPage() {
  const navigate = useNavigate()
  const { brand, addDraft } = useApp()
  const [prompt, setPrompt] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [platform, setPlatform] = useState('Instagram')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const messages = messagesRef.current
    if (messages) messages.scrollTop = messages.scrollHeight
  }, [draft?.id, isGenerating])

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    const normalizedPrompt = prompt.trim()

    if (!normalizedPrompt) {
      setError('Descreva o post que você quer criar.')
      return
    }

    setError('')
    setSubmittedPrompt(normalizedPrompt)
    setSaveError('')
    setDraft(null)
    setIsGenerating(true)

    try {
      const result = await MockAiService.generate({
        prompt: normalizedPrompt,
        platform,
      })

      setDraft({ ...result, color: brand?.primaryColor ?? result.color })
    } catch {
      setError('Não foi possível gerar o post. Tente novamente.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleAddToCalendar() {
    if (!draft) {
      return
    }

    if (!draft.title.trim() || !draft.caption.trim() || !draft.date) {
      setSaveError('Preencha o título, a legenda e a data antes de salvar.')
      return
    }
    setSaveError('')
    setIsAdding(true)

    try {
      await addDraft({
        ...draft,
        title: draft.title.trim(),
        caption: draft.caption.trim(),
      })
      navigate('/calendar', {
        state: { draftDate: draft.date, createdDraft: true },
      })
    } catch {
      setSaveError(
        'O rascunho não foi salvo. Confira sua conexão e tente novamente; seus ajustes continuam aqui.',
      )
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Chat e geração de posts"
        description="Descreva sua ideia, revise o conteúdo e escolha quando usá-lo."
      >
        <div className={styles.aiStatus}>
          <span /> Geração demonstrativa
        </div>
      </PageHeader>

      <div className={styles.workspace}>
        <section
          className={styles.chatCard}
          aria-label="Conversa com a inteligência artificial"
        >
          <div className={styles.chatHeader}>
            <div className={styles.aiAvatar}>
              <Sparkles size={18} />
            </div>
            <div>
              <strong>Assistente PostFlow</strong>
              <span>Conteúdo alinhado à sua marca</span>
            </div>
          </div>

          <div ref={messagesRef} className={styles.messages} aria-live="polite">
            <div className={styles.assistantMessage}>
              <span>
                <Sparkles size={13} />
              </span>
              <p>
                Olá! O que vamos criar hoje para{' '}
                <strong>{brand?.name || 'sua marca'}</strong>?
              </p>
            </div>
            <div className={styles.suggestions}>
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => setPrompt(suggestion.prompt)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
            {submittedPrompt ? (
              <div className={styles.userMessage}>{submittedPrompt}</div>
            ) : null}
            {isGenerating ? (
              <div className={styles.loadingMessage}>
                <LoaderCircle size={16} /> Criando texto e imagem...
              </div>
            ) : null}
            {draft ? (
              <div className={styles.assistantMessage}>
                <span>
                  <Check size={13} />
                </span>
                <p>
                  Pronto! Criei um rascunho para{' '}
                  <strong>{draft.platform}</strong>.{' '}
                  <a href="#post-preview">Revisar prévia</a> antes de adicionar
                  à agenda.
                </p>
              </div>
            ) : null}
          </div>

          <form className={styles.composer} onSubmit={handleGenerate}>
            <div className={styles.platformRow}>
              <label htmlFor="platform">
                <AtSign size={14} /> Plataforma
              </label>
              <select
                id="platform"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div
              className={`${styles.textareaWrap} ${error ? styles.invalid : ''}`}
            >
              <textarea
                aria-label="Pedido para a IA"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'prompt-error' : 'prompt-help'}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex.: Crie um post sobre nosso café especial de sexta-feira..."
                rows={3}
              />
              <button
                type="submit"
                disabled={isGenerating || isAdding}
                aria-label="Gerar post"
              >
                {isGenerating ? (
                  <LoaderCircle className={styles.spinner} size={17} />
                ) : (
                  <Send size={17} />
                )}
              </button>
            </div>
            {error ? (
              <p id="prompt-error" className={styles.error}>
                {error}
              </p>
            ) : null}
            <p id="prompt-help" className={styles.disclaimer}>
              A geração desta versão é simulada para demonstração acadêmica.
            </p>
          </form>
        </section>

        <PostPreview
          error={saveError}
          brandName={brand?.name}
          draft={draft}
          isAdding={isAdding}
          onAdd={handleAddToCalendar}
          onChange={(nextDraft) => {
            setDraft(nextDraft)
            setSaveError('')
          }}
        />
      </div>
    </AppShell>
  )
}
