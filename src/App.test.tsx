import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('CI Doctor app', () => {
  beforeEach(() => {
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

    expect(screen.getByRole('heading', { name: /missing dependency/i })).toBeInTheDocument()
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
})
