import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authenticateDemo, renderApp } from '../../test/testUtils'

describe('BrandPage', () => {
  it('salva a configuração da marca no repositório de dados', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const { repository } = renderApp('/brand')

    await user.type(
      await screen.findByLabelText('Nome da marca'),
      'Café Aurora',
    )
    await user.selectOptions(screen.getByLabelText('Tom de voz'), 'Inspirador')
    await user.click(
      screen.getByRole('button', { name: 'Selecionar cor #F97316' }),
    )
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }))

    const saved = repository.snapshot().brand
    expect(saved).toMatchObject({
      name: 'Café Aurora',
      toneOfVoice: 'Inspirador',
      primaryColor: '#F97316',
    })
  })

  it('salva o contexto editorial que orienta a IA', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const { repository } = renderApp('/brand')

    await user.type(
      await screen.findByLabelText('Nome da marca'),
      'Café Aurora',
    )
    await user.type(
      screen.getByLabelText('O que a marca faz?'),
      'Torrefação artesanal com cafés especiais e origem rastreável.',
    )
    await user.type(
      screen.getByLabelText('Para quem você fala?'),
      'Pessoas que gostam de descobrir sabores e preparar café em casa.',
    )
    await user.type(
      screen.getByLabelText('Produtos ou serviços'),
      'Café em grãos, kits de degustação e assinatura mensal.',
    )
    await user.click(
      screen.getByRole('button', { name: /Direção editorial/ }),
    )
    await user.type(
      screen.getByLabelText('Chamada para ação padrão'),
      'Conheça os cafés no site',
    )
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }))

    expect(repository.snapshot().brand).toMatchObject({
      description:
        'Torrefação artesanal com cafés especiais e origem rastreável.',
      targetAudience:
        'Pessoas que gostam de descobrir sabores e preparar café em casa.',
      productsOrServices:
        'Café em grãos, kits de degustação e assinatura mensal.',
      defaultCta: 'Conheça os cafés no site',
    })
  }, 10_000)
})
