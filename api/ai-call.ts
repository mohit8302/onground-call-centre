/**
 * POST /api/ai-call: the server half of the AI voice call.
 *
 * The browser does speech-to-text and text-to-speech; this function only turns
 * the conversation so far into Claude's next spoken line (action "reply"), or
 * into a short call summary for the call log (action "summary"), using Google's
 * Gemini API. The API key stays here, read from GEMINI_API_KEY. Deployed as a
 * Vercel Function; in dev and preview, vite.config.ts serves the same handler.
 */
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { Content, GenerateContentConfig } from '@google/genai'

// A Flash model on the Gemini API's free tier; GEMINI_MODEL overrides it.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const OUTCOMES = ['Interested', 'Quote sent', 'Call back later', 'Not interested', 'No decision'] as const

// Limits keep the public endpoint cheap to abuse and the prompts small.
const MAX_TURNS = 60
const MAX_TEXT = 600

type Role = 'agent' | 'customer'
type Language = 'en-IN' | 'hi-IN'

interface Turn {
  speaker: 'ai' | 'human'
  text: string
}

interface LeadContext {
  name: string
  product: string
  price: number
  crossSell: string
  emi: string
  story: string[]
}

interface AiCallRequest {
  action: 'reply' | 'summary'
  role: Role
  language: Language
  lead: LeadContext
  turns: Turn[]
}

export interface AiCallResult {
  status: number
  body: { text: string; end: boolean } | { summary: string; outcome: string } | { error: string }
}

function str(v: unknown, max = MAX_TEXT): string | null {
  return typeof v === 'string' && v.length <= max ? v : null
}

/** Checks the untrusted request body; returns null if anything is off. */
function parse(body: unknown): AiCallRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const lead = b.lead as Record<string, unknown> | undefined
  if (b.action !== 'reply' && b.action !== 'summary') return null
  if (b.role !== 'agent' && b.role !== 'customer') return null
  if (b.language !== 'en-IN' && b.language !== 'hi-IN') return null
  if (!lead || typeof lead !== 'object') return null
  if (!Array.isArray(b.turns) || b.turns.length > MAX_TURNS) return null
  if (!Array.isArray(lead.story) || lead.story.length > 8) return null

  const turns: Turn[] = []
  for (const t of b.turns as Record<string, unknown>[]) {
    const text = str(t?.text)
    if ((t?.speaker !== 'ai' && t?.speaker !== 'human') || text === null) return null
    turns.push({ speaker: t.speaker, text })
  }
  const story = (lead.story as unknown[]).map((s) => str(s, 300))
  const fields = [str(lead.name, 80), str(lead.product, 120), str(lead.crossSell, 200), str(lead.emi, 300)]
  if (story.some((s) => s === null) || fields.some((f) => f === null) || typeof lead.price !== 'number') return null

  return {
    action: b.action,
    role: b.role,
    language: b.language,
    lead: {
      name: fields[0]!,
      product: fields[1]!,
      crossSell: fields[2]!,
      emi: fields[3]!,
      price: lead.price,
      story: story as string[],
    },
    turns,
  }
}

function facts(lead: LeadContext) {
  return [
    `Customer: ${lead.name}`,
    `Interested in: ${lead.product}, ₹${lead.price.toLocaleString('en-IN')}`,
    `Cross-sell to offer if it fits: ${lead.crossSell}`,
    `EMI: ${lead.emi}`,
    'What we know so far:',
    ...lead.story.map((s) => `- ${s}`),
  ].join('\n')
}

function systemPrompt(req: AiCallRequest) {
  const language =
    req.language === 'hi-IN'
      ? 'Speak in simple, conversational Hindi written in Devanagari script.'
      : 'Speak in natural, friendly Indian English.'
  const voice = [
    'This is a live phone-style voice call. Everything you write is read aloud by text-to-speech, and the other side is heard through speech recognition, so their words may contain recognition mistakes.',
    'Latency-sensitive; begin your visible answer immediately.',
    'Reply with one to three short spoken sentences. No lists, markdown, emojis or stage directions.',
    language,
  ].join(' ')

  if (req.role === 'agent') {
    return `You are Avani, an AI calling assistant for The Sleep Company's call centre, phoning a customer who showed interest in a product.

${voice}

When the call connects, greet ${req.lead.name} by name, say you are an AI assistant calling from The Sleep Company about their interest in the ${req.lead.product}, and ask whether now is a good time.
Your aim: understand what they need, answer their questions using only the facts below, mention the EMI option and the cross-sell when they fit naturally, and agree a clear next step (a store visit, a quote on WhatsApp, or a callback time).
Don't invent prices, discounts, stock or policies that aren't in the facts; offer to have a colleague confirm instead. If they say they're busy or not interested, respect it and offer a callback. If they ask you to stop calling or to delete their data, confirm you'll pass that on and end the call.
When the conversation is finished and you've said goodbye, put [END] at the very end of your last reply.

${facts(req.lead)}`
  }

  return `You are role-playing ${req.lead.name}, a customer, so a call-centre agent at The Sleep Company can practise a sales call. The person speaking to you is that agent.

${voice}

Stay in character as the customer for the whole call. Use the background below: you are genuinely interested but not yet convinced. Raise one or two realistic objections drawn from the background (price, comparing with a competitor, timing), one at a time, and let the agent handle them. Warm up if the agent listens well, answers clearly and offers a sensible next step; stay hesitant if they're pushy or vague. Don't coach the agent and don't step out of the role-play.
When the agent wraps up and you've said goodbye, put [END] at the very end of your last reply.

Background:
${facts(req.lead)}`
}

/**
 * The AI is always the "model" side. The call opens with a stage note, and
 * consecutive lines from the same speaker are merged so roles alternate.
 */
function toContents(req: AiCallRequest): Content[] {
  const opener = req.role === 'agent' ? '(The call connects. The customer has picked up.)' : '(Your phone rings and you pick up.)'
  const contents: Content[] = [{ role: 'user', parts: [{ text: opener }] }]
  for (const t of req.turns) {
    const role = t.speaker === 'ai' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    if (last.role === role) last.parts!.push({ text: t.text })
    else contents.push({ role, parts: [{ text: t.text }] })
  }
  return contents
}

// Low thinking keeps replies quick enough for a spoken conversation.
const BASE_CONFIG: GenerateContentConfig = {
  maxOutputTokens: 2000,
  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
}

async function reply(ai: GoogleGenAI, req: AiCallRequest): Promise<AiCallResult> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: toContents(req),
    config: { ...BASE_CONFIG, systemInstruction: systemPrompt(req) },
  })
  const raw = response.text?.trim()
  if (!raw) {
    // Blocked by a safety filter, or an empty answer: end politely rather than go silent.
    return { status: 200, body: { text: 'Sorry, I can’t continue with that. Let me pass you to a colleague.', end: true } }
  }
  const end = raw.includes('[END]')
  return { status: 200, body: { text: raw.replace(/\[END\]/g, '').replace(/\s+/g, ' ').trim(), end } }
}

async function summary(ai: GoogleGenAI, req: AiCallRequest): Promise<AiCallResult> {
  const transcript = req.turns
    .map((t) => `${t.speaker === 'ai' ? (req.role === 'agent' ? 'AI agent' : 'Customer (AI)') : req.role === 'agent' ? 'Customer' : 'Agent'}: ${t.text}`)
    .join('\n')
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${facts(req.lead)}\n\nTranscript:\n${transcript || '(no conversation)'}`,
    config: {
      ...BASE_CONFIG,
      systemInstruction: 'You write call-log entries for a call centre. Base them only on the transcript.',
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Two sentences for the call log: what the customer wants and the agreed next step.' },
          outcome: { type: 'string', enum: [...OUTCOMES] },
        },
        required: ['summary', 'outcome'],
      },
    },
  })
  try {
    const parsed = JSON.parse(response.text ?? '') as { summary?: unknown; outcome?: unknown }
    const outcome = OUTCOMES.find((o) => o === parsed.outcome) ?? 'No decision'
    return { status: 200, body: { summary: typeof parsed.summary === 'string' ? parsed.summary : '', outcome } }
  } catch {
    return { status: 200, body: { summary: '', outcome: 'No decision' } }
  }
}

export async function handleAiCall(body: unknown): Promise<AiCallResult> {
  const req = parse(body)
  if (!req) return { status: 400, body: { error: 'Invalid request.' } }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { status: 503, body: { error: 'AI calling isn’t configured: set GEMINI_API_KEY on the server.' } }
  }

  const ai = new GoogleGenAI({ apiKey })
  try {
    return req.action === 'reply' ? await reply(ai, req) : await summary(ai, req)
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) {
        return { status: 429, body: { error: 'The free AI quota is busy right now. Wait a few seconds and try again.' } }
      }
      if (error.status === 401 || error.status === 403 || /api key/i.test(error.message)) {
        return { status: 502, body: { error: 'The server’s Gemini API key was rejected.' } }
      }
      return { status: 502, body: { error: `The AI service returned an error (${error.status}).` } }
    }
    throw error
  }
}

/** Vercel Function entry point (Web-standard Request/Response). */
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const result = await handleAiCall(body)
  return Response.json(result.body, { status: result.status })
}
