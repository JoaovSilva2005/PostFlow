import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { AppProvider } from '../app/AppContext'
import { createTestRepository, type TestRepository } from './testRepository'

export function renderApp(
  route: string,
  repository: TestRepository = createTestRepository(),
) {
  const renderResult = render(
    <MemoryRouter initialEntries={[route]}>
      <AppProvider repository={repository}>
        <App />
      </AppProvider>
    </MemoryRouter>,
  )

  return { ...renderResult, repository }
}

export function authenticateDemo() {
  localStorage.setItem('postflow:session', 'true')
}
