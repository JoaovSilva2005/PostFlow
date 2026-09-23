export const DEFAULT_POST_TIMEZONE = 'America/Sao_Paulo'

export interface ZonedDateTimeParts {
  date: string
  time: string
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

export function dateTimePartsInZone(
  value: Date | string,
  timeZone = DEFAULT_POST_TIMEZONE,
): ZonedDateTimeParts | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime()) || !isValidTimeZone(timeZone)) return null

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'iso8601',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  if (
    !values.year ||
    !values.month ||
    !values.day ||
    !values.hour ||
    !values.minute
  )
    return null

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

export function localDateTimeToIso(
  date: string,
  time: string,
  timeZone = DEFAULT_POST_TIMEZONE,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const clock = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !clock || !isValidTimeZone(timeZone))
    throw new RangeError('Data, horário ou fuso inválido.')

  const [, year, month, day] = match
  const [, hour, minute] = clock
  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
  const check = new Date(target)
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() + 1 !== Number(month) ||
    check.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59
  )
    throw new RangeError('Data ou horário inválido.')

  let candidate = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateTimePartsInZone(new Date(candidate), timeZone)
    if (!parts)
      throw new RangeError('Não foi possível calcular o fuso horário.')
    if (parts.date === date && parts.time === time)
      return new Date(candidate).toISOString()

    const observed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parts.date)!
    const observedClock = /^(\d{2}):(\d{2})$/.exec(parts.time)!
    const observedAsUtc = Date.UTC(
      Number(observed[1]),
      Number(observed[2]) - 1,
      Number(observed[3]),
      Number(observedClock[1]),
      Number(observedClock[2]),
    )
    candidate += target - observedAsUtc
  }

  throw new RangeError(
    'Esse horário local não existe por causa da mudança de fuso.',
  )
}
