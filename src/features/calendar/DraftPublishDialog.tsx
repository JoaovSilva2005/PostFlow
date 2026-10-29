import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Send, X } from 'lucide-react'
import type { PostDraft } from '../../domain/models'
import { DraftPublishingPanel } from '../social/DraftPublishingPanel'
import styles from './CalendarPage.module.css'

interface DraftPublishDialogProps {
  open: boolean
  draft: PostDraft
  hasUnsavedChanges: boolean
  onClose: () => void
  /** Controle que abriu a janela; recebe o foco de volta ao fechar. */
  returnFocusRef: RefObject<HTMLElement | null>
}

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'

/**
 * Janela "Publicar nas redes" aberta a partir de Mais recursos.
 *
 * Fica sempre montada (apenas oculta quando fechada) para preservar o estado
 * do painel de publicação — destinos, resultados e a consulta periódica de
 * status — exatamente como acontecia quando ele vivia na coluna do cartão.
 */
export function DraftPublishDialog({
  open,
  draft,
  hasUnsavedChanges,
  onClose,
  returnFocusRef,
}: DraftPublishDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      closeButtonRef.current?.focus()
    } else if (wasOpen.current) {
      wasOpen.current = false
      returnFocusRef.current?.focus()
    }
  }, [open, returnFocusRef])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // A janela fica dentro da árvore React do diálogo do dia: impede que o
    // Escape/Tab também feche ou prenda o foco no diálogo de baixo.
    event.stopPropagation()
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    )
    if (!controls.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (event.target === event.currentTarget) onClose()
  }

  return createPortal(
    <div
      className={styles.publishOverlay}
      role="presentation"
      hidden={!open}
      onMouseDown={handleOverlayMouseDown}
    >
      <section
        ref={dialogRef}
        className={styles.publishDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.publishDialogHeader}>
          <span className={styles.publishDialogIcon} aria-hidden="true">
            <Send size={16} />
          </span>
          <div>
            <h2 id={titleId}>Publicar nas redes</h2>
            <p>
              {draft.platform} · cada destino recebe uma solicitação
              independente com a versão salva do post.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.detailClose}
            type="button"
            onClick={onClose}
            aria-label="Fechar publicação nas redes"
          >
            <X size={18} />
          </button>
        </header>
        <div className={styles.publishDialogBody}>
          <DraftPublishingPanel
            draft={draft}
            hasUnsavedChanges={hasUnsavedChanges}
            variant="dialog"
          />
        </div>
      </section>
    </div>,
    document.body,
  )
}
