import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import analyzeHandler from './api/analyze'

function appendHeaders(headers: IncomingHttpHeaders): Headers {
  const requestHeaders = new Headers()

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => requestHeaders.append(key, item))
      return
    }

    if (typeof value === 'string') {
      requestHeaders.set(key, value)
    }
  })

  return requestHeaders
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

async function sendWebResponse(response: Response, serverResponse: ServerResponse) {
  serverResponse.statusCode = response.status
  response.headers.forEach((value, key) => serverResponse.setHeader(key, value))
  serverResponse.end(await response.text())
}

function localApiPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (request, response) => {
        try {
          const method = request.method ?? 'GET'
          const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request)
          const webRequest = new Request('http://localhost/api/analyze', {
            body,
            headers: appendHeaders(request.headers),
            method,
          })

          await sendWebResponse(await analyzeHandler(webRequest), response)
        } catch {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Local API route failed' }))
        }
      })
    },
    name: 'local-api-routes',
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] ??= value
  })

  return {
    plugins: [react(), localApiPlugin()],
  }
})
