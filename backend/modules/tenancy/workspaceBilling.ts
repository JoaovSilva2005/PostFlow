import { HttpError } from '../../shared/HttpError.js'
import type {
  WorkspaceAccessRepository,
  WorkspaceContext,
} from './workspaceTypes.js'

/** Shared by the HTTP quota boundary and the scheduler; client IDs grant no authority. */
export async function resolveWorkspaceBilling(
  repository: WorkspaceAccessRepository,
  userId: string,
  workspace: WorkspaceContext,
  requestedWorkspaceId?: string,
) {
  const owns = (workspaceId: string) =>
    repository.isWorkspaceOwner(userId, workspaceId)
  let workspaceId = requestedWorkspaceId ?? workspace.workspaceId
  if (workspaceId !== workspace.workspaceId) {
    if (
      workspace.role !== 'owner' ||
      !(await owns(workspace.workspaceId)) ||
      !(await owns(workspaceId))
    ) {
      throw new HttpError(
        403,
        'Somente o titular pode usar a assinatura entre suas marcas.',
      )
    }
  }
  const active = async (id: string) =>
    ['active', 'trialing'].includes(await repository.getBillingStatus(id))
  let hasActivePlan = await active(workspaceId)
  if (
    !hasActivePlan &&
    workspace.role === 'owner' &&
    (await owns(workspace.workspaceId))
  ) {
    const accountWorkspaceId =
      await repository.getActiveBillingWorkspaceId(userId)
    if (
      accountWorkspaceId &&
      (await owns(accountWorkspaceId)) &&
      (await active(accountWorkspaceId))
    ) {
      workspaceId = accountWorkspaceId
      hasActivePlan = true
    }
  }
  return { workspaceId, hasActivePlan }
}
