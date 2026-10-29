import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { X } from 'lucide-react'
import type { PostDraft } from '../../domain/models'
import { DraftSchedulePanel } from './DraftSchedulePanel'
import styles from './CalendarPage.module.css'

interface DraftSchedulePopoverProps {
  id: string
  draft: PostDraft
  disabled: boolean
  onDateChange: (date: string) => Promise<void>
  onChange: <Key extends 'time' | 'status'>(
    field: Key,
    value: PostDraft[Key],
  ) => void
  /** `restoreFocus` é falso quando o fechamento veio de um clique fora. */
  onClose: (restoreFocus: boolean) => void
  /** Elementos que abrem o editor; cliques neles não contam como "fora". */
  triggerRefs: RefObject<HTMLElement | null>[]
}

/**
 * Editor compacto (não modal) de data, horário e situação, aberto pelas
 * pílulas do cabeçalho do cartão. As alterações de horário e situação ficam
 * no formulário do cartão até "Salvar alterações"; a data move o post na hora,
 * como antes.
 */
export function DraftSchedulePopover({
  id,
  draft,
  disabled,
  onDateChange,
  onChange,
  onClose,
  triggerRefs,
}: DraftSchedulePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    popoverRef.current
      ?.querySelector<HTMLElement>('input:not(:disabled), select, button')
      ?.focus()
  }, [])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent | globalThis.MouseEvent) {
      const target = event.target as Node | null
      if (!target || popoverRef.current?.contains(target)) return
      if (triggerRefs.some((ref) => ref.current?.contains(target))) return
      onClose(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [onClose, triggerRefs])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    // Fecha só o editor; o diálogo do dia continua aberto.
    event.stopPropagation()
    onClose(true)
  }

  return (
    <div
      ref={popoverRef}
      id={id}
      className={styles.schedulePopover}
      role="dialog"
      aria-modal="false"
      aria-label="Agenda do post"
      onKeyDown={handleKeyDown}
    >
      <DraftSchedulePanel
        draft={draft}
        disabled={disabled}
        onDateChange={onDateChange}
        onChange={onChange}
      />
      <button
        className={styles.schedulePopoverClose}
        type="button"
        onClick={() => onClose(true)}
        aria-label="Fechar agenda do post"
      >
        <X size={16} />
      </button>
    </div>
  )
}
