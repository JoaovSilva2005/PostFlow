import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  initializeTheme,
  setThemePreference,
  THEME_STORAGE_KEY,
} from '../../app/theme'
import { ThemeSwitcher } from './ThemeSwitcher'

let systemDark = false
let onSystemChange: (() => void) | undefined
beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return systemDark
    },
    addEventListener: (_event: string, listener: () => void) => {
      onSystemChange = listener
    },
  }))
  document.head.insertAdjacentHTML(
    'beforeend',
    '<meta name="theme-color" content="#0a0a0a">',
  )
  initializeTheme()
})
beforeEach(() => {
  systemDark = false
  act(() => setThemePreference('dark'))
})
afterAll(() => vi.unstubAllGlobals())

describe('application theme preference', () => {
  it('switches all mounted selectors and persists the choice without changing account state', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeSwitcher />
        <ThemeSwitcher />
      </>,
    )
    await user.selectOptions(
      screen.getAllByLabelText('Tema da aplicação')[0],
      'light',
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#fafafa',
    )
    expect(screen.getAllByLabelText('Tema da aplicação')[1]).toHaveValue(
      'light',
    )
  })
  it('follows live system appearance only when the user chooses Sistema', async () => {
    const user = userEvent.setup()
    render(<ThemeSwitcher />)
    await user.selectOptions(
      screen.getByLabelText('Tema da aplicação'),
      'system',
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    act(() => {
      systemDark = true
      onSystemChange?.()
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    await user.selectOptions(
      screen.getByLabelText('Tema da aplicação'),
      'light',
    )
    act(() => {
      systemDark = false
      onSystemChange?.()
      systemDark = true
      onSystemChange?.()
    })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
  it('synchronizes browser tabs and resets to dark if the saved preference is removed', () => {
    render(<ThemeSwitcher />)
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: THEME_STORAGE_KEY,
          newValue: 'light',
        }),
      )
    })
    expect(screen.getByLabelText('Tema da aplicação')).toHaveValue('light')
    act(() => {
      localStorage.removeItem(THEME_STORAGE_KEY)
      window.dispatchEvent(
        new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }),
      )
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
  it('keeps switching usable when the browser blocks preference storage', async () => {
    const blocked = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    try {
      render(<ThemeSwitcher />)
      await userEvent
        .setup()
        .selectOptions(screen.getByLabelText('Tema da aplicação'), 'light')
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(screen.getByLabelText('Tema da aplicação')).toHaveValue('light')
    } finally {
      blocked.mockRestore()
    }
  })
})
