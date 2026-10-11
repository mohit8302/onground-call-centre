// End-to-end test of real browser calling: three isolated Chrome contexts
// register with the public PeerJS signalling server and call each other.
// Needs internet access (signalling + STUN). Run: npm run build && npm run test:calling

const assert = require('node:assert/strict')
const { startPreview, launch, openApp, sleep, clickText, textOf, run } = require('./helpers.cjs')

const status = (page) => textOf(page, '.call-dock-status').catch(() => '(dock closed)')
const waitStatus = (page, text, timeout = 15000) =>
  page.waitForFunction((t) => document.querySelector('.call-dock-status')?.textContent.includes(t), { timeout }, text)
const lastLogged = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('og-callcentre:v1:calls'))[0])
const inboundAudioBytes = (page) =>
  page.evaluate(async () => {
    let bytes = 0
    for (const pc of window.__pcs) {
      ;(await pc.getStats()).forEach((s) => {
        if (s.type === 'inbound-rtp' && s.kind === 'audio') bytes += s.bytesReceived
      })
    }
    return bytes
  })

async function openPhone(page) {
  await page.click('.phone-chip')
  await page.waitForFunction(() => /^onground-/.test(document.querySelector('.peer-id')?.textContent ?? ''), {
    timeout: 20000,
  })
  return textOf(page, '.peer-id')
}

async function dial(page, peerId) {
  await page.$eval('#peer-input', (e) => (e.value = ''))
  await page.type('#peer-input', peerId)
  await page.click('.dial-form button[type=submit]')
}

;(async () => {
  const server = await startPreview()
  const browser = await launch()
  const errors = []
  const ids = {}
  let A, B, C

  const failed = await run('Browser calling (PeerJS / WebRTC)', [
    ['three agents register with the signalling server', async () => {
      ;[A, B, C] = await Promise.all(['A', 'B', 'C'].map((n) => openApp(browser, server.url, n, errors)))
      ids.A = await openPhone(A)
      ids.B = await openPhone(B)
      ids.C = await openPhone(C)
      assert.equal(await status(A), 'Ready')
    }],
    ['calling an unknown ID shows a clear error', async () => {
      await dial(A, 'onground-nobody-here')
      await A.waitForSelector('.call-error', { timeout: 15000 })
      assert.match(await textOf(A, '.call-error span'), /not online/)
      await A.click('.call-error .icon-btn')
      assert.equal(await status(A), 'Ready')
    }],
    ['"Place call" on a lead opens the dialer tagged with that lead', async () => {
      await A.click('.call-dock-head .icon-btn')
      await clickText(A, '.nav-sub-item', 'Calls to make')
      await A.waitForSelector('.lead-row-body')
      await clickText(A, '.lead-row-body button', 'Place call')
      assert.match(await textOf(A, '.call-target'), /Mukunda R\./)
    }],
    ['outgoing call rings on the other side, accept connects both', async () => {
      await dial(A, ids.B)
      await waitStatus(B, 'Incoming')
      assert.equal(await status(A), 'Calling…')
      await clickText(B, '.call-dock button', 'Accept')
      await Promise.all([A.waitForSelector('.call-timer', { timeout: 20000 }), B.waitForSelector('.call-timer', { timeout: 20000 })])
    }],
    ['timer counts real seconds and audio bytes flow both ways', async () => {
      await sleep(3200)
      assert.ok((await textOf(A, '.call-timer')) >= '00:03', 'A timer should be at least 00:03')
      assert.match(await textOf(A, '.phone-chip'), /00:0\d/)
      assert.ok((await inboundAudioBytes(A)) > 0, 'A should receive audio')
      assert.ok((await inboundAudioBytes(B)) > 0, 'B should receive audio')
    }],
    ['mute disables the local mic track', async () => {
      await clickText(A, '.call-dock button', 'Mute')
      assert.match(await textOf(A, '.call-live .muted'), /you are muted/)
      const enabled = await A.evaluate(() => window.__pcs.flatMap((pc) => pc.getSenders()).filter((s) => s.track?.readyState === 'live').map((s) => s.track.enabled))
      assert.ok(enabled.length > 0 && enabled.every((e) => e === false))
      await clickText(A, '.call-dock button', 'Unmute')
    }],
    ['a third caller gets "busy" while the line is in use', async () => {
      await dial(C, ids.B)
      await waitStatus(C, 'Ready', 10000)
      assert.match(await textOf(C, '.call-error span'), /another call/)
      assert.equal((await lastLogged(B)).outcome, 'Busy on another call')
      assert.ok(await A.$('.call-timer'), 'A-B call should continue')
    }],
    ['hang up ends the call on both sides and asks for an outcome', async () => {
      await clickText(A, '.call-dock button', 'Hang up')
      await A.waitForSelector('.wrap-title', { timeout: 5000 })
      await B.waitForSelector('.wrap-title', { timeout: 10000 })
      const liveTracks = await A.evaluate(() =>
        window.__pcs.flatMap((pc) => pc.getSenders()).filter((s) => s.track?.readyState === 'live').length,
      )
      assert.equal(liveTracks, 0, 'microphone tracks should be stopped')
    }],
    ['the outcome is logged to Recent against the lead with the real duration', async () => {
      await clickText(A, '.call-dock .chip', 'Quote sent')
      const rec = await lastLogged(A)
      assert.equal(rec.name, 'Mukunda R.')
      assert.equal(rec.leadId, 'lead-mukunda')
      assert.equal(rec.direction, 'outgoing')
      assert.equal(rec.outcome, 'Quote sent')
      assert.equal(rec.source, 'live')
      assert.ok(rec.durationSec >= 3, `duration ${rec.durationSec}s`)
      await clickText(B, '.call-dock button', 'Skip')
      assert.equal((await lastLogged(B)).direction, 'incoming')
    }],
    ['rejecting tells the caller immediately', async () => {
      await dial(A, ids.B)
      await waitStatus(B, 'Incoming')
      await clickText(B, '.call-dock button', 'Reject')
      await waitStatus(A, 'Ready', 5000)
      assert.match(await textOf(A, '.call-error span'), /declined/)
      assert.equal((await lastLogged(B)).direction, 'missed')
    }],
    ['cancelling before answer stops the ringing on the other side', async () => {
      await A.click('.call-error .icon-btn')
      await dial(A, ids.B)
      await waitStatus(B, 'Incoming')
      await clickText(A, '.call-dock button', 'Cancel')
      await waitStatus(B, 'Ready', 5000)
      assert.equal((await lastLogged(B)).outcome, 'Caller hung up')
    }],
    ['the missed call appears in Incoming with a prefilled call back', async () => {
      await B.click('.call-dock-head .icon-btn')
      await clickText(B, '.nav-sub-item', 'Incoming')
      await B.waitForSelector('.missed-row')
      await B.evaluate((id) => {
        const row = [...document.querySelectorAll('.missed-row')].find((r) => r.textContent.includes(id))
        row.querySelector('.btn-green').click()
      }, ids.A)
      assert.equal(await B.$eval('#peer-input', (e) => e.value), ids.A)
    }],
    ['closing a tab mid-call ends the call for the other person', async () => {
      await dial(A, ids.C)
      await waitStatus(C, 'Incoming')
      await clickText(C, '.call-dock button', 'Accept')
      await A.waitForSelector('.call-timer', { timeout: 20000 })
      await C.close()
      await A.waitForSelector('.wrap-title', { timeout: 10000 })
    }],
  ])

  if (errors.length) console.log('\nBrowser console errors:\n  ' + errors.join('\n  '))
  await browser.close()
  await server.close()
  process.exit(failed ? 1 : 0)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
