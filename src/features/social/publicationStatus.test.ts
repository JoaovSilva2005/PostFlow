import { describe, expect, it } from 'vitest'
import {
  hasPendingPublication,
  publicationStatusLabel,
} from './publicationStatus'

describe('publicationStatus', () => {
  it('traduz todos os status e marca publicações simuladas', () => {
    expect(publicationStatusLabel({ status: 'queued', simulated: false })).toBe(
      'Na fila',
    )
    expect(
      publicationStatusLabel({ status: 'retry_wait', simulated: false }),
    ).toBe('Nova tentativa agendada')
    expect(
      publicationStatusLabel({ status: 'published', simulated: true }),
    ).toBe('Publicado (simulado)')
    expect(
      publicationStatusLabel({ status: 'published', simulated: false }),
    ).toBe('Publicado')
  })

  it('detecta publicações ainda em andamento', () => {
    expect(hasPendingPublication([{ status: 'publishing' }])).toBe(true)
    expect(hasPendingPublication([{ status: 'retry_wait' }])).toBe(true)
    expect(
      hasPendingPublication([{ status: 'published' }, { status: 'failed' }]),
    ).toBe(false)
    expect(hasPendingPublication([])).toBe(false)
  })
})
