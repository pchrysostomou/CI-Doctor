import { analyzeCiLog, type AnalysisResult, type Severity } from '../src/lib/analyzer'

type AnalysisSource = 'backend-rules' | 'ai-backend'

type ApiResponse = {
  analysis: AnalysisResult
  source: AnalysisSource
  note: string
}

const responseSchema = {
  additionalProperties: false,
  properties: {
    category: { type: 'string' },
    commands: {
      items: { type: 'string' },
      maxItems: 4,
      minItems: 1,
      type: 'array',
    },
    confidence: { maximum: 100, minimum: 0, type: 'number' },
    fixSteps: {
      items: { type: 'string' },
      maxItems: 5,
      minItems: 1,
      type: 'array',
    },
    learningNote: { type: 'string' },
    likelyCause: { type: 'string' },
    minutesSaved: { maximum: 120, minimum: 0, type: 'number' },
    severity: { enum: ['critical', 'high', 'medium', 'low'], type: 'string' },
    summary: { type: 'string' },
    title: { type: 'string' },
  },
  required: [
    'title',
    'category',
    'severity',
    'summary',
    'likelyCause',
    'fixSteps',
    'commands',
    'confidence',
    'minutesSaved',
    'learningNote',
  ],
  type: 'object',
}

const geminiResponseSchema = {
  propertyOrdering: responseSchema.required,
  properties: {
    title: {
      description: 'Short diagnosis title.',
      type: 'STRING',
    },
    category: {
      description: 'Failure category, such as dependency, test failure, environment, lint, or typecheck.',
      type: 'STRING',
    },
    severity: {
      description: 'Impact level for the failure.',
      enum: ['critical', 'high', 'medium', 'low'],
      type: 'STRING',
    },
    summary: {
      description: 'Brief explanation of what failed.',
      type: 'STRING',
    },
    likelyCause: {
      description: 'Most likely root cause based only on the pasted log.',
      type: 'STRING',
    },
    fixSteps: {
      description: 'Actionable steps the developer should take next.',
      items: { type: 'STRING' },
      maxItems: 5,
      minItems: 1,
      type: 'ARRAY',
    },
    commands: {
      description: 'Safe local commands to verify the fix.',
      items: { type: 'STRING' },
      maxItems: 4,
      minItems: 1,
      type: 'ARRAY',
    },
    confidence: {
      description: 'Confidence score from 0 to 100.',
      maximum: 100,
      minimum: 0,
      type: 'NUMBER',
    },
    minutesSaved: {
      description: 'Estimated debugging minutes saved.',
      maximum: 120,
      minimum: 0,
      type: 'NUMBER',
    },
    learningNote: {
      description: 'Short teaching note for a junior developer.',
      type: 'STRING',
    },
  },
  required: responseSchema.required,
  type: 'OBJECT',
}

const environment = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
    status,
  })
}

function getEnv(name: string): string | undefined {
  const value = environment.process?.env?.[name]
  return value && value.trim().length > 0 ? value : undefined
}

function describeProviderError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'unknown provider error'
}

function isSeverity(value: unknown): value is Severity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
}

function sanitizeAnalysis(value: unknown, fallback: AnalysisResult): AnalysisResult {
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const candidate = value as Partial<AnalysisResult>
  return {
    title: typeof candidate.title === 'string' ? candidate.title : fallback.title,
    category: typeof candidate.category === 'string' ? candidate.category : fallback.category,
    severity: isSeverity(candidate.severity) ? candidate.severity : fallback.severity,
    summary: typeof candidate.summary === 'string' ? candidate.summary : fallback.summary,
    likelyCause:
      typeof candidate.likelyCause === 'string' ? candidate.likelyCause : fallback.likelyCause,
    fixSteps:
      Array.isArray(candidate.fixSteps) && candidate.fixSteps.length > 0
        ? candidate.fixSteps.filter((step) => typeof step === 'string').slice(0, 5)
        : fallback.fixSteps,
    commands:
      Array.isArray(candidate.commands) && candidate.commands.length > 0
        ? candidate.commands.filter((command) => typeof command === 'string').slice(0, 4)
        : fallback.commands,
    confidence:
      typeof candidate.confidence === 'number'
        ? Math.max(0, Math.min(100, candidate.confidence))
        : fallback.confidence,
    minutesSaved:
      typeof candidate.minutesSaved === 'number'
        ? Math.max(0, Math.min(120, candidate.minutesSaved))
        : fallback.minutesSaved,
    learningNote:
      typeof candidate.learningNote === 'string'
        ? candidate.learningNote
        : fallback.learningNote,
  }
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const response = payload as {
    output?: Array<{ content?: Array<{ text?: unknown }> }>
    output_text?: unknown
  }

  if (typeof response.output_text === 'string') {
    return response.output_text
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .find((text): text is string => typeof text === 'string') ?? ''
  )
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>
      }
    }>
  }

  return (
    response.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .find((text): text is string => typeof text === 'string') ?? ''
  )
}

function buildPrompt(logText: string): string {
  return `Analyze this GitHub Actions or automated test log:\n\n${logText.slice(0, 12000)}`
}

async function analyzeWithGemini(
  logText: string,
  fallback: AnalysisResult,
  apiKey: string,
): Promise<ApiResponse> {
  const model = getEnv('GEMINI_MODEL') ?? 'gemini-3.5-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildPrompt(logText) }],
            role: 'user',
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
        },
        systemInstruction: {
          parts: [
            {
              text: 'You are CI Doctor, a concise CI debugging assistant for junior developers. Return practical, safe debugging guidance. Do not claim files exist unless they are shown in the log.',
            },
          ],
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}`)
  }

  const payload: unknown = await response.json()
  const outputText = extractGeminiText(payload)
  const parsed: unknown = JSON.parse(outputText)

  return {
    analysis: sanitizeAnalysis(parsed, fallback),
    source: 'ai-backend',
    note: `Analyzed by the backend with Gemini (${model}).`,
  }
}

async function analyzeWithOpenAi(
  logText: string,
  fallback: AnalysisResult,
  apiKey: string,
): Promise<ApiResponse> {
  const model = getEnv('OPENAI_MODEL') ?? 'gpt-5.4-mini'

  const response = await fetch('https://api.openai.com/v1/responses', {
    body: JSON.stringify({
      input: buildPrompt(logText),
      instructions:
        'You are CI Doctor, a concise CI debugging assistant for junior developers. Return practical, safe debugging guidance. Do not claim files exist unless they are shown in the log.',
      max_output_tokens: 1200,
      model,
      text: {
        format: {
          name: 'ci_diagnosis',
          schema: responseSchema,
          strict: true,
          type: 'json_schema',
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`)
  }

  const payload: unknown = await response.json()
  const outputText = extractOutputText(payload)
  const parsed: unknown = JSON.parse(outputText)

  return {
    analysis: sanitizeAnalysis(parsed, fallback),
    source: 'ai-backend',
    note: `Analyzed by the backend with OpenAI (${model}).`,
  }
}

async function analyzeWithConfiguredProvider(
  logText: string,
  fallback: AnalysisResult,
): Promise<ApiResponse> {
  const geminiApiKey = getEnv('GEMINI_API_KEY') ?? getEnv('GOOGLE_API_KEY')
  const openAiApiKey = getEnv('OPENAI_API_KEY')

  if (geminiApiKey) {
    try {
      return await analyzeWithGemini(logText, fallback, geminiApiKey)
    } catch (error) {
      if (!openAiApiKey) {
        return {
          analysis: fallback,
          source: 'backend-rules',
          note: `Gemini analysis was unavailable (${describeProviderError(
            error,
          )}), so the backend used deterministic CI rules.`,
        }
      }
    }
  }

  if (openAiApiKey) {
    try {
      return await analyzeWithOpenAi(logText, fallback, openAiApiKey)
    } catch (error) {
      return {
        analysis: fallback,
        source: 'backend-rules',
        note: `AI analysis was unavailable (${describeProviderError(
          error,
        )}), so the backend used deterministic CI rules.`,
      }
    }
  }

  return {
    analysis: fallback,
    source: 'backend-rules',
    note: 'No GEMINI_API_KEY or OPENAI_API_KEY is configured, so the backend used deterministic CI rules.',
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const body: unknown = await request.json()
    const logText =
      body && typeof body === 'object' && typeof (body as { logText?: unknown }).logText === 'string'
        ? (body as { logText: string }).logText
        : ''

    const fallback = analyzeCiLog(logText)

    return json(await analyzeWithConfiguredProvider(logText, fallback))
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400)
  }
}
