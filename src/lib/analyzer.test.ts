import { describe, expect, it } from 'vitest'
import { analyzeCiLog, calculateMonthlySavings, recommendPlan } from './analyzer'

describe('analyzeCiLog', () => {
  it('detects a failing automated test from assertion output', () => {
    const result = analyzeCiLog('AssertionError: expected 22 to equal 24')

    expect(result.title).toBe('Failing automated test')
    expect(result.category).toBe('test failure')
    expect(result.commands).toContain('npm run test:unit')
  })

  it('detects missing dependencies from module resolution errors', () => {
    const result = analyzeCiLog("Error: Cannot find module '@testing-library/jest-dom'")

    expect(result.title).toBe('Missing dependency')
    expect(result.confidence).toBeGreaterThan(90)
  })

  it('detects missing GitHub secrets', () => {
    const result = analyzeCiLog('Missing required environment variable STRIPE_SECRET_KEY')

    expect(result.title).toBe('Missing secret or environment variable')
    expect(result.severity).toBe('critical')
  })

  it('detects flaky browser automation from timeout output', () => {
    const result = analyzeCiLog("TimeoutError: page.getByRole('button').timed out")

    expect(result.title).toBe('Flaky or timing-sensitive test')
    expect(result.commands).toContain('npx playwright test --trace on')
  })

  it('detects TypeScript compiler failures', () => {
    const result = analyzeCiLog("TS2339: Property 'plan' does not exist on type User")

    expect(result.title).toBe('TypeScript build failure')
    expect(result.category).toBe('typecheck')
  })

  it('falls back safely for unknown CI failures', () => {
    const result = analyzeCiLog('Error: Process completed with exit code 1')

    expect(result.title).toBe('General CI failure')
    expect(result.commands).toContain('npm run build')
  })

  it('returns an empty-log state when no log is provided', () => {
    const result = analyzeCiLog('   ')

    expect(result.title).toBe('Empty log')
    expect(result.minutesSaved).toBe(0)
  })
})

describe('business calculations', () => {
  it('estimates monthly savings from recurring failures', () => {
    const savings = calculateMonthlySavings({
      failuresPerWeek: 6,
      minutesPerFailure: 35,
      hourlyRate: 28,
    })

    expect(savings).toBe(424)
  })

  it('recommends a plan based on the value recovered', () => {
    expect(recommendPlan(120)).toBe('Student at GBP 7/month')
    expect(recommendPlan(424)).toBe('Pro at GBP 19/month')
    expect(recommendPlan(1200)).toBe('Team at GBP 79/month')
  })
})
