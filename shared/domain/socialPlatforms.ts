import { z } from 'zod'

export const SOCIAL_PLATFORMS = [
  'Instagram',
  'Facebook',
  'X / Twitter',
  'LinkedIn',
  'TikTok',
  'Blog',
] as const

export const socialPlatformSchema = z.enum(SOCIAL_PLATFORMS)
export type SocialPlatform = z.infer<typeof socialPlatformSchema>
