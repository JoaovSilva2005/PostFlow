import { describe, expect, it } from 'vitest'
import {
  isEditableStatus,
  postStatusLabel,
  resolveStatusAfterClientPatch,
} from './postPublishing'

describe('resolveStatusAfterClientPatch', () => {
  it('volta scheduled para draft ao editar sem reaprovar', () => {
    expect(
      resolveStatusAfterClientPatch({ current: 'scheduled', contentOrScheduleChanged: true }),
    ).toBe('draft')
  })

  it('permite editar e reaprovar no mesmo envio', () => {
    expect(
      resolveStatusAfterClientPatch({
        current: 'scheduled',
        requested: 'scheduled',
        contentOrScheduleChanged: true,
      }),
    ).toBe('scheduled')
  })

  it('permite reagendar um post failed sem editar', () => {
    expect(
      resolveStatusAfterClientPatch({
        current: 'failed',
        requested: 'scheduled',
        contentOrScheduleChanged: false,
      }),
    ).toBe('scheduled')
  })

  it('mantém draft ao editar um draft', () => {
    expect(
      resolveStatusAfterClientPatch({ current: 'draft', contentOrScheduleChanged: true }),
    ).toBe('draft')
  })

  it('volta failed para draft ao editar', () => {
    expect(
      resolveStatusAfterClientPatch({ current: 'failed', contentOrScheduleChanged: true }),
    ).toBe('draft')
  })
})

describe('isEditableStatus', () => {
  it('bloqueia publishing e published', () => {
    expect(isEditableStatus('publishing')).toBe(false)
    expect(isEditableStatus('published')).toBe(false)
  })

  it('libera draft, scheduled e failed', () => {
    expect(isEditableStatus('draft')).toBe(true)
    expect(isEditableStatus('scheduled')).toBe(true)
    expect(isEditableStatus('failed')).toBe(true)
  })
})

describe('postStatusLabel', () => {
  it('devolve os rótulos da interface', () => {
    expect(postStatusLabel('draft')).toBe('Não agendado')
    expect(postStatusLabel('scheduled')).toBe('Agendado')
    expect(postStatusLabel('publishing')).toBe('Publicando')
    expect(postStatusLabel('published', 'demo')).toBe('Publicado (simulado)')
    expect(postStatusLabel('published', 'live')).toBe('Publicado')
    expect(postStatusLabel('published')).toBe('Publicado')
    expect(postStatusLabel('failed')).toBe('Falhou')
  })
})
