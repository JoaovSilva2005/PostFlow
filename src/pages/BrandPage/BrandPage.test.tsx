import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authenticateDemo, renderApp } from '../../test/testUtils'

describe('BrandPage', () => {
  it('salva a configuração da marca no armazenamento local', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand')

    await user.type(screen.getByLabelText('Nome da marca'), 'Café Aurora')
    await user.selectOptions(screen.getByLabelText('Tom de voz'), 'Inspirador')
    await user.click(
      screen.getByRole('button', { name: 'Selecionar cor #F97316' }),
    )
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }))

    const saved = JSON.parse(localStorage.getItem('postflow:brand') ?? '{}')
    expect(saved).toMatchObject({
      name: 'Café Aurora',
      toneOfVoice: 'Inspirador',
      primaryColor: '#F97316',
    })
  })
})
