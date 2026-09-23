import { z } from 'zod'

export const CONTENT_FORMATS = ['carousel', 'static', 'reels'] as const
export const contentFormatSchema = z.enum(CONTENT_FORMATS)
export type ContentFormat = z.infer<typeof contentFormatSchema>

export const contentFormatDataSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('static'),
      headline: z.string().trim().min(1).max(120),
      visualDirection: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      kind: z.literal('carousel'),
      slides: z
        .array(
          z
            .object({
              headline: z.string().trim().min(1).max(120),
              copy: z.string().trim().min(1).max(240),
              visualDirection: z.string().trim().min(1).max(300),
            })
            .strict(),
        )
        .min(3)
        .max(5),
    })
    .strict(),
  z
    .object({
      kind: z.literal('reels'),
      hook: z.string().trim().min(1).max(180),
      durationSeconds: z.number().int().min(10).max(90),
      scenes: z
        .array(
          z
            .object({
              shot: z.string().trim().min(1).max(240),
              narration: z.string().trim().min(1).max(300),
              onScreenText: z.string().trim().max(120),
            })
            .strict(),
        )
        .min(3)
        .max(6),
      closingCta: z.string().trim().min(1).max(180),
    })
    .strict(),
])

export type ContentFormatData = z.infer<typeof contentFormatDataSchema>
