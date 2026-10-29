// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { InMemoryWorkspaceAccessRepository } from './workspaceRepository.js'
import { resolveWorkspaceBilling } from './workspaceBilling.js'

function fixture(role: 'owner' | 'admin' | 'editor' | 'viewer' = 'owner') {
  const repo = new InMemoryWorkspaceAccessRepository(
    'content',
    role,
    null,
    'none',
  )
  vi.spyOn(repo, 'isWorkspaceOwner').mockImplementation(async (_user, id) =>
    ['content', 'paid'].includes(id),
  )
  vi.spyOn(repo, 'getBillingStatus').mockImplementation(async (id) =>
    id === 'paid' ? 'active' : 'none',
  )
  vi.spyOn(repo, 'getActiveBillingWorkspaceId').mockResolvedValue('paid')
  return { repo, context: { workspaceId: 'content', role } }
}

describe('account billing authority shared with the worker', () => {
  it('permits an explicit payer owned by the same titular', async () => {
    const { repo, context } = fixture()
    await expect(
      resolveWorkspaceBilling(repo, 'user', context, 'paid'),
    ).resolves.toEqual({ workspaceId: 'paid', hasActivePlan: true })
  })
  it.each(['viewer', 'editor', 'admin'] as const)(
    'rejects %s selecting another payer',
    async (role) => {
      const { repo, context } = fixture(role)
      await expect(
        resolveWorkspaceBilling(repo, 'user', context, 'paid'),
      ).rejects.toMatchObject({ statusCode: 403 })
      expect(repo.getBillingStatus).not.toHaveBeenCalled()
    },
  )
  it('rejects a payer belonging to someone else even with owner membership', async () => {
    const { repo, context } = fixture()
    await expect(
      resolveWorkspaceBilling(repo, 'user', context, 'foreign'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rejects cross-brand use when the content brand is not owned', async () => {
    const { repo, context } = fixture()
    vi.mocked(repo.isWorkspaceOwner).mockImplementation(
      async (_user, id) => id === 'paid',
    )
    await expect(
      resolveWorkspaceBilling(repo, 'user', context, 'paid'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
  it('resolves the same owned payer automatically for the scheduler', async () => {
    const { repo, context } = fixture()
    await expect(
      resolveWorkspaceBilling(repo, 'user', context),
    ).resolves.toEqual({ workspaceId: 'paid', hasActivePlan: true })
  })
  it('fails closed if the account fallback no longer belongs to the user', async () => {
    const { repo, context } = fixture()
    vi.mocked(repo.getActiveBillingWorkspaceId).mockResolvedValue('foreign')
    await expect(
      resolveWorkspaceBilling(repo, 'user', context),
    ).resolves.toEqual({ workspaceId: 'content', hasActivePlan: false })
  })
  it('checks the fallback plan again rather than trusting the returned ID', async () => {
    const { repo, context } = fixture()
    vi.mocked(repo.getBillingStatus).mockResolvedValue('cancelled')
    await expect(
      resolveWorkspaceBilling(repo, 'user', context),
    ).resolves.toMatchObject({ hasActivePlan: false })
  })
  it('preserves editors using their own workspace plan without granting billing authority', async () => {
    const { repo, context } = fixture('editor')
    vi.mocked(repo.getBillingStatus).mockResolvedValue('trialing')
    await expect(
      resolveWorkspaceBilling(repo, 'user', context),
    ).resolves.toEqual({ workspaceId: 'content', hasActivePlan: true })
    expect(repo.isWorkspaceOwner).not.toHaveBeenCalled()
  })
})
