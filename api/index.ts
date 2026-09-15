import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from '../server/app.js'

const app = createApp()

function restoreApiPath(request: IncomingMessage) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const path = url.searchParams.get('path')

  if (path === null) return

  url.searchParams.delete('path')
  const query = url.searchParams.toString()
  request.url = `/api/${path}${query ? `?${query}` : ''}`
}

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  restoreApiPath(request)
  return app(request, response)
}
