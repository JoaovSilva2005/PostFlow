import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BrandProfile } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'

const savedBrand: BrandProfile = {
  name: 'Café Aurora',
  segment: 'Alimentação e bebidas',
  toneOfVoice: 'Profissional e objetivo',
  primaryColor: '#123456',
  colorPalette: ['#123456', '#F97316'],
  description: 'Torrefação artesanal.',
  targetAudience: 'Quem prepara café em casa.',
  productsOrServices: '',
  differentials: '',
  contentGoals: '',
  keywords: 'torra fresca',
  avoidTopics: '',
  defaultCta: '',
}

describe('BrandPage · primeiro cadastro', () => {
  it('salva a configuração da marca no repositório de dados', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const { repository } = renderApp('/brand')

    await user.type(
      await screen.findByLabelText('Nome da marca'),
      'Café Aurora',
    )
    fireEvent.change(screen.getByLabelText('Cor principal'), {
      target: { value: '#123456' },
    })
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.selectOptions(screen.getByLabelText('Tom de voz'), 'Inspirador')
    await user.click(
      screen.getByRole('button', { name: 'Salvar e criar o primeiro post' }),
    )

    expect(repository.snapshot().brand).toMatchObject({
      name: 'Café Aurora',
      toneOfVoice: 'Inspirador',
      primaryColor: '#123456',
      colorPalette: ['#123456', '#F97316', '#16A34A'],
    })
    expect(
      await screen.findByRole('heading', { name: 'Criar com IA' }),
    ).toBeInTheDocument()
  })

  it('pede o nome antes de avançar e mostra as etapas', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand')

    const steps = await screen.findByRole('list', {
      name: 'Etapas do cadastro',
    })
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3)
    expect(within(steps).getByText('Como a marca fala')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Informe o nome da marca.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Identidade da marca' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome da marca'), 'Café Aurora')
    expect(
      screen.queryByText('Informe o nome da marca.'),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Continuar/ }))

    expect(
      screen.getByRole('heading', { name: 'Público e oferta' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('O que a marca faz?')).toBeInTheDocument()
    expect(screen.getAllByText('Opcional')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(screen.getByLabelText('Nome da marca')).toHaveValue('Café Aurora')
  })

  it('atualiza a prévia com o nome, a cor e o tom da marca', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand')

    const preview = await screen.findByRole('complementary', {
      name: 'Prévia do post',
    })
    expect(within(preview).getByTestId('preview-brand-name')).toHaveTextContent(
      'Sua marca',
    )

    await user.type(screen.getByLabelText('Nome da marca'), 'Café Aurora')
    fireEvent.change(screen.getByLabelText('Cor principal'), {
      target: { value: '#123456' },
    })

    expect(within(preview).getByTestId('preview-brand-name')).toHaveTextContent(
      'Café Aurora',
    )
    expect(within(preview).getByTestId('preview-art')).toHaveStyle({
      backgroundColor: '#123456',
    })

    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.type(
      screen.getByLabelText('O que a marca faz?'),
      'Torrefação artesanal de cafés especiais.',
    )
    expect(
      within(preview).getByText(/Torrefação artesanal de cafés especiais\./),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.selectOptions(
      screen.getByLabelText('Tom de voz'),
      'Divertido e informal',
    )
    expect(within(preview).getAllByText(/Bora conhecer a gente\?/).length).toBe(
      2,
    )
  })

  it('salva o contexto editorial que orienta a IA', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const { repository } = renderApp('/brand')

    await user.type(
      await screen.findByLabelText('Nome da marca'),
      'Café Aurora',
    )
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
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
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.type(
      screen.getByLabelText('Chamada para ação padrão'),
      'Conheça os cafés no site',
    )
    await user.click(
      screen.getByRole('button', { name: 'Salvar e criar o primeiro post' }),
    )

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

describe('BrandPage · marca criada no cadastro da conta', () => {
  it('abre o passo a passo com o nome já preenchido e permite ver todos os campos', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp(
      '/brand',
      createTestRepository({
        brand: {
          name: 'Studio Maria',
          segment: 'A definir',
          toneOfVoice: 'Próximo e acolhedor',
          primaryColor: '#4F46E5',
        },
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Cadastre sua marca' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da marca')).toHaveValue('Studio Maria')
    expect(screen.getByLabelText('Segmento')).toHaveValue(
      'Alimentação e bebidas',
    )

    await user.click(
      screen.getByRole('button', { name: 'Ver todos os campos de uma vez' }),
    )
    expect(
      screen.getByRole('navigation', { name: 'Seções da marca' }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Chamada para ação padrão'),
    ).toBeInTheDocument()
  })
})

describe('BrandPage · marca existente', () => {
  it('mostra a barra de salvar só com alterações e Descartar restaura', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand', createTestRepository({ brand: savedBrand }))

    const name = await screen.findByDisplayValue('Café Aurora')
    expect(
      screen.getByRole('navigation', { name: 'Seções da marca' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument()

    await user.type(name, ' Torrefação')
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByLabelText('Nome da marca')).toHaveValue('Café Aurora')
    expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument()
  })

  it('salva as alterações sem sair da página', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ brand: savedBrand })
    renderApp('/brand', repository)

    await screen.findByDisplayValue('Café Aurora')
    await user.selectOptions(screen.getByLabelText('Tom de voz'), 'Inspirador')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Marca salva\./)).toBeInTheDocument()
    expect(repository.snapshot().brand).toMatchObject({
      name: 'Café Aurora',
      toneOfVoice: 'Inspirador',
      colorPalette: ['#123456', '#F97316'],
    })
    expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument()
  })

  it('não salva sem nome', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ brand: savedBrand })
    renderApp('/brand', repository)

    const name = await screen.findByDisplayValue('Café Aurora')
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByText('Informe o nome da marca.')).toBeInTheDocument()
    expect(repository.snapshot().brand?.name).toBe('Café Aurora')
  })
})
