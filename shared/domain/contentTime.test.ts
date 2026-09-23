import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POST_TIMEZONE,
  dateTimePartsInZone,
  localDateTimeToIso,
} from './contentTime'

describe('horário local de conteúdo', () => {
  it('converte e recupera a hora de Brasília sem depender do fuso do servidor', () => {
    const instant = localDateTimeToIso('2026-09-23', '09:45')

    expect(instant).toBe('2026-09-23T12:45:00.000Z')
    expect(dateTimePartsInZone(instant, DEFAULT_POST_TIMEZONE)).toEqual({
      date: '2026-09-23',
      time: '09:45',
    })
  })

  it.each([
    ['2026-02-30', '09:45', DEFAULT_POST_TIMEZONE],
    ['2026-09-23', '24:00', DEFAULT_POST_TIMEZONE],
    ['2026-09-23', '09:45', 'Fuso/Inválido'],
  ])(
    'rejeita data, horário ou fuso inválido (%s, %s, %s)',
    (date, time, timeZone) => {
      expect(() => localDateTimeToIso(date, time, timeZone)).toThrow(RangeError)
    },
  )
})
