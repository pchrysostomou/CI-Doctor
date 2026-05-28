# CI Doctor

CI Doctor is a product-style React app that turns failing GitHub Actions logs into a clear diagnosis, fix plan, verification commands, and pricing/value estimate.

It is designed as both a portfolio project and a micro-SaaS MVP for students, junior developers, bootcamp cohorts, indie hackers, and small teams who lose time reading noisy CI logs.

## Product idea

The app helps a user paste a failed CI/test log and receive:

- failure category
- severity
- likely cause
- fix steps
- verification commands
- a short learning note
- estimated value of time saved

Possible revenue model:

- Student: free to GBP 7/month
- Pro: GBP 19/month
- Team: GBP 79/month
- Education licence for bootcamps or university cohorts

## Tech stack

- React
- TypeScript
- Vite
- Vitest
- Testing Library
- Playwright
- GitHub Actions

## Local commands

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

The local Vite server runs the frontend. The Vercel deployment also exposes the
serverless API route at `/api/analyze`.

Run lint:

```bash
npm run lint
```

Run type checks:

```bash
npm run typecheck
```

Run unit and component tests:

```bash
npm run test:unit
```

Run Playwright browser tests:

```bash
npm run setup:browsers
npm run test:e2e
```

Build production assets:

```bash
npm run build
```

Run the full local CI suite:

```bash
npm run ci
```

## What GitHub CI tests

The workflow in `.github/workflows/ci.yml` runs on pull requests and pushes to `main`.

It checks:

- ESLint
- TypeScript type checking
- unit tests for CI log analysis logic
- component tests for the React UI
- production build
- Playwright browser automation

That gives you the classic professional GitHub signal: if the green check passes, the app builds and the main user journey still works.

## AI backend

CI Doctor now has two analysis modes:

- deterministic rules for free local/demo usage
- optional OpenAI-backed analysis through the Vercel serverless route `api/analyze.ts`

No API key is required for the app to run. Without a key, the backend and browser fall back to deterministic CI rules.

To enable AI analysis in Vercel, add these environment variables:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

Never put an OpenAI API key in the React frontend. The key belongs only in Vercel environment variables so it stays server-side.

## How the app works

1. The user pastes a GitHub Actions or test log.
2. The React UI calls `/api/analyze`.
3. On Vercel, the serverless function checks for `OPENAI_API_KEY`.
4. If the key exists, the backend calls OpenAI's Responses API and asks for structured JSON.
5. If the key is missing or the AI request fails, the backend returns deterministic rule-based analysis.
6. The UI displays the diagnosis, source, confidence, fix steps, commands, and learning note.

## Automation test coverage

Unit tests in `src/lib/analyzer.test.ts` check the core CI diagnosis rules:

- failing test detection
- missing dependency detection
- missing secret/environment variable detection
- empty log handling
- monthly savings calculation
- pricing plan recommendation

Component tests in `src/App.test.tsx` check the React app behaviour:

- the app loads with a useful default diagnosis
- demo logs can be switched and analyzed
- saved cases are written to local browser storage

End-to-end tests in `e2e/ci-doctor.spec.ts` open the app in Chromium through Playwright:

- analyze a dependency failure
- verify the suggested command appears
- save the analysis into history
- move the pricing sliders and confirm the Team plan appears
