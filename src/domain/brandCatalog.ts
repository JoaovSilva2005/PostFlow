export const BRAND_SEGMENTS = [
  'Alimentação e bebidas',
  'Moda e beleza',
  'Tecnologia',
  'Serviços profissionais',
  'Saúde e bem-estar',
  'Educação',
  'Varejo e e-commerce',
  'Outro',
] as const

export type BrandSegment = (typeof BRAND_SEGMENTS)[number]

export const BRAND_SEGMENT_OPTIONS = BRAND_SEGMENTS.map((segment) => ({
  label: segment,
  value: segment,
}))
