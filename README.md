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
npx playwright install chromium
npm run test:e2e
```

Build production assets:

```bash
npm run build
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
