import { CalendarPlus, Image } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormField'
import type { PostDraft } from '../../domain/models'
import styles from './ChatPage.module.css'

interface PostPreviewProps {
  error?: string
  brandName?: string
  draft: PostDraft | null
  isAdding: boolean
  onAdd: () => Promise<void>
  onChange: (draft: PostDraft) => void
}

interface GeneratedPostProps {
  error?: string
  brandName?: string
  draft: PostDraft
  isAdding: boolean
  onAdd: () => Promise<void>
  onChange: (draft: PostDraft) => void
}

export function PostPreview({
  error,
  brandName,
  draft,
  isAdding,
  onAdd,
  onChange,
}: PostPreviewProps) {
  return (
    <aside
      id="post-preview"
      className={styles.previewCard}
      aria-label="Prévia do post gerado"
    >
      <div className={styles.previewHeader}>
        <div>
          <h2>{draft ? 'Rascunho gerado' : 'Aguardando conteúdo'}</h2>
        </div>
        {draft ? <span>Não publicado</span> : null}
      </div>

      {draft ? (
        <GeneratedPost
          error={error}
          brandName={brandName}
          draft={draft}
          isAdding={isAdding}
          onAdd={onAdd}
          onChange={onChange}
        />
      ) : (
        <EmptyPreview />
      )}
    </aside>
  )
}

function GeneratedPost({
  error,
  brandName,
  draft,
  isAdding,
  onAdd,
  onChange,
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
          <small>Prévia demonstrativa</small>
        </div>

        <h3>{draft.title}</h3>
        <p>{draft.caption}</p>
        <div className={styles.hashtags}>{draft.hashtags.join(' ')}</div>
      </div>

      <form
        className={styles.reviewForm}
        onSubmit={(event) => {
          event.preventDefault()
          void onAdd()
        }}
      >
        <h3>Revise antes de salvar</h3>
        <TextField
          label="Título do post"
          value={draft.title}
          required
          maxLength={160}
          disabled={isAdding}
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
        />
        <label className={styles.reviewCaption}>
          <span>Legenda do post</span>
          <textarea
            value={draft.caption}
            required
            rows={4}
            disabled={isAdding}
            onChange={(event) =>
              onChange({ ...draft, caption: event.target.value })
            }
          />
        </label>
        <TextField
          label="Data do post"
          type="date"
          value={draft.date}
          required
          disabled={isAdding}
          onChange={(event) => onChange({ ...draft, date: event.target.value })}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <Button fullWidth type="submit" disabled={isAdding}>
          <CalendarPlus size={17} />
          {isAdding ? 'Salvando...' : 'Adicionar à agenda'}
        </Button>
        <p className={styles.reviewHint}>
          Salvo como rascunho. Você ainda poderá editar na agenda.
        </p>
      </form>
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
