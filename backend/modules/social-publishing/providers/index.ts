import type { SocialProvider } from '../socialTypes.js'
import { createFacebookPagesProvider } from './facebookPages.js'
import { createInstagramLoginProvider } from './instagramLogin.js'
import { createLinkedInMemberProvider } from './linkedinMember.js'
import { createTikTokDirectPostProvider } from './tiktokDirectPost.js'
import { createDemoProvider } from './demo.js'
import type { ProviderFetch } from './common.js'

export interface SocialProviderFactoryOptions {
  appUrl?: string
  fetch?: ProviderFetch
  demoMode?: boolean
}

export function createSocialProviders(
  options: SocialProviderFactoryOptions = {},
): Record<SocialProvider['id'], SocialProvider> {
  void options.appUrl
  if (options.demoMode)
    return {
      facebook: createDemoProvider('facebook'),
      instagram: createDemoProvider('instagram'),
      linkedin: createDemoProvider('linkedin'),
      tiktok: createDemoProvider('tiktok'),
    }
  const env = { fetch: options.fetch ?? globalThis.fetch, timeoutMs: 10_000 }
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0'
  const instagramClientId = process.env.INSTAGRAM_APP_ID
  const instagramClientSecret = process.env.INSTAGRAM_APP_SECRET
  return {
    facebook: createFacebookPagesProvider(env, {
      appId: process.env.META_APP_ID,
      appSecret: process.env.META_APP_SECRET,
      graphVersion,
    }),
    instagram: createInstagramLoginProvider(env, {
      appId: instagramClientId,
      appSecret: instagramClientSecret,
      graphVersion,
    }),
    linkedin: createLinkedInMemberProvider(env, {
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
    tiktok: createTikTokDirectPostProvider(env, {
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      mediaDomainVerified: process.env.TIKTOK_MEDIA_DOMAIN_VERIFIED === 'true',
      directPostApproved: process.env.TIKTOK_DIRECT_POST_APPROVED === 'true',
    }),
  }
}

export { createDemoProvider } from './demo.js'
export { createFacebookPagesProvider } from './facebookPages.js'
export { createInstagramLoginProvider } from './instagramLogin.js'
export { createLinkedInMemberProvider } from './linkedinMember.js'
export { createTikTokDirectPostProvider } from './tiktokDirectPost.js'
export { ProviderError } from '../socialTypes.js'
