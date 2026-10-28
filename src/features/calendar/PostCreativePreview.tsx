import { useEffect, useState, type CSSProperties } from 'react'
import type { PostDraft } from '../../domain/models'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import { getSocialImagePreset } from '../../../shared/domain/socialImagePresets'
import styles from './CalendarPage.module.css'

const FORMAT_LABELS: Record<string, string> = {
  carousel: 'Carrossel',
  static: 'Post estático',
  reels: 'Reels / vídeo curto',
}

interface PostCreativePreviewProps {
  draft: PostDraft
  onRefreshImage?: (draftId: string) => Promise<string | null>
}

export function PostCreativePreview({
  draft,
  onRefreshImage,
}: PostCreativePreviewProps) {
  const [imageUrl, setImageUrl] = useState(draft.imageUrl)
  const [imageFailed, setImageFailed] = useState(false)
  const [refreshAttempted, setRefreshAttempted] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
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

  const hasImage = Boolean(imageUrl) && !imageFailed

  const accentStyle = {
    '--draft-accent': draft.color,
    '--draft-aspect-ratio': getSocialImagePreset(
      draft.platform,
      draft.format,
    ).previewAspectRatio,
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

      <p className={styles.previewNote}>
        {hasImage
          ? 'Imagem gerada e salva na agenda.'
          : isRefreshing
            ? 'Restaurando o acesso à imagem salva…'
            : draft.imageAvailable
              ? 'A imagem existe na agenda, mas não foi possível carregá-la.'
              : 'Este rascunho não tem uma imagem disponível.'}
      </p>
    </section>
  )
}
