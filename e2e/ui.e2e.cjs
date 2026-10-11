// End-to-end checks for the screens and their interactions (no network needed
// beyond loading the app). Run: npm run build && npm run test:ui

const assert = require('node:assert/strict')
const { startPreview, launch, openApp, sleep, clickText, textOf, run } = require('./helpers.cjs')

// Nav label -> an element that only that screen renders. Screens are lazy
// chunks, so we wait for the marker rather than for any '.page'.
const SCREENS = {
  Dashboard: '.hero',
  'Calls to make': '.lead-row',
  Incoming: '.summary-strip',
  Recent: '.recent-row',
  'Practise a call': '.customer-line',
  Calendar: '.cal-grid',
  Pulse: '.avani-hero',
}
const SUB_ITEMS = ['Calls to make', 'Incoming', 'Recent', 'Practise a call']

async function go(page, label) {
  await clickText(page, SUB_ITEMS.includes(label) ? '.nav-sub-item' : '.nav-item', label)
  await page.waitForSelector(SCREENS[label], { timeout: 10000 })
}

;(async () => {
  const server = await startPreview()
  const browser = await launch()
  const errors = []
  let page

  const failed = await run('Screens and interactions', [
    ['every screen renders without overflow at desktop and phone width', async () => {
      page = await openApp(browser, server.url, 'ui', errors)
      for (const width of [1280, 390, 360]) {
        await page.setViewport({ width, height: 860 })
        for (const label of Object.keys(SCREENS)) {
          if (width < 860) {
            await page.click('.topbar-menu')
            await sleep(250)
          }
          await go(page, label)
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          assert.ok(overflow <= 0, `${label} @${width}px overflows by ${overflow}px`)
        }
      }
      await page.setViewport({ width: 1280, height: 900 })
    }],
    ['dashboard shows KPIs, both charts and the queue', async () => {
      await go(page, 'Dashboard')
      assert.equal((await page.$$('.kpi')).length, 4)
      assert.equal((await page.$$('.recharts-surface')).length >= 2, true)
      assert.equal((await page.$$('.queue-row')).length, 2)
    }],
    ['completing a task persists across reload', async () => {
      await page.click('.task .task-check')
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('.task')
      assert.ok(await page.$('.task.done'))
      await page.click('.task.done .task-check') // undo for later runs
    }],
    ['dashboard task opens the leads modal; paging and collapsibles work', async () => {
      await clickText(page, '.task-body', 'Ritu S.')
      await page.waitForSelector('.modal')
      assert.equal(await textOf(page, '.lead-card-name'), 'Ritu S.')
      assert.match(await textOf(page, '.leads-foot'), /Cumulative missed: \d+/)
      await page.click('[aria-label="Next lead"]')
      assert.equal(await textOf(page, '.lead-card-name'), 'Faizan A.')
      await clickText(page, '.collapsible-head', 'Customer journey')
      assert.ok(await page.$('.journey li'))
      await page.keyboard.press('Escape')
      assert.equal(await page.$('.modal'), null)
    }],
    ['calls to make: ranked, expandable, paginated two per page', async () => {
      await go(page, 'Calls to make')
      const ranks = await page.$$eval('.lead-row .pill', (els) => els.map((e) => Number(e.textContent)))
      assert.equal(ranks.length, 2)
      assert.ok(ranks[0] >= ranks[1])
      await page.click('.lead-row:nth-child(2) .lead-row-head')
      assert.ok(await page.$('.lead-row:nth-child(2) .lead-row-body'))
      await page.click('[aria-label="Next page"]')
      assert.match(await textOf(page, '.pager span'), /Page 2 of 3/)
    }],
    ['incoming is sorted by expected value', async () => {
      await go(page, 'Incoming')
      const values = await page.$$eval('.missed-value .value', (els) => els.map((e) => Number(e.textContent.replace(/[^\d]/g, ''))))
      assert.deepEqual(values, [...values].sort((a, b) => b - a))
    }],
    ['recent: filter chips and the SOP review modal', async () => {
      await go(page, 'Recent')
      await clickText(page, '.chip', 'Missed')
      const dirs = await page.$$eval('.recent-row .muted', (els) => els.map((e) => e.textContent))
      assert.ok(dirs.every((d) => d.startsWith('Missed')))
      await clickText(page, '.chip', 'All')
      await clickText(page, '.recent-row', 'Kavitha R.')
      await page.waitForSelector('.sop-list')
      assert.equal((await page.$$('.sop-list li')).length, 6)
      await page.keyboard.press('Escape')
    }],
    ['calendar: month navigation, Today button, day selection', async () => {
      await go(page, 'Calendar')
      const month = await textOf(page, '.cal-month')
      await page.click('[aria-label="Next month"]')
      assert.notEqual(await textOf(page, '.cal-month'), month)
      await clickText(page, '.btn', 'Today')
      assert.equal(await textOf(page, '.cal-month'), month)
      assert.ok(await page.$('.cal-day.today.selected'))
      assert.ok((await page.$$('.cal-dot')).length > 0)
    }],
    ['pulse: daily brief, then open a channel', async () => {
      await go(page, 'Pulse')
      await clickText(page, '.btn', 'Daily brief')
      assert.ok(await page.$('.brief li'))
      await clickText(page, '.channel-row', 'callcentre-team')
      await page.waitForSelector('.needs-input')
    }],
    ['channel: answer the needs-input card and send a message (persisted)', async () => {
      await clickText(page, '.needs-input .chip', 'Only 3–4 pm')
      assert.match(await textOf(page, '.needs-input-done'), /Only 3–4 pm/)
      await page.type('.composer input', 'Hello from the E2E test')
      await page.click('.composer button')
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('.bubble-row.mine')
      const mine = await page.$$eval('.bubble-row.mine .bubble', (els) => els.map((e) => e.textContent))
      assert.ok(mine.some((t) => t.includes('Hello from the E2E test')))
      await page.click('[aria-label="Back to Pulse"]')
      await page.waitForSelector('.avani-hero')
    }],
    ['practise: mic check reads a real input level', async () => {
      await go(page, 'Practise a call')
      await clickText(page, '.btn', 'Start mic check')
      // Chrome's fake microphone beeps periodically, so sample for a while.
      let peak = 0
      for (let i = 0; i < 30 && peak === 0; i++) {
        await sleep(100)
        peak = Math.max(peak, await page.$eval('.mic-meter-fill', (e) => parseFloat(e.style.width)))
      }
      assert.ok(peak > 0, 'fake microphone should produce a level')
      await clickText(page, '.btn', 'Stop mic check')
    }],
    ['reset demo data restores the defaults', async () => {
      await page.click('[aria-label="Profile menu"]')
      await clickText(page, '.dropdown-item', 'Reset demo data')
      await page.waitForSelector('.hero')
      const stored = await page.evaluate(() => localStorage.getItem('og-callcentre:v1:messages'))
      assert.equal(stored, '{}')
    }],
  ])

  if (errors.length) {
    console.log('\nBrowser console errors:\n  ' + errors.join('\n  '))
  }
  await browser.close()
  await server.close()
  process.exit(failed || errors.length ? 1 : 0)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
