export type LogSample = {
  id: string
  label: string
  log: string
}

export const logSamples: LogSample[] = [
  {
    id: 'vitest',
    label: 'Vitest failure',
    log: `Run npm test

FAIL src/lib/cart.test.ts > calculates checkout totals
AssertionError: expected 22 to equal 24
  at src/lib/cart.test.ts:18:19

Tests: 1 failed, 7 passed
Error: Process completed with exit code 1.`,
  },
  {
    id: 'dependency',
    label: 'Dependency',
    log: `Run npm run build

vite v8.0.12 building client for production...
error during build:
Error: Cannot find module '@testing-library/jest-dom'
Require stack:
- /home/runner/work/app/app/src/test/setup.ts
Error: Process completed with exit code 1.`,
  },
  {
    id: 'env',
    label: 'Secrets',
    log: `Run npm run e2e

Error: Missing required environment variable STRIPE_SECRET_KEY
at createCheckoutSession (src/server/billing.ts:41:11)
Hint: add STRIPE_SECRET_KEY to repository secrets.
Error: Process completed with exit code 1.`,
  },
  {
    id: 'flaky',
    label: 'Timeout',
    log: `Run npx playwright test

TimeoutError: page.getByRole('button', { name: 'Save case' }) timed out after 30000ms
Retry #1 passed
Retry #2 failed
Possible flaky test detected.
Error: Process completed with exit code 1.`,
  },
]
