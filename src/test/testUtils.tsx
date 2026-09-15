import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { AppProvider } from '../app/AppContext'
import {
  authenticateTestUser,
  createTestAuthGateway,
  type TestAuthGateway,
} from './testAuthGateway'
import { createTestRepository, type TestRepository } from './testRepository'

export function renderApp(
  route: string,
  repository: TestRepository = createTestRepository(),
  authGateway: TestAuthGateway = createTestAuthGateway(),
) {
  const renderResult = render(
    <MemoryRouter initialEntries={[route]}>
      <AppProvider authGateway={authGateway} repository={repository}>
        <App />
      </AppProvider>
    </MemoryRouter>,
  )

  return { ...renderResult, authGateway, repository }
}

export function authenticateDemo() {
  authenticateTestUser()
}
