import { CalendarPlus, Image } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { PostDraft } from '../../domain/models'
import styles from './ChatPage.module.css'

interface PostPreviewProps {
  brandName?: string
  draft: PostDraft | null
  isAdding: boolean
  onAdd: () => Promise<void>
}

interface GeneratedPostProps {
  brandName?: string
  draft: PostDraft
  isAdding: boolean
  onAdd: () => Promise<void>
}

export function PostPreview({
  brandName,
  draft,
  isAdding,
  onAdd,
}: PostPreviewProps) {
  return (
    <aside
      id="post-preview"
      className={styles.previewCard}
      aria-label="Prévia do post gerado"
    >
      <div className={styles.previewHeader}>
        <div>
          <p>PRÉVIA DO POST</p>
          <h2>{draft ? 'Rascunho gerado' : 'Aguardando conteúdo'}</h2>
        </div>
        {draft ? <span>RASCUNHO</span> : null}
      </div>

      {draft ? (
        <GeneratedPost
          brandName={brandName}
          draft={draft}
          isAdding={isAdding}
          onAdd={onAdd}
        />
      ) : (
        <EmptyPreview />
      )}
    </aside>
  )
}

function GeneratedPost({
  brandName,
  draft,
  isAdding,
  onAdd,
}: GeneratedPostProps) {
  return (
    <>
      <div className={styles.socialPost}>
        <div className={styles.socialHeader}>
          <div
            className={styles.brandAvatar}
            style={{ background: draft.color }}
          >
            {brandName?.slice(0, 1).toUpperCase() || 'P'}
          </div>
          <div>
            <strong>{brandName || 'Sua marca'}</strong>
            <span>{draft.platform}</span>
          </div>
        </div>

        <div
          className={styles.generatedImage}
          style={{ background: draft.color }}
        >
          <span>
            <Image size={21} />
          </span>
          <strong>
            {draft.visualText.split('\n').map((line) => (
              <span key={line}>{line}</span>
            ))}
          </strong>
          <small>POSTFLOW CREATIVE</small>
        </div>

        <h3>{draft.title}</h3>
        <p>{draft.caption}</p>
        <div className={styles.hashtags}>{draft.hashtags.join(' ')}</div>
      </div>

      <div className={styles.scheduleInfo}>
        <CalendarPlus size={16} />
        <div>
          <span>DATA SUGERIDA</span>
          <strong>
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${draft.date}T12:00:00Z`))}
          </strong>
        </div>
      </div>

      <Button fullWidth type="button" onClick={onAdd} disabled={isAdding}>
        <CalendarPlus size={17} />
        {isAdding ? 'Salvando...' : 'Adicionar à agenda'}
      </Button>
    </>
  )
}

function EmptyPreview() {
  return (
    <div className={styles.emptyPreview}>
      <span>
        <Image size={25} />
      </span>
      <h3>Sua prévia aparecerá aqui</h3>
      <p>Envie um pedido no chat para gerar texto e imagem do post.</p>
    </div>
  )
}
