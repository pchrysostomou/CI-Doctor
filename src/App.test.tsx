import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { analyzeCiLog } from './lib/analyzer'

describe('CI Doctor app', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('loads with a useful CI diagnosis already visible', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /turn failing github actions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /failing automated test/i })).toBeInTheDocument()
    expect(screen.getByText(/npm run test:unit/i)).toBeInTheDocument()
  })

  it('switches demo logs and analyzes a dependency failure', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /dependency/i }))
    await user.click(screen.getByRole('button', { name: /analyze log/i }))

    expect(
      await screen.findByRole('heading', { name: /missing dependency/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/commit both package\.json/i)).toBeInTheDocument()
  })

  it('saves the current case into local history', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /save case/i }))

    const historyList = screen.getByRole('list', { name: /saved analysis history/i })
    expect(within(historyList).getByRole('listitem')).toHaveTextContent(
      'Failing automated test',
    )
    expect(window.localStorage.getItem('ci-doctor-history')).toContain('Failing automated test')
  })

  it('analyzes custom pasted logs and handles an empty log', async () => {
    const user = userEvent.setup()
    render(<App />)

    const logInput = screen.getByLabelText(/paste github actions output/i)

    fireEvent.change(logInput, {
      target: { value: 'Missing required environment variable STRIPE_SECRET_KEY' },
    })
    await user.click(screen.getByRole('button', { name: /analyze log/i }))

    expect(
      await screen.findByRole('heading', { name: /missing secret or environment variable/i }),
    ).toBeInTheDocument()

    fireEvent.change(logInput, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: /analyze log/i }))

    expect(await screen.findByRole('heading', { name: /empty log/i })).toBeInTheDocument()
    expect(screen.getByText(/paste a ci log to receive a diagnosis/i)).toBeInTheDocument()
  })

  it('shows when a backend AI analysis is returned', async () => {
    const user = userEvent.setup()
    const analysis = analyzeCiLog("Error: Cannot find module 'stripe'")
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          analysis,
          note: 'Mock AI backend response.',
          source: 'ai-backend',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      ),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: /dependency/i }))
    await user.click(screen.getByRole('button', { name: /analyze log/i }))

    expect(await screen.findByText('AI backend (Gemini/OpenAI)')).toBeInTheDocument()
    expect(screen.getByText(/mock ai backend response/i)).toBeInTheDocument()
    expect(screen.queryByText(/draft log now looks/i)).not.toBeInTheDocument()
  })

  it('ignores invalid saved history data instead of crashing', () => {
    window.localStorage.setItem('ci-doctor-history', '{"broken":true}')

    render(<App />)

    expect(screen.getByText(/no saved cases yet/i)).toBeInTheDocument()
  })
})
