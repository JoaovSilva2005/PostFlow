import type { ContentFormat } from './contentFormats.js'

export const SOCIAL_IMAGE_SIZES = {
  square: '1024x1024',
  portrait: '1024x1280',
  vertical: '1152x2048',
  landscape: '1280x720',
} as const

export type SocialImageOrientation = keyof typeof SOCIAL_IMAGE_SIZES

export interface SocialImagePreset {
  imageSize: (typeof SOCIAL_IMAGE_SIZES)[SocialImageOrientation]
  orientation: SocialImageOrientation
  previewAspectRatio: string
}

const SOCIAL_IMAGE_PRESETS: Record<SocialImageOrientation, SocialImagePreset> = {
  square: {
    imageSize: SOCIAL_IMAGE_SIZES.square,
    orientation: 'square',
    previewAspectRatio: '1 / 1',
  },
  portrait: {
    imageSize: SOCIAL_IMAGE_SIZES.portrait,
    orientation: 'portrait',
    previewAspectRatio: '4 / 5',
  },
  vertical: {
    imageSize: SOCIAL_IMAGE_SIZES.vertical,
    orientation: 'vertical',
    previewAspectRatio: '9 / 16',
  },
  landscape: {
    imageSize: SOCIAL_IMAGE_SIZES.landscape,
    orientation: 'landscape',
    previewAspectRatio: '16 / 9',
  },
}

export function getSocialImagePreset(
  platform: string,
  format?: ContentFormat,
): SocialImagePreset {
  if (format === 'reels' || platform === 'TikTok') {
    return SOCIAL_IMAGE_PRESETS.vertical
  }

  switch (platform) {
    case 'Instagram':
      return SOCIAL_IMAGE_PRESETS.portrait
    case 'Facebook':
      return SOCIAL_IMAGE_PRESETS.square
    case 'LinkedIn':
      return SOCIAL_IMAGE_PRESETS.portrait
    case 'X / Twitter':
      return SOCIAL_IMAGE_PRESETS.landscape
    case 'Blog':
      return SOCIAL_IMAGE_PRESETS.landscape
    default:
      return SOCIAL_IMAGE_PRESETS.square
  }
}
