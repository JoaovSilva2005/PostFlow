const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function expandHex(color: string) {
  const value = color.slice(1)
  return value.length === 3
    ? value
        .split('')
        .map((digit) => digit + digit)
        .join('')
    : value
}

function relativeLuminance(color: string) {
  const hex = expandHex(color)
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** Returns black or white, whichever reads better on the given hex color. */
export function readableTextOn(color: string | undefined) {
  if (!color || !HEX_COLOR.test(color)) return '#ffffff'
  const luminance = relativeLuminance(color)
  const onWhite = 1.05 / (luminance + 0.05)
  const onBlack = (luminance + 0.05) / 0.05
  return onBlack > onWhite ? '#0a0a0a' : '#ffffff'
}
