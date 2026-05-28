import { expect, test } from '@playwright/test'

test('analyzes a dependency failure and saves it', async ({ page }) => {
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

  await page.locator('input[type="range"]').nth(0).fill('20')
  await page.locator('input[type="range"]').nth(1).fill('60')
  await page.locator('input[type="range"]').nth(2).fill('60')

  await expect(page.getByText(/team at gbp 79\/month/i)).toBeVisible()
})
