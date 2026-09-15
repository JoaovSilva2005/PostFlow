export const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export const INITIAL_VISIBLE_MONTH = new Date(2026, 7, 1)
export const DEMO_TODAY = '2026-08-10'

interface CalendarCell {
  date: Date
  inCurrentMonth: boolean
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function buildCalendar(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1)
  const firstVisibleDate = new Date(year, month, 1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate)
    date.setDate(firstVisibleDate.getDate() + index)

    return {
      date,
      inCurrentMonth: date.getMonth() === month,
    }
  })
}
