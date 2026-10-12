import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { HttpError } from '../../shared/HttpError.js'

export function hashState(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
export function randomState() {
  return randomBytes(32).toString('base64url')
}
export function pkceChallenge(value: string) {
  return createHash('sha256').update(value).digest('base64url')
}
export class SocialCrypto {
  private key: Buffer | null
  constructor(encodedKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? '') {
    const candidate = Buffer.from(encodedKey, 'base64')
    this.key = candidate.length === 32 ? candidate : null
  }
  get configured() {
    return this.key !== null
  }
  private requireKey() {
    if (!this.key)
      throw new HttpError(
        503,
        'A configuração segura das redes sociais está pendente.',
      )
    return this.key
  }
  seal(value: unknown, context: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.requireKey(), iv)
    cipher.setAAD(Buffer.from(context))
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ])
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.')
  }
  open<T>(value: string, context: string): T {
    const [version, iv, tag, encrypted] = value.split('.')
    if (version !== 'v1' || !iv || !tag || !encrypted)
      throw new HttpError(503, 'Credencial social inválida; reconecte a conta.')
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.requireKey(),
        Buffer.from(iv, 'base64url'),
      )
      decipher.setAAD(Buffer.from(context))
      decipher.setAuthTag(Buffer.from(tag, 'base64url'))
      const bytes = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ])
      return JSON.parse(bytes.toString('utf8')) as T
    } catch {
      throw new HttpError(
        503,
        'Não foi possível acessar a credencial; reconecte a conta.',
      )
    }
  }
  mediaToken(jobId: string, expires: number) {
    const signature = createHmac('sha256', this.requireKey())
      .update(`media:${jobId}:${expires}`)
      .digest('base64url')
    return `${expires}.${signature}`
  }
  validMediaToken(jobId: string, token: string, now = Date.now()) {
    if (!this.configured) return false
    const [expires, signature] = token.split('.')
    if (
      !signature ||
      !/^\d+$/.test(expires ?? '') ||
      Number(expires) <= now ||
      Number(expires) > now + 6 * 60 * 60_000
    )
      return false
    const actual = Buffer.from(signature)
    const expected = Buffer.from(
      this.mediaToken(jobId, Number(expires)).split('.')[1],
    )
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    )
  }
}

export function matchesSecret(actual: string, expected: string | undefined) {
  if (!expected || expected.length < 32) return false
  const a = Buffer.from(actual),
    b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
