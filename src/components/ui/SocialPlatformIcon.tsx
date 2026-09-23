import { useId } from 'react'

interface SocialPlatformIconProps {
  platform: string
  size?: number
}

export function SocialPlatformIcon({
  platform,
  size = 18,
}: SocialPlatformIconProps) {
  const gradientId = `instagram-gradient-${useId().replace(/:/g, '')}`
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    focusable: false as const,
  }

  if (platform === 'Instagram') {
    return (
      <svg {...common} fill="none">
        <defs>
          <linearGradient id={gradientId} x1="3" x2="21" y1="21" y2="3">
            <stop stopColor="#FFB13D" />
            <stop offset="0.5" stopColor="#F54876" />
            <stop offset="1" stopColor="#9B4DCA" />
          </linearGradient>
        </defs>
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="5"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
        />
        <circle cx="17.5" cy="6.8" r="1.15" fill="#F54876" />
      </svg>
    )
  }

  if (platform === 'Facebook') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="11" fill="#1877F2" />
        <path
          d="M13.4 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.2-.2-2.4-.2-2.4 0-4 1.5-4 4.1v2.3H7.6V13h2.7v8h3.1Z"
          fill="white"
        />
      </svg>
    )
  }

  if (platform === 'X / Twitter') {
    return (
      <svg {...common}>
        <path
          d="M18.9 2h3.3l-7.2 8.2L23.5 22h-6.7l-5.2-7.6L5 22H1.7l7.7-8.8L1.2 2h6.9l4.7 7 6.1-7Zm-1.2 18h1.8L7 3.9H5.1L17.7 20Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (platform === 'LinkedIn') {
    return (
      <svg {...common}>
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" />
        <path
          d="M7.1 9.6H4.5v8.1h2.6V9.6ZM5.8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm5.3 1.1H8.6v8.1h2.5v-4.1c0-1.1.2-2.1 1.6-2.1s1.4 1.3 1.4 2.2v4h2.6v-4.5c0-2.3-.5-4-3.1-4-1.2 0-2 .6-2.4 1.2h-.1V9.6Z"
          fill="white"
        />
      </svg>
    )
  }

  if (platform === 'TikTok') {
    return (
      <svg {...common}>
        <path
          d="M15.2 3.1c.3 2.1 1.5 3.3 3.6 3.5v3.1a8.4 8.4 0 0 1-3.6-1.1v5.8a5.5 5.5 0 1 1-5.5-5.5c.4 0 .8 0 1.2.1v3.2a2.3 2.3 0 1 0 1.1 2V3.1h3.2Z"
          fill="#25F4EE"
          transform="translate(-1 1)"
        />
        <path
          d="M15.2 3.1c.3 2.1 1.5 3.3 3.6 3.5v3.1a8.4 8.4 0 0 1-3.6-1.1v5.8a5.5 5.5 0 1 1-5.5-5.5c.4 0 .8 0 1.2.1v3.2a2.3 2.3 0 1 0 1.1 2V3.1h3.2Z"
          fill="#FE2C55"
          transform="translate(1 -0.5)"
        />
        <path
          d="M15.2 3.1c.3 2.1 1.5 3.3 3.6 3.5v3.1a8.4 8.4 0 0 1-3.6-1.1v5.8a5.5 5.5 0 1 1-5.5-5.5c.4 0 .8 0 1.2.1v3.2a2.3 2.3 0 1 0 1.1 2V3.1h3.2Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (platform === 'Blog') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="3" width="17" height="18" rx="2.5" />
        <path d="M7.5 8h9M7.5 12h9M7.5 16h5" />
      </svg>
    )
  }

  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="m8.3 7.1 7.4 3.8m-7.4 6 7.4-3.8" />
    </svg>
  )
}
