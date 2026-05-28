import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = ''
    process.env.GEMINI_MODEL = ''
    process.env.OPENAI_API_KEY = ''
    process.env.OPENAI_MODEL = ''
  })

  it('returns deterministic backend analysis when no API key is configured', async () => {
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

  it('uses Gemini first when a Gemini API key is configured', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    process.env.GEMINI_MODEL = 'gemini-test'

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'test failure',
                      commands: ['npm run test:unit'],
                      confidence: 91,
                      fixSteps: ['Open the failing test', 'Update the implementation'],
                      learningNote: 'CI should explain the first failing assertion.',
                      likelyCause: 'A changed expectation no longer matches the implementation.',
                      minutesSaved: 25,
                      severity: 'high',
                      summary: 'Gemini found a failing assertion in the log.',
                      title: 'Gemini diagnosis',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    )

    const response = await handler(createRequest({ logText: 'AssertionError: expected true' }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.source).toBe('ai-backend')
    expect(payload.analysis.title).toBe('Gemini diagnosis')
    expect(payload.note).toContain('Gemini (gemini-test)')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-goog-api-key': 'test-key',
        }),
        method: 'POST',
      }),
    )
  })
})
