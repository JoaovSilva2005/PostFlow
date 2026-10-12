import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostDraft } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import {
  demoGenerationService,
  type GenerationService,
  type ContentRequest,
} from '../content/generationService'

const demoServiceWithImages = demoGenerationService as GenerationService & {
  generateImage?: (
    request: ContentRequest,
    signal: AbortSignal,
  ) => Promise<string>
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function dateInFuture(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function openGenerator(platforms = ['Facebook', 'X / Twitter']) {
  const user = userEvent.setup()
  authenticateDemo()
  const repository = createTestRepository()
  renderApp('/calendar', repository)
  await user.click(
    await screen.findByRole('button', { name: 'Gerar conteúdo' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Configurar geração' })
  await user.type(
    screen.getByLabelText('Ideia do conteúdo na agenda'),
    'Apresentação de uma nova coleção',
  )
  for (const platform of platforms) {
    await user.click(within(dialog).getByRole('button', { name: platform }))
  }
  return { user, dialog, repository }
}

function installImageGenerator(
  implementation: NonNullable<GenerationService['generateImage']>,
) {
  Object.defineProperty(demoServiceWithImages, 'generateImage', {
    configurable: true,
    value: vi.fn(implementation),
    writable: true,
  })
  return demoServiceWithImages.generateImage as ReturnType<typeof vi.fn>
}

afterEach(() => {
  vi.restoreAllMocks()
  delete demoServiceWithImages.generateImage
})

describe('geração da Agenda', () => {
  it('gera três legendas, uma arte compartilhada e só persiste depois da arte', async () => {
    const image = deferred<string>()
    const generateImage = installImageGenerator(() => image.promise)
    const batch = vi.spyOn(demoGenerationService, 'generateBatch')
    const { user, dialog, repository } = await openGenerator()

    await user.click(within(dialog).getByRole('button', { name: /^Estático/ }))
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Gerar 3 rascunhos e imagens',
      }),
    )

    await waitFor(() => expect(generateImage).toHaveBeenCalledTimes(1))
    expect(batch).toHaveBeenCalledTimes(1)
    expect(repository.snapshot().drafts).toHaveLength(0)
    expect(generateImage.mock.calls[0]?.[0]).toMatchObject({
      format: 'static',
      previousDraft: expect.objectContaining({
        format: 'static',
        formatData: expect.objectContaining({ kind: 'static' }),
      }),
    })
    expect(
      within(dialog).getByRole('button', { name: 'Gerando imagens 0/1...' }),
    ).toBeInTheDocument()

    image.resolve('https://images.example.test/shared-art.png')
    expect(await screen.findByRole('status')).toHaveTextContent(
      '3 rascunhos com imagens salvos na agenda para revisão. A publicação é manual.',
    )
    const created = repository.snapshot().drafts
    expect(created).toHaveLength(3)
    expect(created.map(({ platform }) => platform).sort()).toEqual([
      'Facebook',
      'Instagram',
      'X / Twitter',
    ])
    expect(created.map(({ imageUrl }) => imageUrl)).toEqual([
      'https://images.example.test/shared-art.png',
      'https://images.example.test/shared-art.png',
      'https://images.example.test/shared-art.png',
    ])
  })

  it('agrupa seis copies de duas datas em duas gerações de imagem', async () => {
    const generateImage = installImageGenerator(
      async (request) => `https://images.example.test/${request.date}.png`,
    )
    const { user, dialog, repository } = await openGenerator([
      'Facebook',
      'X / Twitter',
    ])
    const tomorrow = dateInFuture(1)
    await user.click(
      within(dialog).getByRole('button', { name: dateLabel(tomorrow) }),
    )
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Gerar 6 rascunhos e imagens',
      }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      '6 rascunhos com imagens salvos na agenda para revisão. A publicação é manual.',
    )
    expect(generateImage).toHaveBeenCalledTimes(2)
    const generatedDates = generateImage.mock.calls.map(
      ([request]) => request.date,
    )
    expect(new Set(generatedDates).size).toBe(2)
    const created = repository.snapshot().drafts
    expect(created).toHaveLength(6)
    for (const date of generatedDates) {
      expect(created.filter((draft) => draft.date === date)).toHaveLength(3)
      expect(
        new Set(
          created
            .filter((draft) => draft.date === date)
            .map((draft) => draft.imageUrl),
        ).size,
      ).toBe(1)
    }
    expect(created.map(({ date }) => date)).toEqual(
      expect.arrayContaining([dateKey(new Date()), dateKey(tomorrow)]),
    )
  })

  it.each([
    ['Estático', 'static'],
    ['Carrossel', 'carousel'],
    ['Reels', 'reels'],
  ] as const)(
    'preserva o contrato do formato %s ao gerar a arte',
    async (label, format) => {
      const generateImage = installImageGenerator(
        async () => 'https://images.example.test/art.png',
      )
      const { user, dialog, repository } = await openGenerator([
        'Facebook',
        'X / Twitter',
      ])
      await user.click(
        within(dialog).getByRole('button', { name: new RegExp(`^${label}`) }),
      )
      await user.click(
        within(dialog).getByRole('button', {
          name: 'Gerar 3 rascunhos e imagens',
        }),
      )

      await screen.findByText(/3 rascunhos com imagens salvos/)
      expect(generateImage.mock.calls[0]?.[0]).toMatchObject({
        format,
        previousDraft: {
          format,
          formatData: { kind: format },
        },
      })
      expect(repository.snapshot().drafts).toHaveLength(3)
      expect(
        repository
          .snapshot()
          .drafts.every((draft) => draft.formatData?.kind === format),
      ).toBe(true)
    },
  )

  it('não persiste copies se a geração da arte falhar e informa como retomar', async () => {
    installImageGenerator(async () => {
      throw new Error('falha de imagem simulada')
    })
    const { user, dialog, repository } = await openGenerator([
      'Facebook',
      'X / Twitter',
    ])
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Gerar 3 rascunhos e imagens',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A geração não foi concluída. Tente novamente para aproveitar os textos e as imagens já gerados nesta janela.',
    )
    expect(repository.snapshot().drafts).toHaveLength(0)
  })

  it('repete só as imagens que falharam ao tentar novamente com a mesma configuração', async () => {
    let imageCalls = 0
    const generateImage = installImageGenerator(async () => {
      imageCalls += 1
      if (imageCalls === 1) throw new Error('falha de imagem simulada')
      return 'https://images.example.test/shared-art.png'
    })
    const batch = vi.spyOn(demoGenerationService, 'generateBatch')
    const { user, dialog, repository } = await openGenerator([
      'Facebook',
      'X / Twitter',
    ])
    const submit = () =>
      within(dialog).getByRole('button', {
        name: 'Gerar 3 rascunhos e imagens',
      })
    await user.click(submit())
    await screen.findByRole('alert')
    expect(repository.snapshot().drafts).toHaveLength(0)

    await user.click(submit())
    await screen.findByText(/3 rascunhos com imagens salvos/)
    expect(batch).toHaveBeenCalledTimes(1)
    expect(generateImage).toHaveBeenCalledTimes(2)
    expect(repository.snapshot().drafts).toHaveLength(3)
  })

  it('reusa textos e imagens se a persistência falhar e o usuário tentar novamente', async () => {
    const generateImage = installImageGenerator(
      async () => 'https://images.example.test/shared-art.png',
    )
    const batch = vi.spyOn(demoGenerationService, 'generateBatch')
    const { user, dialog, repository } = await openGenerator([
      'Facebook',
      'X / Twitter',
    ])
    const createDraft = repository.createDraft.bind(repository)
    let shouldFail = true
    repository.createDrafts = vi.fn(
      async (workspaceId: string, drafts: PostDraft[]) => {
        if (shouldFail) {
          shouldFail = false
          throw new Error('falha de persistência simulada')
        }
        return Promise.all(
          drafts.map((draft) => createDraft(workspaceId, draft)),
        )
      },
    )
    const submit = () =>
      within(dialog).getByRole('button', {
        name: 'Gerar 3 rascunhos e imagens',
      })

    await user.click(submit())
    await screen.findByRole('alert')
    expect(repository.snapshot().drafts).toHaveLength(0)
    expect(generateImage).toHaveBeenCalledTimes(1)

    await user.click(submit())
    await screen.findByText(/3 rascunhos com imagens salvos/)
    expect(batch).toHaveBeenCalledTimes(1)
    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(repository.snapshot().drafts).toHaveLength(3)
  })

  it('cancela enquanto aguarda a arte e não persiste copies', async () => {
    installImageGenerator(
      (_request, signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Geração cancelada', 'AbortError')),
            { once: true },
          )
        }),
    )
    const { user, dialog, repository } = await openGenerator([
      'Facebook',
      'X / Twitter',
    ])
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Gerar 3 rascunhos e imagens',
      }),
    )
    await screen.findByRole('button', { name: 'Cancelar imagens' })
    await user.click(screen.getByRole('button', { name: 'Cancelar imagens' }))

    await waitFor(() => expect(repository.snapshot().drafts).toHaveLength(0))
  })

  it('ignora um segundo submit enquanto a geração de imagens está em andamento', async () => {
    const image = deferred<string>()
    const generateImage = installImageGenerator(() => image.promise)
    const batch = vi.spyOn(demoGenerationService, 'generateBatch')
    const { user, dialog, repository } = await openGenerator([
      'Facebook',
      'X / Twitter',
    ])
    const submitButton = within(dialog).getByRole('button', {
      name: 'Gerar 3 rascunhos e imagens',
    })
    await user.click(submitButton)
    await waitFor(() => expect(generateImage).toHaveBeenCalledTimes(1))
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)

    expect(batch).toHaveBeenCalledTimes(1)
    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(repository.snapshot().drafts).toHaveLength(0)
    image.resolve('https://images.example.test/shared-art.png')
    await screen.findByText(/3 rascunhos com imagens salvos/)
  })
})
