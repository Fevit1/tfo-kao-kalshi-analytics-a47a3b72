// KAO — Kalshi Analytics Optimizer
// POST /api/analyze — Three-layer analysis pipeline:
//   Layer 1: Kalshi market data (passed in request body)
//   Layer 2: Perplexity Sonar — real-world context + citations
//   Layer 3: Anthropic Claude — structured opportunity scoring
//
// Foundation stub: Full Perplexity + Claude pipeline is implemented here.
// Input validation and mock fallback are in place for safety.

import { validateAnalyzeInput, validateClaudeOutput } from '@/lib/validation'

/**
 * Claude system prompt — verbatim from PRD Section 4.
 * Must not be modified without client approval.
 */
const CLAUDE_SYSTEM_PROMPT = `You are a prediction market analyst. Your job is to assess whether a Kalshi prediction market is mispriced based on real-world evidence.

You will be given:
1. The market question and current implied probability (from the Yes price)
2. Real-world context from recent news and analysis
3. The market's close date and rules

Your task is to:
1. Assess the true probability of the market resolving YES based on the evidence
2. Compare your assessed probability to the market's implied probability
3. Identify whether this represents a trading opportunity (YES if you think probability is higher than implied, NO if lower, PASS if roughly accurate or too uncertain)
4. Score the opportunity from 1-10 (10 = extremely strong edge, 1 = no edge or too uncertain)

Respond ONLY with a JSON object in this exact format:
{
  "score": <number 1-10>,
  "direction": "<YES|NO|PASS>",
  "assessed_probability": <number 0-100>,
  "implied_probability": <number 0-100>,
  "confidence": "<high|medium|low>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "key_uncertainties": ["<uncertainty 1>", "<uncertainty 2>"],
  "prose_explanation": "<2-3 paragraph plain English explanation of your reasoning>"
}

Be calibrated and honest. PASS is often the right answer. Only recommend YES or NO when you see genuine evidence of mispricing.`

/**
 * Two-pass JSON extraction from Claude response text.
 * Pass 1: Extract from ```json ... ``` fences.
 * Pass 2: Find first { ... } block and attempt parse.
 * @param {string} text
 * @returns {{ parsed: Object | null, rawText: string }}
 */
function extractClaudeJSON(text) {
  // Pass 1: Look for ```json ... ``` fence
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim())
      return { parsed, rawText: text }
    } catch {
      // Fall through to pass 2
    }
  }

  // Pass 1b: Look for ``` ... ``` fence (no language tag)
  const plainFenceMatch = text.match(/```\s*([\s\S]*?)```/)
  if (plainFenceMatch) {
    try {
      const parsed = JSON.parse(plainFenceMatch[1].trim())
      return { parsed, rawText: text }
    } catch {
      // Fall through to pass 2
    }
  }

  // Pass 2: Find the outermost { } block
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1))
      return { parsed, rawText: text }
    } catch {
      // JSON parse failed entirely
    }
  }

  return { parsed: null, rawText: text }
}

export async function POST(request) {
  // --- Parse request body ---
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON', code: 'INVALID_JSON' },
      { status: 400 }
    )
  }

  // --- Validate and sanitize input ---
  const validation = validateAnalyzeInput(body)
  if (!validation.valid) {
    return Response.json(
      { error: validation.error, code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { ticker, title, close_date, yes_price, implied_probability, rules_text } =
    validation.sanitized

  // --- Check required API keys ---
  const perplexityKey = process.env.PERPLEXITY_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const anthropicModel = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022'

  if (!anthropicKey) {
    console.error('[/api/analyze] ANTHROPIC_API_KEY is not set')
    return Response.json(
      {
        error: 'Anthropic API key is not configured.',
        code: 'MISSING_ANTHROPIC_KEY',
      },
      { status: 500 }
    )
  }

  // =========================================================
  // LAYER 2: Perplexity Sonar — real-world context
  // =========================================================
  let perplexityContext = null
  let perplexityCitations = []
  let perplexityAvailable = true

  if (perplexityKey) {
    try {
      const perplexityPrompt = `Provide current, factual information relevant to this prediction market question: "${title}"

Close date: ${close_date ?? 'unknown'}

Focus on:
1. Recent news and developments (last 7-30 days) most relevant to this question
2. Expert forecasts or polling data if applicable  
3. Key factors that would influence whether this resolves YES or NO
4. Current probability estimates from other sources if available

Be concise and factual. Cite your sources.`

      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'user',
              content: perplexityPrompt,
            },
          ],
          max_tokens: 1024,
          return_citations: true,
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      })

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json()
        const choice = perplexityData.choices?.[0]
        if (choice?.message?.content) {
          perplexityContext = choice.message.content
        }
        // Citations may be in the response root or in the choice
        const rawCitations =
          perplexityData.citations ??
          choice?.citations ??
          []
        if (Array.isArray(rawCitations)) {
          perplexityCitations = rawCitations.filter(
            (c) => typeof c === 'string' && c.startsWith('https://')
          )
        }
      } else {
        const errText = await perplexityResponse.text().catch(() => '')
        console.warn(
          `[/api/analyze] Perplexity returned ${perplexityResponse.status}:`,
          errText
        )
        perplexityAvailable = false
      }
    } catch (perplexityError) {
      console.warn('[/api/analyze] Perplexity call failed — proceeding Claude-only:', perplexityError?.message ?? perplexityError)
      perplexityAvailable = false
    }
  } else {
    console.warn('[/api/analyze] PERPLEXITY_API_KEY not set — proceeding Claude-only')
    perplexityAvailable = false
  }

  // =========================================================
  // LAYER 3: Anthropic Claude — structured opportunity scoring
  // =========================================================
  const contextSection = perplexityContext
    ? `\n\n## Real-World Context (from Perplexity)\n${perplexityContext}`
    : '\n\n## Real-World Context\n(Context unavailable — analysis based on market data only)'

  const rulesSection = rules_text
    ? `\n\n## Market Rules\n${rules_text}`
    : ''

  const userMessage = `## Market Question
${title}

## Current Market Data
- Ticker: ${ticker}
- Yes Price (Implied Probability): ${yes_price}¢ / ${implied_probability}%
- Close Date: ${close_date ?? 'Unknown'}${contextSection}${rulesSection}

Please analyze this market and return your assessment in the specified JSON format.`

  let claudeRawResponse = ''
  let analysisResult

  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 2048,
        system: CLAUDE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout for Claude
    })

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text().catch(() => '')
      console.error(`[/api/analyze] Anthropic returned ${claudeResponse.status}:`, errText)
      return Response.json(
        {
          error: `Claude API error (${claudeResponse.status}). Please try again.`,
          code: 'CLAUDE_API_ERROR',
        },
        { status: 502 }
      )
    }

    const claudeData = await claudeResponse.json()
    claudeRawResponse = claudeData.content?.[0]?.text ?? ''

    // --- Two-pass JSON extraction ---
    const { parsed, rawText } = extractClaudeJSON(claudeRawResponse)

    if (!parsed) {
      // Claude JSON parse failed — return prose-only fallback
      console.error('[/api/analyze] Claude JSON parse failed. Raw response:', claudeRawResponse)
      return Response.json({
        ticker,
        prose_only: true,
        score: null,
        direction: null,
        confidence: null,
        assessed_probability: null,
        implied_probability,
        key_factors: [],
        key_uncertainties: [],
        prose_explanation: claudeRawResponse,
        perplexity_context: perplexityContext,
        perplexity_citations: perplexityCitations,
        perplexity_available: perplexityAvailable,
        analyzed_at: new Date().toISOString(),
      })
    }

    // --- validateClaudeOutput schema validation ---
    const { valid, validated, error: validationError } = validateClaudeOutput(parsed)

    if (!valid) {
      console.error('[/api/analyze] Claude output failed schema validation:', validationError)
      console.error('[/api/analyze] Raw Claude response:', claudeRawResponse)
      // Return prose-only fallback
      return Response.json({
        ticker,
        prose_only: true,
        score: null,
        direction: null,
        confidence: null,
        assessed_probability: null,
        implied_probability,
        key_factors: [],
        key_uncertainties: [],
        prose_explanation: claudeRawResponse,
        perplexity_context: perplexityContext,
        perplexity_citations: perplexityCitations,
        perplexity_available: perplexityAvailable,
        analyzed_at: new Date().toISOString(),
      })
    }

    // --- Build final AnalysisResult ---
    analysisResult = {
      ticker,
      ...validated,
      perplexity_context: perplexityContext,
      perplexity_citations: perplexityCitations,
      perplexity_available: perplexityAvailable,
      prose_only: false,
      analyzed_at: new Date().toISOString(),
    }

    return Response.json(analysisResult)
  } catch (claudeError) {
    console.error('[/api/analyze] Claude call threw:', claudeError?.message ?? claudeError)
    return Response.json(
      {
        error: 'Analysis pipeline failed. Please try again.',
        code: 'PIPELINE_ERROR',
      },
      { status: 500 }
    )
  }
}