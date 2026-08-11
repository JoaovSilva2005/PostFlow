import { useState, type FormEvent } from 'react'
import { AtSign, Check, LoaderCircle, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import type { PostDraft } from '../../domain/models'
import { MockAiService } from '../../services/mockAiService'
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
  const [platform, setPlatform] = useState('Instagram')
  const [isGenerating, setIsGenerating] = useState(false)
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [error, setError] = useState('')

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    const normalizedPrompt = prompt.trim()

    if (!normalizedPrompt) {
      setError('Descreva o post que você quer criar.')
      return
    }

    setError('')
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

  function handleAddToCalendar() {
    if (!draft) {
      return
    }

    addDraft(draft)
    navigate('/calendar')
  }

  return (
    <AppShell>
      <header className={styles.pageHeader}>
        <div>
          <p>ASSISTENTE CRIATIVO</p>
          <h1>Chat e geração de posts</h1>
          <span>
            Conte o que precisa. O PostFlow prepara um rascunho para sua agenda.
          </span>
        </div>
        <div className={styles.aiStatus}>
          <span /> IA simulada disponível
        </div>
      </header>

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

          <div className={styles.messages} aria-live="polite">
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
            {prompt && isGenerating ? (
              <div className={styles.userMessage}>{prompt}</div>
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
                  <strong>{draft.platform}</strong>. Revise a prévia ao lado.
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
                disabled={isGenerating}
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
          brandName={brand?.name}
          draft={draft}
          onAdd={handleAddToCalendar}
        />
      </div>
    </AppShell>
  )
}
