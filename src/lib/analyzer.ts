export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type AnalysisResult = {
  title: string
  category: string
  severity: Severity
  summary: string
  likelyCause: string
  fixSteps: string[]
  commands: string[]
  confidence: number
  minutesSaved: number
  learningNote: string
}

export type SavedAnalysis = {
  id: string
  title: string
  category: string
  severity: Severity
  createdAt: string
}

type SavingsInput = {
  failuresPerWeek: number
  minutesPerFailure: number
  hourlyRate: number
}

const fallbackResult: AnalysisResult = {
  title: 'General CI failure',
  category: 'unknown',
  severity: 'medium',
  summary:
    'The log failed, but it does not match a strong known pattern yet. Start from the first stack trace and the command that returned a non-zero exit code.',
  likelyCause:
    'The workflow command exited with code 1. The useful clue is usually 10 to 30 lines above the final GitHub Actions error.',
  fixSteps: [
    'Find the first error line, not only the final Process completed message.',
    'Run the same command locally from the repository root.',
    'Make one focused change, then rerun the failing command before pushing.',
  ],
  commands: ['npm run lint', 'npm test', 'npm run build'],
  confidence: 45,
  minutesSaved: 12,
  learningNote:
    'CI logs are chronological. The final line says the job failed, but the root cause normally appears earlier.',
}

const patterns: Array<{
  match: RegExp
  result: AnalysisResult
}> = [
  {
    match: /(AssertionError|expected .* to|Tests?: .*failed|FAIL .*test)/i,
    result: {
      title: 'Failing automated test',
      category: 'test failure',
      severity: 'high',
      summary:
        'A test assertion failed. The application built enough to run tests, but the expected behaviour and actual result do not match.',
      likelyCause:
        'The business logic, fixture data, or test expectation changed without the test being updated intentionally.',
      fixSteps: [
        'Open the test file and line shown in the stack trace.',
        'Check whether the expected value or the implementation is now wrong.',
        'Add one extra edge-case test if this bug could return later.',
      ],
      commands: ['npm test -- --run', 'npm run test:unit'],
      confidence: 92,
      minutesSaved: 28,
      learningNote:
        'A failing test is usually a useful signal, not a broken CI setup. Treat it as a small product conversation between expected and actual behaviour.',
    },
  },
  {
    match: /(Cannot find module|ERR_MODULE_NOT_FOUND|Module not found|not found: .*package|Could not resolve)/i,
    result: {
      title: 'Missing dependency',
      category: 'dependency',
      severity: 'high',
      summary:
        'The build cannot resolve a package or module that the code imports. This often happens when package.json and the lockfile are out of sync.',
      likelyCause:
        'A dependency was used in code but not installed, installed in the wrong dependency group, or missing from the committed lockfile.',
      fixSteps: [
        'Install the missing package in dependencies or devDependencies.',
        'Commit both package.json and package-lock.json.',
        'Run a clean install locally to mirror GitHub Actions.',
      ],
      commands: ['npm install', 'npm ci', 'npm run build'],
      confidence: 95,
      minutesSaved: 32,
      learningNote:
        'GitHub Actions starts from a clean machine. If something only exists on your laptop, CI will expose it.',
    },
  },
  {
    match: /(Missing required environment variable|repository secrets|SECRET|API_KEY|process\.env)/i,
    result: {
      title: 'Missing secret or environment variable',
      category: 'environment',
      severity: 'critical',
      summary:
        'The job needs a secret or environment variable that is not available inside GitHub Actions.',
      likelyCause:
        'The variable exists locally in .env but has not been added to GitHub repository secrets or mapped into the workflow.',
      fixSteps: [
        'Add the variable in GitHub repository Settings > Secrets and variables > Actions.',
        'Reference it in the workflow using the secrets context.',
        'Keep tests using fake keys unless the job truly needs live credentials.',
      ],
      commands: ['npm run test:e2e', 'npm run build'],
      confidence: 90,
      minutesSaved: 35,
      learningNote:
        'Local .env files are not uploaded to GitHub. CI needs explicit secret configuration.',
    },
  },
  {
    match: /(TimeoutError|timed out|flaky|Retry #|intermittent)/i,
    result: {
      title: 'Flaky or timing-sensitive test',
      category: 'flaky test',
      severity: 'medium',
      summary:
        'The test depends on timing, network speed, animation, or a UI state that is not fully ready when the assertion runs.',
      likelyCause:
        'The test is racing the app instead of waiting for a stable user-visible condition.',
      fixSteps: [
        'Wait for a visible role, URL, or response that proves the page is ready.',
        'Avoid arbitrary sleeps and test implementation details.',
        'Run the test multiple times locally to confirm the flake is gone.',
      ],
      commands: ['npx playwright test --repeat-each=3', 'npx playwright test --trace on'],
      confidence: 86,
      minutesSaved: 40,
      learningNote:
        'Good automation waits like a user would: for visible state, not for a guessed number of milliseconds.',
    },
  },
  {
    match: /(ESLint|no-unused-vars|noUnusedLocals|lint|Parsing error)/i,
    result: {
      title: 'Lint or static analysis failure',
      category: 'lint',
      severity: 'medium',
      summary:
        'The code violates a lint or TypeScript rule before it reaches runtime testing.',
      likelyCause:
        'Unused code, invalid syntax, or a rule mismatch is blocking the CI quality gate.',
      fixSteps: [
        'Run the lint command locally and follow the first reported file.',
        'Remove unused imports and variables instead of disabling rules.',
        'Keep lint in CI because it catches cheap mistakes early.',
      ],
      commands: ['npm run lint', 'npm run typecheck'],
      confidence: 88,
      minutesSaved: 18,
      learningNote:
        'Lint failures are fast feedback. They keep small issues from becoming review noise.',
    },
  },
  {
    match: /(TS\d{4}|tsc|Type .* is not assignable|Property .* does not exist)/i,
    result: {
      title: 'TypeScript build failure',
      category: 'typecheck',
      severity: 'high',
      summary:
        'The TypeScript compiler found a type contract mismatch. The browser may never run this code until the type error is fixed.',
      likelyCause:
        'A function signature, prop shape, or API response type changed while callers still use the old contract.',
      fixSteps: [
        'Open the first TypeScript error and inspect the expected type.',
        'Fix the shared type or update the caller, depending on the real product contract.',
        'Run the full build because type errors can cascade.',
      ],
      commands: ['npm run typecheck', 'npm run build'],
      confidence: 89,
      minutesSaved: 25,
      learningNote:
        'TypeScript CI failures often point to design drift between modules, not just syntax mistakes.',
    },
  },
]

export function analyzeCiLog(logText: string): AnalysisResult {
  const normalizedLog = logText.trim()

  if (normalizedLog.length === 0) {
    return {
      ...fallbackResult,
      title: 'Empty log',
      severity: 'low',
      summary: 'Paste a CI log to receive a diagnosis.',
      confidence: 10,
      minutesSaved: 0,
    }
  }

  const matchedPattern = patterns.find((pattern) => pattern.match.test(normalizedLog))
  return matchedPattern ? matchedPattern.result : fallbackResult
}

export function calculateMonthlySavings({
  failuresPerWeek,
  minutesPerFailure,
  hourlyRate,
}: SavingsInput): number {
  const monthlyHoursLost = (failuresPerWeek * minutesPerFailure * 4.33) / 60
  return Math.round(monthlyHoursLost * hourlyRate)
}

export function recommendPlan(monthlySavings: number): string {
  if (monthlySavings >= 900) {
    return 'Team at GBP 79/month'
  }

  if (monthlySavings >= 180) {
    return 'Pro at GBP 19/month'
  }

  return 'Student at GBP 7/month'
}
