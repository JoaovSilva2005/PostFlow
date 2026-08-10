import { useState, type FormEvent } from 'react'
import { AtSign, CalendarPlus, Check, Image, LoaderCircle, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import type { PostDraft } from '../../domain/models'
import { MockAiService } from '../../services/mockAiService'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const navigate = useNavigate()
  const { brand, addDraft } = useApp()
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState('Instagram')
  const [isGenerating, setIsGenerating] = useState(false)
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    if (!prompt.trim()) {
      setError('Descreva o post que você quer criar.')
      return
    }
    setError('')
    setAdded(false)
    setIsGenerating(true)
    const result = await MockAiService.generate({ prompt, platform })
    setDraft({ ...result, color: brand?.primaryColor ?? result.color })
    setIsGenerating(false)
  }

  function handleAddToCalendar() {
    if (!draft || added) return
    addDraft(draft)
    setAdded(true)
    window.setTimeout(() => navigate('/calendar'), 500)
  }

  return (
    <AppShell>
      <header className={styles.pageHeader}>
        <div>
          <p>ASSISTENTE CRIATIVO</p>
          <h1>Chat e geração de posts</h1>
          <span>Conte o que precisa. O PostFlow prepara um rascunho para sua agenda.</span>
        </div>
        <div className={styles.aiStatus}><span /> IA simulada disponível</div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.chatCard} aria-label="Conversa com a inteligência artificial">
          <div className={styles.chatHeader}>
            <div className={styles.aiAvatar}><Sparkles size={18} /></div>
            <div><strong>Assistente PostFlow</strong><span>Conteúdo alinhado à sua marca</span></div>
          </div>

          <div className={styles.messages} aria-live="polite">
            <div className={styles.assistantMessage}>
              <span><Sparkles size={13} /></span>
              <p>Olá! O que vamos criar hoje para <strong>{brand?.name || 'sua marca'}</strong>?</p>
            </div>
            <div className={styles.suggestions}>
              <button type="button" onClick={() => setPrompt('Um post de sexta-feira sobre nosso café especial')}>
                Post para sexta-feira
              </button>
              <button type="button" onClick={() => setPrompt('Divulgue uma novidade da marca de forma acolhedora')}>
                Divulgar uma novidade
              </button>
            </div>
            {prompt && isGenerating ? <div className={styles.userMessage}>{prompt}</div> : null}
            {isGenerating ? (
              <div className={styles.loadingMessage}><LoaderCircle size={16} /> Criando texto e imagem...</div>
            ) : null}
            {draft ? (
              <div className={styles.assistantMessage}>
                <span><Check size={13} /></span>
                <p>Pronto! Criei um rascunho para <strong>{draft.platform}</strong>. Revise a prévia ao lado.</p>
              </div>
            ) : null}
          </div>

          <form className={styles.composer} onSubmit={handleGenerate}>
            <div className={styles.platformRow}>
              <label htmlFor="platform"><AtSign size={14} /> Plataforma</label>
              <select id="platform" value={platform} onChange={(event) => setPlatform(event.target.value)}>
                <option>Instagram</option>
                <option>LinkedIn</option>
                <option>Facebook</option>
              </select>
            </div>
            <div className={`${styles.textareaWrap} ${error ? styles.invalid : ''}`}>
              <textarea
                aria-label="Pedido para a IA"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex.: Crie um post sobre nosso café especial de sexta-feira..."
                rows={3}
              />
              <button type="submit" disabled={isGenerating} aria-label="Gerar post">
                {isGenerating ? <LoaderCircle className={styles.spinner} size={17} /> : <Send size={17} />}
              </button>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <p className={styles.disclaimer}>A geração desta versão é simulada para demonstração acadêmica.</p>
          </form>
        </section>

        <aside className={styles.previewCard} aria-label="Prévia do post gerado">
          <div className={styles.previewHeader}>
            <div><p>PRÉVIA DO POST</p><h2>{draft ? 'Rascunho gerado' : 'Aguardando conteúdo'}</h2></div>
            {draft ? <span>RASCUNHO</span> : null}
          </div>

          {draft ? (
            <>
              <div className={styles.socialPost}>
                <div className={styles.socialHeader}>
                  <div className={styles.brandAvatar} style={{ background: draft.color }}>
                    {brand?.name?.slice(0, 1).toUpperCase() || 'P'}
                  </div>
                  <div><strong>{brand?.name || 'Sua marca'}</strong><span>{draft.platform}</span></div>
                </div>
                <div className={styles.generatedImage} style={{ background: draft.color }}>
                  <span><Image size={21} /></span>
                  <strong>{draft.visualText.split('\n').map((line) => <span key={line}>{line}</span>)}</strong>
                  <small>POSTFLOW CREATIVE</small>
                </div>
                <h3>{draft.title}</h3>
                <p>{draft.caption}</p>
                <div className={styles.hashtags}>{draft.hashtags.join(' ')}</div>
              </div>
              <div className={styles.scheduleInfo}>
                <CalendarPlus size={16} />
                <div><span>DATA SUGERIDA</span><strong>14 de agosto de 2026</strong></div>
              </div>
              <Button fullWidth type="button" onClick={handleAddToCalendar} disabled={added}>
                {added ? <><Check size={17} /> Adicionado</> : <><CalendarPlus size={17} /> Adicionar à agenda</>}
              </Button>
            </>
          ) : (
            <div className={styles.emptyPreview}>
              <span><Image size={25} /></span>
              <h3>Sua prévia aparecerá aqui</h3>
              <p>Envie um pedido no chat para gerar texto e imagem do post.</p>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  )
}
