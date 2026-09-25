import { useEffect, useRef, useState } from 'react'
import type { PostDraft } from '../../domain/models'
import {
  generationError,
  PLATFORMS,
  type ContentRequest,
  type ConversationMessage,
  type GenerationService,
} from './generationService'

interface PendingGeneration {
  requests: ContentRequest[]
  replace: boolean
}

function mergeDrafts(current: PostDraft[], generated: PostDraft[]) {
  const byPlatform = new Map(current.map((draft) => [draft.platform, draft]))
  for (const draft of generated) byPlatform.set(draft.platform, draft)
  return [...byPlatform.values()].sort(
    (first, second) =>
      PLATFORMS.findIndex((item) => item === first.platform) -
      PLATFORMS.findIndex((item) => item === second.platform),
  )
}

export function useContentStudio(service: GenerationService) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [drafts, setDrafts] = useState<PostDraft[]>([])
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  const [draftWorkspaceId, setDraftWorkspaceId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastRequest, setLastRequest] = useState<PendingGeneration | null>(null)
  const active = useRef<AbortController | null>(null)
  const draft =
    drafts.find((item) => item.platform === activePlatform) ?? drafts[0] ?? null

  useEffect(() => () => active.current?.abort(), [])

  async function runGeneration(
    requests: ContentRequest[],
    replace: boolean,
    retry = false,
  ) {
    if (active.current || requests.length === 0) return
    const controller = new AbortController()
    active.current = controller
    setError('')
    setNotice('')
    setIsGenerating(true)
    setLastRequest({ requests, replace })
    if (!retry)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: requests[0].prompt,
        },
      ])
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 90000)
    let rejectAbort: () => void = () => {}
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(new DOMException('Cancelado', 'AbortError'))
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
    })
    try {
      const outcomes = await Promise.race([
        Promise.allSettled(
          requests.map((request) =>
            service.generate(request, controller.signal),
          ),
        ),
        aborted,
      ])
      if (active.current !== controller || controller.signal.aborted) return

      const generated = outcomes.flatMap((outcome) =>
        outcome.status === 'fulfilled' ? [outcome.value] : [],
      )
      const failed = outcomes.flatMap((outcome, index) =>
        outcome.status === 'rejected'
          ? [{ request: requests[index], cause: outcome.reason }]
          : [],
      )

      if (generated.length) {
        setDrafts((current) =>
          replace
            ? mergeDrafts([], generated)
            : mergeDrafts(current, generated),
        )
        setActivePlatform((current) =>
          replace ? generated[0].platform : (current ?? generated[0].platform),
        )
        if (replace || !draftWorkspaceId)
          setDraftWorkspaceId(requests[0].workspaceId ?? null)
        const message =
          requests.length === 1 && !retry
            ? requests[0].previousDraft
              ? 'Rascunho atualizado. Confira a nova versão antes de salvar.'
              : `Rascunho para ${generated[0].platform} pronto para revisão. Você pode editar ou pedir um ajuste.`
            : `${generated.length} ${generated.length === 1 ? 'rascunho pronto' : 'rascunhos prontos'} para revisão: ${generated.map((item) => item.platform).join(', ')}.`
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: 'assistant', content: message },
        ])
        setNotice(
          generated.length === 1
            ? 'Rascunho gerado. Abra o painel Rascunho para revisar.'
            : `${generated.length} rascunhos gerados. Revise cada rede antes de adicionar à agenda.`,
        )
      }

      if (failed.length) {
        setLastRequest({
          requests: failed.map(({ request }) => request),
          replace: replace && generated.length === 0,
        })
        const platforms = failed
          .map(({ request }) => request.platform)
          .join(', ')
        setError(
          `${failed.length === requests.length ? 'Não foi possível gerar' : 'Ainda falta gerar'} para ${platforms}. ${generationError(failed[0].cause)}`,
        )
      } else {
        setLastRequest(null)
      }
    } catch (cause) {
      if (active.current !== controller) return
      if (timedOut)
        setError(generationError(new DOMException('', 'TimeoutError')))
      else if (!controller.signal.aborted) setError(generationError(cause))
    } finally {
      clearTimeout(timeout)
      controller.signal.removeEventListener('abort', rejectAbort)
      if (active.current === controller) {
        active.current = null
        setIsGenerating(false)
        if (timedOut)
          setError(generationError(new DOMException('', 'TimeoutError')))
      }
    }
  }

  function cancel() {
    active.current?.abort()
    active.current = null
    setIsGenerating(false)
    setNotice('Geração cancelada. Os rascunhos anteriores foram mantidos.')
  }

  function reset() {
    cancel()
    setMessages([])
    setDrafts([])
    setActivePlatform(null)
    setDraftWorkspaceId(null)
    setError('')
    setNotice('')
    setLastRequest(null)
  }

  function setDraft(updated: PostDraft) {
    setDrafts((current) => mergeDrafts(current, [updated]))
  }

  return {
    messages,
    draft,
    drafts,
    activePlatform,
    setActivePlatform,
    draftWorkspaceId,
    setDraft,
    isGenerating,
    error,
    notice,
    generate: (request: ContentRequest) =>
      runGeneration([request], !request.previousDraft),
    generateMany: (requests: ContentRequest[]) => runGeneration(requests, true),
    cancel,
    reset,
    retry: lastRequest
      ? () => runGeneration(lastRequest.requests, lastRequest.replace, true)
      : null,
  }
}
