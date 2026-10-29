import { useEffect, useRef } from 'react'
import type { PublicationDTO } from '../../../shared/domain/socialPublishing'

export const PUBLICATION_POLL_INTERVAL_MS = 15_000

const pendingStatuses = new Set<string>([
  'queued',
  'preparing',
  'processing',
  'publishing',
  'retry_wait',
])

const labels: Record<string, string> = {
  queued: 'Na fila',
  preparing: 'Preparando',
  processing: 'Processando',
  publishing: 'Publicando',
  published: 'Publicado',
  retry_wait: 'Nova tentativa agendada',
  failed: 'Falhou',
  needs_reconnect: 'Reconexão necessária',
  cancelled: 'Cancelado',
  unknown: 'Status desconhecido',
}

export function publicationStatusLabel(
  publication: Pick<PublicationDTO, 'status'> &
    Partial<Pick<PublicationDTO, 'simulated'>>,
) {
  const { status } = publication
  if (status === 'published' && publication.simulated)
    return 'Publicado (simulado)'
  return labels[status] ?? status
}

export function hasPendingPublication(
  publications: Array<Pick<PublicationDTO, 'status'>>,
) {
  return publications.some((item) => pendingStatuses.has(item.status))
}

/** Executa `refresh` a cada 15 s enquanto `active` e a aba estiver visível. */
export function usePublicationPolling(active: boolean, refresh: () => void) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshRef.current()
    }, PUBLICATION_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [active])
}
