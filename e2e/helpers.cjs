// Shared helpers for the browser end-to-end scripts.
// They drive a locally installed Chrome (puppeteer-core does not download one)
// with fake microphone devices, against `vite preview` of the built app.

const fs = require('node:fs')
const puppeteer = require('puppeteer-core')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

function findChrome() {
  const path = CHROME_CANDIDATES.find((p) => fs.existsSync(p))
  if (!path) throw new Error('No Chrome found. Set CHROME_PATH to a Chrome/Chromium/Edge executable.')
  return path
}

/** Serves dist/ with `vite preview` on a free port. Run `npm run build` first. */
async function startPreview() {
  if (!fs.existsSync('dist/index.html')) throw new Error('dist/ missing. Run `npm run build` first.')
  const { preview } = await import('vite')
  const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
  const url = server.resolvedUrls.local[0]
  return { url, close: () => server.close() }
}

function launch() {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream', // auto-accept the mic permission prompt
      '--use-fake-device-for-media-stream', // synthetic microphone input
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
}

/** Opens the app in an isolated browser context (own localStorage, own PeerJS ID). */
async function openApp(browser, url, name, errors) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name}: ${m.text()}`)
  })
  // Record RTCPeerConnections so tests can read real WebRTC stats.
  await page.evaluateOnNewDocument(() => {
    const Original = window.RTCPeerConnection
    window.__pcs = []
    window.RTCPeerConnection = function (...args) {
      const pc = new Original(...args)
      window.__pcs.push(pc)
      return pc
    }
    window.RTCPeerConnection.prototype = Original.prototype
  })
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(url, { waitUntil: 'networkidle0' })
  return page
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Clicks the first element matching `selector` whose text contains `text`. */
function clickText(page, selector, text) {
  return page.evaluate(
    (selector, text) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.textContent.includes(text))
      if (!el) throw new Error(`No ${selector} containing "${text}"`)
      el.click()
    },
    selector,
    text,
  )
}

const textOf = (page, selector) => page.$eval(selector, (e) => e.textContent.trim())

/** Tiny test runner: runs named steps in order, prints PASS/FAIL, exits non-zero on failure. */
async function run(title, steps) {
  console.log(`\n${title}`)
  let failed = 0
  for (const [name, fn] of steps) {
    const start = Date.now()
    try {
      await fn()
      console.log(`  PASS  ${name} (${Date.now() - start} ms)`)
    } catch (err) {
      failed++
      console.log(`  FAIL  ${name}\n        ${err.message.replace(/\s+/g, ' ').slice(0, 300)}`)
      break // later steps depend on earlier ones
    }
  }
  return failed
}

module.exports = { startPreview, launch, openApp, sleep, clickText, textOf, run }
