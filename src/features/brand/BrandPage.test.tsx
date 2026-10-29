import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BrandProfile, BrandWorkspace } from '../../domain/models'
import {
  createTestRepository,
  type TestRepository,
} from '../../test/testRepository'
import { createTestAuthGateway } from '../../test/testAuthGateway'
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
    await user.selectOptions(screen.getByLabelText('Segmento'), 'Tecnologia')
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
    expect(screen.getByText('Selecione o segmento.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da marca')).toHaveFocus()
    expect(
      screen.getByRole('heading', { name: 'Identidade da marca' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome da marca'), 'Café Aurora')
    expect(
      screen.queryByText('Informe o nome da marca.'),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByLabelText('Segmento')).toHaveFocus()
    await user.selectOptions(screen.getByLabelText('Segmento'), 'Tecnologia')
    expect(screen.queryByText('Selecione o segmento.')).not.toBeInTheDocument()
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
    await user.selectOptions(screen.getByLabelText('Segmento'), 'Tecnologia')
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
    await user.selectOptions(screen.getByLabelText('Segmento'), 'Tecnologia')
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
    expect(screen.getByLabelText('Segmento')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Selecione o segmento.')).toBeInTheDocument()
    expect(screen.getByLabelText('Segmento')).toHaveFocus()

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
    expect(screen.getByLabelText('Nome da marca')).toHaveFocus()
    expect(repository.snapshot().brand?.name).toBe('Café Aurora')
  })
})

function withWorkspaces(
  repository: TestRepository,
  workspaces: BrandWorkspace[],
): TestRepository {
  return {
    ...repository,
    listWorkspaces: async () => workspaces,
    // Each workspace loads its own brand, like the API does.
    async load(workspaceId, billingWorkspaceId) {
      const data = await repository.load(workspaceId, billingWorkspaceId)
      const workspace = workspaces.find(({ id }) => id === workspaceId)
      return workspace && workspaceId !== 'brand-1'
        ? { ...data, brand: workspace.brand }
        : data
    },
  }
}

/** A regular customer (no platform role), so the brand limit applies. */
const customerGateway = () =>
  createTestAuthGateway({
    user: {
      id: 'test-user',
      email: 'aluno@postflow.com',
      displayName: 'Aluno PostFlow',
    },
    workspace: { id: 'brand-1', role: 'owner' },
    platformRole: null,
    billingStatus: 'active',
  })

const otherBrand: BrandProfile = {
  ...savedBrand,
  name: 'Studio Maria',
  primaryColor: '#DB2777',
  colorPalette: ['#DB2777'],
}

const twoOwnedWorkspaces: BrandWorkspace[] = [
  { id: 'brand-1', role: 'owner', billingStatus: 'active', brand: savedBrand },
  { id: 'brand-2', role: 'owner', billingStatus: 'active', brand: otherBrand },
]

describe('BrandPage · regras', () => {
  it('limita a paleta a cinco cores', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand', createTestRepository({ brand: savedBrand }))

    await screen.findByDisplayValue('Café Aurora')
    expect(screen.getByText('2/5')).toBeInTheDocument()
    for (let added = 0; added < 3; added++)
      await user.click(screen.getByRole('button', { name: /Adicionar cor/ }))

    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getByLabelText('Cor de apoio 4')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Adicionar cor/ }),
    ).not.toBeInTheDocument()
  })

  it('avisa sobre o limite de marcas em Nova marca', async () => {
    authenticateDemo()
    renderApp(
      '/brand/new',
      withWorkspaces(
        createTestRepository({ brand: savedBrand }),
        twoOwnedWorkspaces,
      ),
      customerGateway(),
    )

    expect(
      await screen.findByText(/Sua conta pode cadastrar até duas marcas\./),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Nova marca', level: 1 }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /Trocar de marca/ }),
    )
    expect(
      screen.getByText('Limite de duas marcas atingido.'),
    ).toBeInTheDocument()
  })

  it('pede confirmação antes de trocar de marca com alterações não salvas', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      renderApp(
        '/brand',
        withWorkspaces(
          createTestRepository({ brand: savedBrand }),
          twoOwnedWorkspaces,
        ),
      )

      const name = await screen.findByDisplayValue('Café Aurora')
      await user.type(name, ' Torrefação')
      await user.click(screen.getByRole('button', { name: /Trocar de marca/ }))
      await user.click(screen.getByRole('button', { name: /Studio Maria/ }))

      expect(confirm).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Nome da marca')).toHaveValue(
        'Café Aurora Torrefação',
      )

      confirm.mockReturnValue(true)
      await user.click(screen.getByRole('button', { name: /Trocar de marca/ }))
      await user.click(screen.getByRole('button', { name: /Studio Maria/ }))

      expect(confirm).toHaveBeenCalledTimes(2)
      expect(
        await screen.findByDisplayValue('Studio Maria'),
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Alterações não salvas'),
      ).not.toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it('troca de marca sem perguntar quando não há alterações', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    try {
      renderApp(
        '/brand',
        withWorkspaces(
          createTestRepository({ brand: savedBrand }),
          twoOwnedWorkspaces,
        ),
      )
      await screen.findByDisplayValue('Café Aurora')
      await user.click(screen.getByRole('button', { name: /Trocar de marca/ }))
      await user.click(screen.getByRole('button', { name: /Studio Maria/ }))
      expect(
        await screen.findByDisplayValue('Studio Maria'),
      ).toBeInTheDocument()
      expect(confirm).not.toHaveBeenCalled()
    } finally {
      confirm.mockRestore()
    }
  })

  it('preserva um segmento personalizado ao salvar', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({
      brand: { ...savedBrand, segment: 'Padaria artesanal' },
    })
    renderApp('/brand', repository)

    await screen.findByDisplayValue('Café Aurora')
    expect(screen.getByLabelText('Segmento')).toHaveValue('Padaria artesanal')
    await user.selectOptions(screen.getByLabelText('Tom de voz'), 'Inspirador')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Marca salva\./)).toBeInTheDocument()
    expect(repository.snapshot().brand).toMatchObject({
      segment: 'Padaria artesanal',
      toneOfVoice: 'Inspirador',
    })
  })

  it('continua nas configurações depois de salvar sem contexto', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp(
      '/brand',
      createTestRepository({
        brand: { ...savedBrand, targetAudience: '' },
      }),
    )

    const description = await screen.findByDisplayValue('Torrefação artesanal.')
    await user.clear(description)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Marca salva\./)).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Seções da marca' }),
    ).toBeInTheDocument()
  })
})
