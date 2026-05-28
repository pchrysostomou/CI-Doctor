import { describe, expect, it } from 'vitest'
import handler from './analyze'

function createRequest(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/analyze', {
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
    method,
  })
}

describe('/api/analyze', () => {
  it('returns deterministic backend analysis when no API key is configured', async () => {
    process.env.OPENAI_API_KEY = ''

    const response = await handler(
      createRequest({ logText: "Error: Cannot find module '@testing-library/jest-dom'" }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.source).toBe('backend-rules')
    expect(payload.analysis.title).toBe('Missing dependency')
  })

  it('rejects unsupported HTTP methods', async () => {
    const response = await handler(createRequest({}, 'GET'))

    expect(response.status).toBe(405)
  })
})
