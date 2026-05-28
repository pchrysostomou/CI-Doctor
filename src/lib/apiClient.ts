import { analyzeCiLog, type AnalysisResult, type Severity } from './analyzer'

export type AnalysisSource = 'browser-rules' | 'backend-rules' | 'ai-backend'

export type AnalysisResponse = {
  analysis: AnalysisResult
  source: AnalysisSource
  note: string
}

const sourceFallback: AnalysisResponse = {
  analysis: analyzeCiLog(''),
  source: 'browser-rules',
  note: 'The browser used deterministic rules because the backend was unavailable.',
}

function isSeverity(value: unknown): value is Severity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AnalysisResult>
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.category === 'string' &&
    isSeverity(candidate.severity) &&
    typeof candidate.summary === 'string' &&
    typeof candidate.likelyCause === 'string' &&
    Array.isArray(candidate.fixSteps) &&
    candidate.fixSteps.every((step) => typeof step === 'string') &&
    Array.isArray(candidate.commands) &&
    candidate.commands.every((command) => typeof command === 'string') &&
    typeof candidate.confidence === 'number' &&
    typeof candidate.minutesSaved === 'number' &&
    typeof candidate.learningNote === 'string'
  )
}

function isAnalysisSource(value: unknown): value is AnalysisSource {
  return value === 'browser-rules' || value === 'backend-rules' || value === 'ai-backend'
}

export async function requestAnalysis(logText: string): Promise<AnalysisResponse> {
  const fallback = analyzeCiLog(logText)

  try {
    const response = await fetch('/api/analyze', {
      body: JSON.stringify({ logText }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') {
      throw new Error('Backend returned an invalid payload')
    }

    const candidate = payload as Partial<AnalysisResponse>
    if (!isAnalysisResult(candidate.analysis) || !isAnalysisSource(candidate.source)) {
      throw new Error('Backend returned an invalid analysis')
    }

    return {
      analysis: candidate.analysis,
      source: candidate.source,
      note:
        typeof candidate.note === 'string'
          ? candidate.note
          : 'The backend returned a valid analysis.',
    }
  } catch {
    return {
      ...sourceFallback,
      analysis: fallback,
    }
  }
}
