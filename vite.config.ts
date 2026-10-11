import react from '@vitejs/plugin-react'
import type { Connect, Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import { handleAiCall } from './api/ai-call.ts'

/**
 * Serves POST /api/ai-call from `npm run dev` and `npm run preview`, using the
 * same handler Vercel deploys from api/ai-call.ts.
 */
function aiCallApi(): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    let raw = ''
    for await (const chunk of req) raw += chunk
    let result
    try {
      result = await handleAiCall(JSON.parse(raw))
    } catch (error) {
      console.error('[ai-call]', error)
      result = { status: 500, body: { error: 'AI call failed on the server.' } }
    }
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result.body))
  }
  return {
    name: 'ai-call-api',
    configureServer: (server) => void server.middlewares.use('/api/ai-call', middleware),
    configurePreviewServer: (server) => void server.middlewares.use('/api/ai-call', middleware),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only settings from .env.local (git-ignored). They never reach the browser
  // bundle: only VITE_-prefixed variables do.
  const env = loadEnv(mode, process.cwd(), '')
  for (const name of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (env[name] && !process.env[name]) process.env[name] = env[name]
  }

  return { plugins: [react(), aiCallApi()] }
})
