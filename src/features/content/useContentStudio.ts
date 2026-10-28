import { useEffect, useRef, useState } from 'react'
import type { PostDraft } from '../../domain/models'
import {
  generationError,
  PLATFORMS,
  type ContentRequest,
  type ConversationMessage,
  type GenerationService,
  type Platform,
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
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null)
  const [pendingPlatforms, setPendingPlatforms] = useState<Platform[]>([])
  const [failedPlatforms, setFailedPlatforms] = useState<Platform[]>([])
  const [draftWorkspaceId, setDraftWorkspaceId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastRequest, setLastRequest] = useState<PendingGeneration | null>(null)
  const active = useRef<AbortController | null>(null)
  const draft = activePlatform
    ? drafts.find((item) => item.platform === activePlatform) ?? null
    : drafts[0] ?? null

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
    setPendingPlatforms(requests.map(({ platform }) => platform))
    setFailedPlatforms([])
    if (replace) {
      setDrafts([])
      setActivePlatform(requests[0].platform)
      setDraftWorkspaceId(requests[0].workspaceId ?? null)
    } else {
      setActivePlatform((current) => current ?? requests[0].platform)
    }
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
          requests.map(async (request) => {
            try {
              const generatedDraft = await service.generate(
                request,
                controller.signal,
              )
              if (active.current === controller && !controller.signal.aborted) {
                setDrafts((current) => mergeDrafts(current, [generatedDraft]))
                setActivePlatform(
                  (current) => current ?? (generatedDraft.platform as Platform),
                )
                setDraftWorkspaceId(
                  (current) => current ?? request.workspaceId ?? null,
                )
                setPendingPlatforms((current) =>
                  current.filter((platform) => platform !== request.platform),
                )
              }
              return generatedDraft
            } catch (cause) {
              if (active.current === controller && !controller.signal.aborted) {
                setFailedPlatforms((current) =>
                  current.includes(request.platform)
                    ? current
                    : [...current, request.platform],
                )
                setPendingPlatforms((current) =>
                  current.filter((platform) => platform !== request.platform),
                )
              }
              throw cause
            }
          }),
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
        setPendingPlatforms([])
        if (timedOut)
          setError(generationError(new DOMException('', 'TimeoutError')))
      }
    }
  }

  function cancel() {
    const retryPlatforms = new Set([...pendingPlatforms, ...failedPlatforms])
    if (lastRequest && retryPlatforms.size > 0) {
      const remainingRequests = lastRequest.requests.filter(({ platform }) =>
        retryPlatforms.has(platform),
      )
      if (remainingRequests.length) {
        setLastRequest({ requests: remainingRequests, replace: false })
      }
    }
    active.current?.abort()
    active.current = null
    setIsGenerating(false)
    setPendingPlatforms([])
    setFailedPlatforms([])
    setNotice('Geração cancelada. Os rascunhos já concluídos foram mantidos.')
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
    pendingPlatforms,
    failedPlatforms,
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
