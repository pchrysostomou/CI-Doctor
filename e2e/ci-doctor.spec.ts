import { expect, test, type Page } from '@playwright/test'
import { analyzeCiLog } from '../src/lib/analyzer'

async function useDeterministicApi(page: Page) {
  await page.route('**/api/analyze', async (route) => {
    const payload = route.request().postDataJSON() as { logText?: unknown }
    const logText = typeof payload.logText === 'string' ? payload.logText : ''

    await route.fulfill({
      body: JSON.stringify({
        analysis: analyzeCiLog(logText),
        note: 'Playwright used deterministic backend rules for stable automation.',
        source: 'backend-rules',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
}

test('analyzes a dependency failure and saves it', async ({ page }) => {
  await useDeterministicApi(page)
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /turn failing github actions/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: /dependency/i }).click()
  await page.getByRole('button', { name: /analyze log/i }).click()

  await expect(page.getByRole('heading', { name: /missing dependency/i })).toBeVisible()
  await expect(page.getByText(/npm ci/i)).toBeVisible()

  await page.getByRole('button', { name: /save case/i }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Missing dependency' })).toBeVisible()
})

test('updates the pricing calculator with team-level value', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/failing runs per week/i).fill('20')
  await page.getByLabel(/minutes lost per failure/i).fill('60')
  await page.getByLabel(/hourly developer value/i).fill('60')

  await expect(page.getByText(/team at gbp 79\/month/i)).toBeVisible()
})

test('handles a custom pasted environment failure', async ({ page }) => {
  await useDeterministicApi(page)
  await page.goto('/')

  await page.getByLabel(/paste github actions output/i).fill(`
    Error: Missing required environment variable STRIPE_SECRET_KEY
    Hint: add STRIPE_SECRET_KEY to repository secrets.
    Error: Process completed with exit code 1.
  `)
  await page.getByRole('button', { name: /analyze log/i }).click()

  await expect(
    page.getByRole('heading', { name: /missing secret or environment variable/i }),
  ).toBeVisible()
  await expect(page.getByText(/repository Settings > Secrets/i)).toBeVisible()
})
