import { useEffect, useRef, useState } from 'react'
import type { PostDraft } from '../../domain/models'
import {
  generationError,
  type ContentRequest,
  type ConversationMessage,
  type GenerationService,
} from './generationService'

export function useContentStudio(service: GenerationService) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastRequest, setLastRequest] = useState<ContentRequest | null>(null)
  const active = useRef<AbortController | null>(null)

  useEffect(() => () => active.current?.abort(), [])

  async function generate(request: ContentRequest, retry = false) {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setError('')
    setNotice('')
    setIsGenerating(true)
    setLastRequest(request)
    if (!retry)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: request.prompt,
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
      const result = await Promise.race([
        service.generate(request, controller.signal),
        aborted,
      ])
      // Providers may ignore AbortSignal. Never apply their stale response.
      if (active.current !== controller || controller.signal.aborted) return
      setDraft(result)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: request.previousDraft
            ? 'Rascunho atualizado. Confira a nova versão antes de salvar.'
            : `Rascunho para ${result.platform} pronto para revisão. Você pode editar ou pedir um ajuste.`,
        },
      ])
      setNotice('Rascunho gerado. Abra o painel Rascunho para revisar.')
      setLastRequest(null)
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
    setNotice('Geração cancelada. O rascunho anterior foi mantido.')
  }

  function reset() {
    cancel()
    setMessages([])
    setDraft(null)
    setError('')
    setNotice('')
    setLastRequest(null)
  }

  return {
    messages,
    draft,
    setDraft,
    isGenerating,
    error,
    notice,
    generate,
    cancel,
    reset,
    retry: lastRequest ? () => generate(lastRequest, true) : null,
  }
}
