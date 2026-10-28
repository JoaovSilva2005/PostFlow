import { useEffect, useState, type CSSProperties } from 'react'
import {
  CalendarPlus,
  Image,
  LoaderCircle,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DateField } from '../../components/ui/DateField'
import { TextField } from '../../components/ui/FormField'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import type { PostDraft } from '../../domain/models'
import { getSocialImagePreset } from '../../../shared/domain/socialImagePresets'
import type { Platform } from './generationService'
import styles from './ChatPage.module.css'

interface PostPreviewProps {
  error?: string
  brandName?: string
  draft: PostDraft | null
  drafts: PostDraft[]
  activePlatform: Platform | null
  platforms: Platform[]
  pendingPlatforms: Platform[]
  failedPlatforms: Platform[]
  onSelectPlatform: (platform: Platform) => void
  pendingCount: number
  generationIssue?: string
  onRetry: (() => Promise<void>) | null
  isAdding: boolean
  isGenerating: boolean
  onAdd: () => Promise<void>
  onChange: (draft: PostDraft) => void
}

export function PostPreview({
  error,
  brandName,
  draft,
  drafts,
  activePlatform,
  platforms,
  pendingPlatforms,
  failedPlatforms,
  onSelectPlatform,
  pendingCount,
  generationIssue,
  onRetry,
  isAdding,
  isGenerating,
  onAdd,
  onChange,
}: PostPreviewProps) {
  const [view, setView] = useState('preview')
  const disabled = isAdding || isGenerating
  const previewPlatform =
    activePlatform ?? (draft?.platform as Platform | undefined) ?? platforms[0] ?? null
  const activePlatformIsPending = Boolean(
    previewPlatform && pendingPlatforms.includes(previewPlatform),
  )
  const activePlatformFailed = Boolean(
    previewPlatform && failedPlatforms.includes(previewPlatform),
  )
  const artworkStyle = previewPlatform
    ? ({
        aspectRatio: getSocialImagePreset(
          previewPlatform,
          draft?.format,
        ).previewAspectRatio,
      } satisfies CSSProperties)
    : undefined
  const platformTabs =
    platforms.length > 1 ? (
      <div className={styles.platformTabs} aria-label="Rascunhos por rede">
        {platforms.map((platform) => {
          const isPending = pendingPlatforms.includes(platform)
          const hasFailed = failedPlatforms.includes(platform)
          return (
            <button
              key={platform}
              type="button"
              aria-label={`Revisar rascunho de ${platform}`}
              aria-pressed={activePlatform === platform}
              aria-busy={isPending}
              data-failed={hasFailed || undefined}
              onClick={() => onSelectPlatform(platform)}
            >
              {isPending ? (
                <LoaderCircle
                  size={15}
                  className={styles.spinner}
                  aria-hidden="true"
                />
              ) : (
                <SocialPlatformIcon platform={platform} size={15} />
              )}
              {platform}
            </button>
          )
        })}
      </div>
    ) : null
  useEffect(() => {
    if (!draft) setView('preview')
  }, [draft])
  return (
    <aside
      id="post-preview"
      tabIndex={-1}
      className={styles.preview}
      aria-label="Prévia do post gerado"
    >
      <header className={styles.panelHeader}>
        <h2>
          {draft
            ? drafts.length > 1
              ? 'Revise seus rascunhos'
              : 'Revise seu rascunho'
            : isGenerating && previewPlatform
              ? `Preparando ${previewPlatform}`
              : 'Seu rascunho'}
        </h2>
        <span className={styles.unpublished}>Não publicado</span>
      </header>
      {platformTabs}
      {draft ? (
        <>
          <div
            className={styles.previewSwitch}
            aria-label="Visualização do rascunho"
          >
            <button
              type="button"
              aria-pressed={view === 'preview'}
              onClick={() => setView('preview')}
            >
              Prévia
            </button>
            <button
              type="button"
              aria-pressed={view === 'edit'}
              onClick={() => setView('edit')}
            >
              Editar conteúdo
            </button>
          </div>
          <div className={styles.reviewBody}>
            {view === 'preview' ? (
              <div className={styles.socialPost}>
                <div className={styles.socialHeader}>
                  <span
                    className={styles.brandMark}
                    style={{ borderColor: draft.color }}
                  >
                    {brandName?.slice(0, 1) || 'P'}
                  </span>
                  <div>
                    <strong>{brandName || 'Sua marca'}</strong>
                    <small>
                      <SocialPlatformIcon platform={draft.platform} size={13} />
                      {draft.platform}
                    </small>
                  </div>
                  <MoreHorizontal size={18} aria-hidden="true" />
                </div>
                {draft.imageUrl ? (
                  <div
                    className={styles.generatedArtwork}
                    style={artworkStyle}
                  >
                    <img
                      src={draft.imageUrl}
                      alt={`Arte gerada para ${draft.title}`}
                    />
                    <span>Arte gerada por IA</span>
                    {activePlatformIsPending ? (
                      <div className={styles.imageLoadingOverlay} role="status">
                        <LoaderCircle
                          size={20}
                          className={styles.spinner}
                          aria-hidden="true"
                        />
                        Atualizando texto e imagem...
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div
                    className={styles.artwork}
                    style={{ ...artworkStyle, backgroundColor: draft.color }}
                  >
                    <div className={styles.artworkShade} />
                    <span>{brandName || 'Sua marca'}</span>
                    <strong>{draft.visualText}</strong>
                    <small>Composição ilustrativa</small>
                    {activePlatformIsPending ? (
                      <div className={styles.imageLoadingOverlay} role="status">
                        <LoaderCircle
                          size={20}
                          className={styles.spinner}
                          aria-hidden="true"
                        />
                        Gerando texto e imagem...
                      </div>
                    ) : null}
                  </div>
                )}
                <div className={styles.postCopy}>
                  <h3>{draft.title}</h3>
                  <p>{draft.caption}</p>
                  <span>{draft.hashtags.join(' ')}</span>
                </div>
                <p className={styles.previewHint}>
                  Prévia ilustrativa. O resultado na rede social pode variar.
                </p>
              </div>
            ) : (
              <div className={styles.reviewForm}>
                <TextField
                  label="Título do post"
                  value={draft.title}
                  required
                  maxLength={160}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ ...draft, title: e.target.value })
                  }
                />
                {draft.imageUrl ? (
                  <p className={styles.previewHint}>
                    A arte foi gerada junto com o rascunho. A legenda continua
                    editável e a imagem permanece disponível nesta revisão.
                  </p>
                ) : null}
                <label>
                  Legenda do post
                  <textarea
                    aria-label="Legenda do post"
                    value={draft.caption}
                    maxLength={5000}
                    rows={6}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({ ...draft, caption: e.target.value })
                    }
                  />
                  <small>{draft.caption.length}/5000 caracteres</small>
                </label>
                <TextField
                  label="Texto da arte"
                  value={draft.visualText}
                  maxLength={160}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ ...draft, visualText: e.target.value })
                  }
                />
                <TextField
                  label="Hashtags"
                  value={draft.hashtags.join(' ')}
                  disabled={disabled}
                  placeholder="#SuaMarca #Novidades"
                  onChange={(e) =>
                    onChange({ ...draft, hashtags: e.target.value.split(' ') })
                  }
                  onBlur={() =>
                    onChange({
                      ...draft,
                      hashtags: draft.hashtags.filter(Boolean),
                    })
                  }
                />
                <p className={styles.previewHint}>
                  Separe as hashtags por espaço. O título identifica o post na
                  agenda.
                </p>
              </div>
            )}
          </div>
          <footer className={styles.reviewFooter}>
            <DateField
              label="Data do post"
              value={draft.date}
              required
              disabled={disabled}
              onChange={(e) => onChange({ ...draft, date: e.target.value })}
            />
            {error && (
              <p className={styles.error} role="alert">
                {error}{' '}
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setView('edit')}
                >
                  Revisar campos
                </button>
              </p>
            )}
            {pendingCount > 0 ? (
              <>
                <p className={styles.pendingDrafts}>
                  Faltam {pendingCount} {pendingCount === 1 ? 'rede' : 'redes'}.
                  {generationIssue
                    ? ` ${generationIssue}`
                    : ' Conclua a geração antes de salvar.'}
                </p>
                {onRetry ? (
                  <Button
                    fullWidth
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => void onRetry()}
                  >
                    Tentar gerar novamente
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              fullWidth
              disabled={disabled || pendingCount > 0}
              onClick={() => void onAdd()}
            >
              <CalendarPlus size={16} />
              {isAdding
                ? 'Salvando...'
                : drafts.length > 1
                  ? `Adicionar ${drafts.length} à agenda`
                  : 'Adicionar à agenda'}
            </Button>
            <p>
              Ao adicionar, cada rede terá um rascunho separado na agenda. Nada
              será publicado automaticamente.
            </p>
          </footer>
        </>
      ) : activePlatformIsPending && previewPlatform ? (
        <div className={styles.pendingPreview}>
          <div
            className={styles.pendingArtwork}
            style={artworkStyle}
            role="status"
            aria-live="polite"
            aria-label={`Gerando texto e imagem para ${previewPlatform}`}
          >
            <LoaderCircle
              size={28}
              className={styles.spinner}
              aria-hidden="true"
            />
            <strong>Gerando imagem para {previewPlatform}...</strong>
            <span>O rascunho aparecerá aqui assim que estiver pronto.</span>
          </div>
          {pendingPlatforms.length > 1 ? (
            <p className={styles.pendingDrafts}>
              Ainda gerando para: {pendingPlatforms.join(', ')}.
            </p>
          ) : null}
        </div>
      ) : activePlatformFailed && previewPlatform ? (
        <div className={styles.failedPreview}>
          <div className={styles.pendingArtwork} style={artworkStyle}>
            <Image size={26} strokeWidth={1.2} />
            <strong>Não foi possível preparar {previewPlatform}.</strong>
            <span>A imagem e o rascunho dessa rede ainda não estão prontos.</span>
          </div>
          {generationIssue ? (
            <p className={styles.error} role="alert">
              {generationIssue}
            </p>
          ) : null}
          {onRetry ? (
            <Button
              fullWidth
              variant="secondary"
              disabled={disabled}
              onClick={() => void onRetry()}
            >
              Tentar gerar novamente
            </Button>
          ) : null}
        </div>
      ) : previewPlatform && pendingCount > 0 ? (
        <div className={styles.failedPreview}>
          <div className={styles.pendingArtwork} style={artworkStyle}>
            <Image size={26} strokeWidth={1.2} />
            <strong>O rascunho de {previewPlatform} ainda não foi concluído.</strong>
            <span>
              Você pode tentar novamente; os posts já prontos continuam salvos
              nesta revisão.
            </span>
          </div>
          {generationIssue ? (
            <p className={styles.error} role="alert">
              {generationIssue}
            </p>
          ) : null}
          {onRetry ? (
            <Button
              fullWidth
              variant="secondary"
              disabled={disabled}
              onClick={() => void onRetry()}
            >
              Tentar gerar novamente
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={styles.emptyPreview}>
          <div className={styles.paper}>
            <Image size={26} strokeWidth={1.2} />
            <span />
            <span />
          </div>
          <h3>Da conversa para o conteúdo.</h3>
          <p>
            Gere seu primeiro post para ver a composição, ajustar a legenda e
            escolher a data.
          </p>
        </div>
      )}
    </aside>
  )
}
