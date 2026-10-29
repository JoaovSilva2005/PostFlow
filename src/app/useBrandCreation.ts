import { useApp } from './AppContext'

export const MAX_OWNED_BRANDS = 2

/**
 * Whether the signed-in user may create another brand: the product must be
 * usable (active plan or platform owner) and owners keep up to two brands.
 */
export function useCanCreateBrand() {
  const { availableWorkspaces, hasActivePlan, platformRole } = useApp()
  const canUseProduct = hasActivePlan || platformRole === 'platform_owner'
  const ownedBrandCount = availableWorkspaces.filter(
    (workspace) => workspace.isOwnedByUser ?? workspace.role === 'owner',
  ).length
  return (
    canUseProduct &&
    (platformRole === 'platform_owner' || ownedBrandCount < MAX_OWNED_BRANDS)
  )
}
