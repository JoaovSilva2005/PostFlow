import { useEffect, useState, type CSSProperties } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import type { PostDraft } from '../../domain/models'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import styles from './CalendarPage.module.css'

const FORMAT_LABELS: Record<string, string> = {
  carousel: 'Carrossel',
  static: 'Post estático',
  reels: 'Reels / vídeo curto',
}

interface PostCreativePreviewProps {
  draft: PostDraft
  onRefreshImage?: (draftId: string) => Promise<string | null>
  onGenerateImage?: (draft: PostDraft) => Promise<string | null>
}

export function PostCreativePreview({
  draft,
  onRefreshImage,
  onGenerateImage,
}: PostCreativePreviewProps) {
  const [imageUrl, setImageUrl] = useState(draft.imageUrl)
  const [imageFailed, setImageFailed] = useState(false)
  const [refreshAttempted, setRefreshAttempted] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  useEffect(() => {
    setImageUrl(draft.imageUrl)
    setImageFailed(false)
    setRefreshAttempted(false)
  }, [draft.id, draft.imageAvailable, draft.imageUrl])

  useEffect(() => {
    if (draft.imageUrl || !draft.imageAvailable || !onRefreshImage) {
      return
    }
    let isCurrent = true
    setRefreshAttempted(true)
    setIsRefreshing(true)
    onRefreshImage(draft.id)
      .then((refreshedUrl) => {
        if (!isCurrent) return
        setImageUrl(refreshedUrl ?? undefined)
        setImageFailed(!refreshedUrl)
      })
      .catch(() => {
        if (isCurrent) setImageFailed(true)
      })
      .finally(() => {
        if (isCurrent) setIsRefreshing(false)
      })
    return () => {
      isCurrent = false
    }
  }, [draft.id, draft.imageAvailable, draft.imageUrl, onRefreshImage])

  function handleImageError() {
    setImageFailed(true)
    if (!onRefreshImage || refreshAttempted) return
    setRefreshAttempted(true)
    setIsRefreshing(true)
    onRefreshImage(draft.id)
      .then((refreshedUrl) => {
        if (refreshedUrl && refreshedUrl !== imageUrl) {
          setImageUrl(refreshedUrl)
          setImageFailed(false)
        }
      })
      .catch(() => setImageFailed(true))
      .finally(() => setIsRefreshing(false))
  }

  async function generateImage() {
    if (!onGenerateImage || isGenerating) return
    setGenerationError('')
    setIsGenerating(true)
    try {
      const generatedUrl = await onGenerateImage(draft)
      if (!generatedUrl) throw new Error('A imagem não foi salva.')
      setImageUrl(generatedUrl)
      setImageFailed(false)
      setRefreshAttempted(false)
    } catch {
      setGenerationError('Não foi possível gerar a imagem. Tente novamente.')
    } finally {
      setIsGenerating(false)
    }
  }

  const hasImage = Boolean(imageUrl) && !imageFailed

  const accentStyle = {
    '--draft-accent': draft.color,
  } as CSSProperties

  return (
    <section className={styles.detailPreview} aria-label="Prévia do post">
      <div className={styles.previewHeading}>
        <div>
          <span>Prévia</span>
          <small>{FORMAT_LABELS[draft.format ?? 'static']}</small>
        </div>
        <span className={styles.previewPlatform}>
          <SocialPlatformIcon platform={draft.platform} size={16} />
          {draft.platform}
        </span>
      </div>

      <div
        className={styles.artboard}
        data-format={draft.format ?? 'static'}
        style={accentStyle}
      >
        {hasImage ? (
          <img
            src={imageUrl}
            alt="Imagem gerada para o post"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={handleImageError}
          />
        ) : (
          <div className={styles.artboardContent}>
            <span className={styles.artboardAccent} />
            <div className={styles.artboardBrand}>
              <SocialPlatformIcon platform={draft.platform} size={17} />
              <span>{draft.platform}</span>
            </div>
            <div className={styles.artboardCopy}>
              <small>{FORMAT_LABELS[draft.format ?? 'static']}</small>
              <strong>
                {isRefreshing
                  ? 'Carregando imagem…'
                  : imageFailed && draft.imageAvailable
                    ? 'A imagem salva não pôde ser carregada'
                    : draft.visualText || 'Prévia da arte'}
              </strong>
            </div>
            <span className={styles.artboardFooter}>POSTFLOW · PRÉVIA</span>
          </div>
        )}
      </div>

      {!hasImage && onGenerateImage ? (
        <button
          className={styles.generateImageButton}
          type="button"
          onClick={() => void generateImage()}
          disabled={isGenerating || isRefreshing}
        >
          {isGenerating ? (
            <LoaderCircle size={15} className={styles.spinningIcon} />
          ) : (
            <Sparkles size={15} />
          )}
          {isGenerating ? 'Gerando imagem…' : 'Gerar imagem com IA'}
        </button>
      ) : null}

      <p className={styles.previewNote}>
        {hasImage
          ? 'Imagem gerada e salva na agenda.'
          : isRefreshing
            ? 'Restaurando o acesso à imagem salva…'
            : draft.imageAvailable
              ? 'A imagem existe na agenda, mas não foi possível carregá-la.'
              : 'Este post ainda não tem uma imagem. Gerar uma consome 1 imagem da franquia.'}
      </p>
      {generationError ? (
        <p className={styles.previewError} role="alert">
          {generationError}
        </p>
      ) : null}
    </section>
  )
}
