import { randomUUID } from 'node:crypto'
import type {
  SocialRepository,
  ConnectionRecord,
  OAuthSessionRecord,
  PublicationRecord,
  DraftForPublication,
} from '../modules/social-publishing/socialTypes.js'
const clone = <T>(value: T): T => structuredClone(value)
export class InMemorySocialRepository implements SocialRepository {
  connections = new Map<string, ConnectionRecord>()
  sessions = new Map<string, OAuthSessionRecord>()
  publications = new Map<string, PublicationRecord>()
  drafts = new Map<string, DraftForPublication>()
  images = new Map<string, Uint8Array>()
  refreshLeases = new Map<string, string>()
  async listConnections(w: string) {
    return [...this.connections.values()]
      .filter((c) => c.workspaceId === w)
      .map(clone)
  }
  async getConnection(w: string, id: string) {
    const c = this.connections.get(id)
    return c?.workspaceId === w ? clone(c) : null
  }
  async saveConnection(c: ConnectionRecord) {
    const old = [...this.connections.values()].find(
      (x) =>
        x.workspaceId === c.workspaceId &&
        x.provider === c.provider &&
        x.externalAccountId === c.externalAccountId,
    )
    const saved = { ...c, id: old?.id ?? c.id }
    this.connections.set(saved.id, clone(saved))
    for (const p of this.publications.values())
      if (p.connectionId === saved.id && p.status === 'needs_reconnect')
        p.status = 'retry_wait'
    return clone(saved)
  }
  async updateConnection(
    w: string,
    id: string,
    patch: Partial<ConnectionRecord>,
  ) {
    const c = this.connections.get(id)
    if (c?.workspaceId === w) Object.assign(c, patch)
  }
  async claimRefresh(_w: string, id: string) {
    if (this.refreshLeases.has(id)) return null
    const token = randomUUID()
    this.refreshLeases.set(id, token)
    return token
  }
  async finishRefresh(
    w: string,
    id: string,
    lease: string,
    patch: { encryptedTokens: string; expiresAt: string | null } | null,
  ) {
    if (this.refreshLeases.get(id) !== lease) return false
    this.refreshLeases.delete(id)
    if (patch) await this.updateConnection(w, id, patch)
    return true
  }
  async disconnect(w: string, id: string) {
    await this.updateConnection(w, id, {
      status: 'disconnected',
      encryptedTokens: '',
    })
    for (const p of this.publications.values())
      if (
        p.workspaceId === w &&
        p.connectionId === id &&
        !p.leaseToken &&
        !p.operation?._dispatched &&
        !['published', 'failed', 'unknown'].includes(p.status)
      )
        p.status = 'cancelled'
  }
  async createOAuthSession(s: OAuthSessionRecord) {
    this.sessions.set(s.id, clone(s))
  }
  async consumeOAuthSession(
    hash: string,
    user: string,
    provider: OAuthSessionRecord['provider'],
  ) {
    const s = [...this.sessions.values()].find(
      (x) =>
        x.stateHash === hash &&
        x.userId === user &&
        x.provider === provider &&
        x.status === 'pending' &&
        Date.parse(x.expiresAt) > Date.now(),
    )
    if (!s) return null
    s.status = 'exchanging'
    return clone(s)
  }
  async completeOAuthSession(id: string, accounts: string | null) {
    const s = this.sessions.get(id)
    if (s) {
      s.status = accounts ? 'ready' : 'failed'
      s.encryptedAccounts = accounts
    }
  }
  async getReadySession(w: string, u: string, id: string) {
    return (await this.listReadySessions(w, u)).find((s) => s.id === id) ?? null
  }
  async listReadySessions(w: string, u: string) {
    return [...this.sessions.values()]
      .filter(
        (s) =>
          s.workspaceId === w &&
          s.userId === u &&
          s.status === 'ready' &&
          Date.parse(s.expiresAt) > Date.now(),
      )
      .map(clone)
  }
  async countOAuthSessions(w: string, u: string) {
    return [...this.sessions.values()].filter(
      (s) =>
        s.workspaceId === w &&
        s.userId === u &&
        s.status !== 'failed' &&
        Date.parse(s.expiresAt) > Date.now(),
    ).length
  }
  async getDraft(w: string, id: string) {
    const d = this.drafts.get(id)
    return d?.workspaceId === w ? clone(d) : null
  }
  async listPublications(w: string) {
    return [...this.publications.values()]
      .filter((p) => p.workspaceId === w)
      .map(clone)
  }
  async getPublication(id: string) {
    const p = this.publications.get(id)
    return p ? clone(p) : null
  }
  async enqueue(p: PublicationRecord) {
    const old = [...this.publications.values()].find(
      (x) =>
        x.draftId === p.draftId &&
        x.connectionId === p.connectionId &&
        !['failed', 'cancelled'].includes(x.status),
    )
    if (old) return clone(old)
    this.publications.set(p.id, clone(p))
    return clone(p)
  }
  async cancel(w: string, id: string) {
    const p = this.publications.get(id)
    if (
      !p ||
      p.workspaceId !== w ||
      p.leaseToken ||
      p.operation?._dispatched ||
      ['published', 'unknown', 'cancelled', 'failed'].includes(p.status)
    )
      return null
    p.status = 'cancelled'
    return clone(p)
  }
  async claimDue(limit: number) {
    const due = [...this.publications.values()]
      .filter(
        (p) =>
          [
            'queued',
            'preparing',
            'processing',
            'publishing',
            'retry_wait',
            'unknown',
          ].includes(p.status) &&
          Date.parse(p.nextAttemptAt) <= Date.now() &&
          (!p.leaseExpiresAt || Date.parse(p.leaseExpiresAt) < Date.now()),
      )
      .slice(0, limit)
    for (const p of due) {
      p.leaseToken = randomUUID()
      p.leaseExpiresAt = new Date(Date.now() + 120000).toISOString()
      p.attempts++
      if (p.status === 'publishing') p.status = 'unknown'
    }
    return due.map(clone)
  }
  async updateClaim(
    id: string,
    lease: string,
    patch: Partial<PublicationRecord>,
  ) {
    const p = this.publications.get(id)
    if (
      !p ||
      p.leaseToken !== lease ||
      Date.parse(p.leaseExpiresAt!) <= Date.now()
    )
      return false
    Object.assign(p, clone(patch))
    p.leaseExpiresAt = new Date(Date.now() + 120000).toISOString()
    return true
  }
  async releaseClaim(id: string, lease: string) {
    const p = this.publications.get(id)
    if (p?.leaseToken === lease) {
      p.leaseToken = null
      p.leaseExpiresAt = null
    }
  }
  async loadImage(path: string) {
    const image = this.images.get(path)
    if (!image) throw new Error('Image missing')
    return image
  }
  async saveImage(w: string, id: string, bytes: Uint8Array) {
    const path = `social-publication-images/${w}/${id}/image.jpg`
    this.images.set(path, bytes)
    return path
  }
  async removeImage(path: string) {
    this.images.delete(path)
  }
}
