import {
  BRAND_SEGMENTS,
  type BrandSegment,
} from '../../shared/domain/brandCatalog.js'

export { BRAND_SEGMENTS }
export type { BrandSegment }

export const BRAND_SEGMENT_OPTIONS = BRAND_SEGMENTS.map((segment) => ({
  label: segment,
  value: segment,
}))
