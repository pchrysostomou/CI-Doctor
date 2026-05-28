import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Code2,
  Gauge,
  History,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
  Wand2,
  Zap,
} from 'lucide-react'
import './App.css'
import { analyzeCiLog, calculateMonthlySavings, recommendPlan } from './lib/analyzer'
import { logSamples } from './data/logSamples'
import type { AnalysisResult, SavedAnalysis } from './lib/analyzer'

const STORAGE_KEY = 'ci-doctor-history'
const pipelineSteps = ['checkout', 'install', 'test', 'build', 'deploy']
const liveEvents = [
  'runner warmed',
  'cache restored',
  'test failure found',
  'fix plan drafted',
  'value estimated',
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value)
}

function isSavedAnalysis(value: unknown): value is SavedAnalysis {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SavedAnalysis>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.severity === 'string' &&
    typeof candidate.createdAt === 'string'
  )
}

function loadHistory(): SavedAnalysis[] {
  try {
    const rawHistory = window.localStorage.getItem(STORAGE_KEY)
    const parsedHistory: unknown = rawHistory ? JSON.parse(rawHistory) : []
    return Array.isArray(parsedHistory) ? parsedHistory.filter(isSavedAnalysis) : []
  } catch {
    return []
  }
}

function App() {
  const [logText, setLogText] = useState(logSamples[0].log)
  const [selectedSampleId, setSelectedSampleId] = useState(logSamples[0].id)
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult>(() =>
    analyzeCiLog(logSamples[0].log),
  )
  const [history, setHistory] = useState<SavedAnalysis[]>(() => loadHistory())
  const [failuresPerWeek, setFailuresPerWeek] = useState(6)
  const [minutesPerFailure, setMinutesPerFailure] = useState(35)
  const [hourlyRate, setHourlyRate] = useState(28)
  const [activeSignalIndex, setActiveSignalIndex] = useState(0)
  const [saveMessage, setSaveMessage] = useState('')

  const livePreview = useMemo(() => analyzeCiLog(logText), [logText])
  const monthlySavings = calculateMonthlySavings({
    failuresPerWeek,
    minutesPerFailure,
    hourlyRate,
  })
  const suggestedPlan = recommendPlan(monthlySavings)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSignalIndex((current) => (current + 1) % pipelineSteps.length)
    }, 1400)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!saveMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(''), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [saveMessage])

  function applySample(sampleId: string) {
    const sample = logSamples.find((item) => item.id === sampleId)
    if (!sample) {
      return
    }

    setSelectedSampleId(sample.id)
    setLogText(sample.log)
    setLastAnalysis(analyzeCiLog(sample.log))
  }

  function analyzeCurrentLog() {
    setLastAnalysis(analyzeCiLog(logText))
  }

  function saveCurrentAnalysis() {
    const result = analyzeCiLog(logText)
    const saved: SavedAnalysis = {
      id: `${Date.now()}-${result.category}`,
      title: result.title,
      category: result.category,
      severity: result.severity,
      createdAt: new Date().toISOString(),
    }

    setLastAnalysis(result)
    setSaveMessage(`${result.title} saved`)
    setHistory((current) => [saved, ...current].slice(0, 5))
  }

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Product navigation">
        <a className="brand" href="#workspace" aria-label="CI Doctor home">
          <span className="brand-mark">
            <Activity aria-hidden="true" size={20} />
          </span>
          <span>CI Doctor</span>
        </a>
        <nav className="topnav" aria-label="Sections">
          <a href="#workspace">Analyze</a>
          <a href="#money">Revenue</a>
          <a href="#automation">Tests</a>
        </nav>
      </header>

      <section className="hero-band" id="workspace">
        <div className="hero-copy">
          <p className="eyebrow">AI-style CI diagnosis for juniors and small teams</p>
          <h1>Turn failing GitHub Actions logs into a clear fix plan.</h1>
          <p className="lede">
            Paste a noisy CI log, classify the failure, estimate the impact, and learn the
            verification command you should run before pushing again.
          </p>
        </div>

        <div className="signal-board" aria-label="CI signal preview">
          <div className="signal-glow" aria-hidden="true" />
          {pipelineSteps.map((step, index) => (
            <div
              className={`signal-step ${index === 2 ? 'failed' : 'passed'} ${
                activeSignalIndex === index ? 'live' : ''
              }`}
              key={step}
            >
              <span>{step}</span>
              {index === 2 ? (
                <AlertTriangle aria-hidden="true" size={18} />
              ) : (
                <CheckCircle2 aria-hidden="true" size={18} />
              )}
            </div>
          ))}
          <div className="live-feed" aria-label="Live CI events">
            {liveEvents.map((event, index) => (
              <span className={activeSignalIndex === index ? 'active' : ''} key={event}>
                <Zap aria-hidden="true" size={13} />
                {event}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="workbench" aria-label="CI log analyzer">
        <div className="input-pane">
          <div className="section-title">
            <Code2 aria-hidden="true" size={21} />
            <div>
              <p className="kicker">Input</p>
              <h2>CI log</h2>
            </div>
          </div>

          <div className="sample-row" aria-label="Demo logs">
            {logSamples.map((sample) => (
              <button
                className={selectedSampleId === sample.id ? 'sample active' : 'sample'}
                key={sample.id}
                onClick={() => applySample(sample.id)}
                type="button"
              >
                <Play aria-hidden="true" size={15} />
                {sample.label}
              </button>
            ))}
          </div>

          <label className="log-label" htmlFor="ci-log">
            Paste GitHub Actions output
          </label>
          <textarea
            className="log-input"
            id="ci-log"
            onChange={(event) => {
              setSelectedSampleId('custom')
              setLogText(event.target.value)
            }}
            spellCheck={false}
            value={logText}
          />

          <div className="action-row">
            <button className="primary-button" onClick={analyzeCurrentLog} type="button">
              <Wand2 aria-hidden="true" size={18} />
              Analyze log
            </button>
            <button className="secondary-button" onClick={saveCurrentAnalysis} type="button">
              <Save aria-hidden="true" size={18} />
              Save case
            </button>
          </div>
          {saveMessage ? (
            <p className="save-toast" role="status">
              <CheckCircle2 aria-hidden="true" size={17} />
              {saveMessage}
            </p>
          ) : null}
        </div>

        <DiagnosisPanel result={lastAnalysis} preview={livePreview} />
      </section>

      <section className="insight-grid" aria-label="Business and product model">
        <div className="business-panel" id="money">
          <div className="section-title">
            <CircleDollarSign aria-hidden="true" size={21} />
            <div>
              <p className="kicker">Business model</p>
              <h2>Money logic</h2>
            </div>
          </div>

          <div className="calculator">
            <label>
              Failing runs per week
              <input
                max="30"
                min="1"
                onChange={(event) => setFailuresPerWeek(Number(event.target.value))}
                type="range"
                value={failuresPerWeek}
              />
              <strong>{failuresPerWeek}</strong>
            </label>
            <label>
              Minutes lost per failure
              <input
                max="90"
                min="10"
                onChange={(event) => setMinutesPerFailure(Number(event.target.value))}
                type="range"
                value={minutesPerFailure}
              />
              <strong>{minutesPerFailure}</strong>
            </label>
            <label>
              Hourly developer value
              <input
                max="100"
                min="12"
                onChange={(event) => setHourlyRate(Number(event.target.value))}
                type="range"
                value={hourlyRate}
              />
              <strong>{formatCurrency(hourlyRate)}</strong>
            </label>
          </div>

          <div className="money-result">
            <span>Estimated monthly time value</span>
            <strong>{formatCurrency(monthlySavings)}</strong>
            <p>
              Suggested pricing anchor: <b>{suggestedPlan}</b>
            </p>
            <div className="revenue-meter" aria-hidden="true">
              <span
                style={{ width: `${Math.min((monthlySavings / 1200) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="pricing-panel">
          <div className="pricing-row">
            <BadgePoundSterling aria-hidden="true" size={20} />
            <div>
              <h3>Student</h3>
              <p>Free to GBP 7/month for limited analyses and learning notes.</p>
            </div>
          </div>
          <div className="pricing-row highlighted">
            <Sparkles aria-hidden="true" size={20} />
            <div>
              <h3>Pro</h3>
              <p>GBP 19/month for saved cases, deeper diagnosis, and repo templates.</p>
            </div>
          </div>
          <div className="pricing-row">
            <ShieldCheck aria-hidden="true" size={20} />
            <div>
              <h3>Team</h3>
              <p>GBP 79/month for shared history, PR comments, and flaky-test reports.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="automation-band" id="automation" aria-label="Automation tests">
        <div className="section-title">
          <ClipboardList aria-hidden="true" size={21} />
          <div>
            <p className="kicker">GitHub CI</p>
            <h2>Automation tests included</h2>
          </div>
        </div>

        <div className="automation-grid">
          <TestItem
            icon={<Bot aria-hidden="true" size={20} />}
            title="Unit tests"
            text="Checks the analyzer rules, savings calculator, and plan recommendation."
          />
          <TestItem
            icon={<CheckCircle2 aria-hidden="true" size={20} />}
            title="Component tests"
            text="Clicks the React app, loads demo logs, and confirms the diagnosis changes."
          />
          <TestItem
            icon={<TimerReset aria-hidden="true" size={20} />}
            title="Playwright e2e"
            text="Runs the built web app in a browser and verifies the main user journey."
          />
          <TestItem
            icon={<Gauge aria-hidden="true" size={20} />}
            title="CI value check"
            text="Shows how saved developer time becomes pricing logic for a paid product."
          />
        </div>
      </section>

      <section className="history-band" aria-label="Saved analyses">
        <div className="section-title">
          <History aria-hidden="true" size={21} />
          <div>
            <p className="kicker">Local demo storage</p>
            <h2>Saved cases</h2>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="empty-state">No saved cases yet.</p>
        ) : (
          <ul className="history-list" aria-label="Saved analysis history">
            {history.map((item) => (
              <li key={item.id}>
                <span className={`severity-dot ${item.severity}`} />
                <span>{item.title}</span>
                <small>{item.category}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

type DiagnosisPanelProps = {
  result: AnalysisResult
  preview: AnalysisResult
}

function DiagnosisPanel({ result, preview }: DiagnosisPanelProps) {
  const previewChanged = preview.title !== result.title

  return (
    <aside className="diagnosis-pane" aria-label="Diagnosis result">
      <div className="result-header">
        <div>
          <p className="kicker">Diagnosis</p>
          <h2>{result.title}</h2>
        </div>
        <span className={`severity-pill ${result.severity}`}>{result.severity}</span>
      </div>

      <p className="summary">{result.summary}</p>

      <div className="metrics-row">
        <Metric label="Category" value={result.category} />
        <Metric label="Confidence" value={`${result.confidence}%`} />
        <Metric label="Time saved" value={`${result.minutesSaved}m`} />
      </div>

      <div className="confidence-card" aria-label="Diagnosis confidence">
        <div>
          <TrendingUp aria-hidden="true" size={18} />
          <span>Diagnosis confidence</span>
        </div>
        <strong>{result.confidence}%</strong>
        <div className="confidence-track">
          <span style={{ width: `${result.confidence}%` }} />
        </div>
      </div>

      <div className="diagnosis-block">
        <h3>Likely cause</h3>
        <p>{result.likelyCause}</p>
      </div>

      <div className="diagnosis-block">
        <h3>Fix plan</h3>
        <ol>
          {result.fixSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="command-strip">
        {result.commands.map((command) => (
          <code key={command}>{command}</code>
        ))}
      </div>

      <div className="learning-note">
        <ArrowRight aria-hidden="true" size={18} />
        <p>{result.learningNote}</p>
      </div>

      {previewChanged ? (
        <p className="preview-warning">
          The draft log now looks like <b>{preview.title}</b>. Press Analyze log to lock
          this result.
        </p>
      ) : null}
    </aside>
  )
}

type MetricProps = {
  label: string
  value: string
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type TestItemProps = {
  icon: React.ReactNode
  title: string
  text: string
}

function TestItem({ icon, title, text }: TestItemProps) {
  return (
    <div className="test-item">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

export default App
