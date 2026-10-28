export const POST_STATUSES = [
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
] as const
export type PostStatus = (typeof POST_STATUSES)[number]

/** Únicos status que o navegador pode definir. */
export const CLIENT_SETTABLE_STATUSES = ['draft', 'scheduled'] as const
export type ClientSettableStatus = (typeof CLIENT_SETTABLE_STATUSES)[number]

export const PUBLISH_MAX_ATTEMPTS = 3
export const PUBLISH_BATCH_SIZE = 10

export function isEditableStatus(status: PostStatus): boolean {
  return status !== 'publishing' && status !== 'published'
}

export function resolveStatusAfterClientPatch(input: {
  current: PostStatus
  requested?: ClientSettableStatus
  contentOrScheduleChanged: boolean
}): PostStatus {
  if (input.requested) return input.requested
  if (input.contentOrScheduleChanged) return 'draft'
  return input.current
}

export function postStatusLabel(
  status: PostStatus,
  publishMode?: string | null,
): string {
  switch (status) {
    case 'draft':
      return 'Não agendado'
    case 'scheduled':
      return 'Agendado'
    case 'publishing':
      return 'Publicando'
    case 'published':
      return publishMode === 'demo' ? 'Publicado (simulado)' : 'Publicado'
    case 'failed':
      return 'Falhou'
  }
}
