import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { AppProvider } from '../app/AppContext'

export function renderApp(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>,
  )
}

export function authenticateDemo() {
  localStorage.setItem('postflow:session', 'true')
}
