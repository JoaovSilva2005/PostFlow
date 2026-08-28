const SESSION_KEY = 'postflow:session'

export const SessionStorage = {
  load: (): boolean => localStorage.getItem(SESSION_KEY) === 'true',
  save: (isAuthenticated: boolean): void => {
    localStorage.setItem(SESSION_KEY, String(isAuthenticated))
  },
}
