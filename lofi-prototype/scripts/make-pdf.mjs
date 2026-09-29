// Renders book.html in headless Edge/Chrome and prints it to a PDF.
// Usage: node scripts/make-pdf.mjs [--device mobile] [--out file.pdf] [--shots dir] [--pages 3,10] [--no-pdf]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const mobile = arg('--device') === 'mobile'
const out = path.resolve(arg('--out') || path.join(root, '..', 'docs', 'design', 'lofi', mobile ? 'Pawfolio_LoFi_UI_Designs_Mobile.pdf' : 'Pawfolio_LoFi_UI_Designs.pdf'))
const shots = arg('--shots') && path.resolve(arg('--shots'))
const detail = (arg('--pages') || '').split(',').filter(Boolean).map(Number)
const browserPath = process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const server = await createServer({ root, logLevel: 'error', server: { port: 5199 } })
await server.listen()
const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const problems = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') problems.push(m.text()) })
  page.on('pageerror', (e) => problems.push(String(e)))
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto(`${server.resolvedUrls.local[0]}book.html${mobile ? '?device=mobile' : ''}`, { waitUntil: 'load', timeout: 300000 })
  await page.waitForFunction('window.__ready === true', { timeout: 300000 })
  const info = await page.evaluate(() => window.__bookInfo)
  console.log(`Book ready: ${info.pages} pages from ${info.screens} screen specs`)

  if (shots) {
    fs.mkdirSync(shots, { recursive: true })
    const tops = await page.evaluate(() => [...document.querySelectorAll('.bk-sheet')].map((el) => el.getBoundingClientRect().top + window.scrollY))
    const thumbs = []
    for (let i = 0; i < tops.length; i++) {
      const clip = { x: 0, y: tops[i], width: 1920, height: 1200 }
      thumbs.push((await page.screenshot({ clip: { ...clip, scale: 1 / 3 }, encoding: 'base64' })))
      if (detail.includes(i + 1)) await page.screenshot({ clip: { ...clip, scale: 0.75 }, path: path.join(shots, `page-${String(i + 1).padStart(3, '0')}.png`) })
    }
    const grid = await browser.newPage()
    await grid.setViewport({ width: 1920, height: 1200 })
    for (let i = 0; i < thumbs.length; i += 9) {
      const cells = thumbs.slice(i, i + 9).map((t, j) => `<figure><img src="data:image/png;base64,${t}"><figcaption>${i + j + 1}</figcaption></figure>`).join('')
      await grid.setContent(`<style>body{margin:0;display:grid;grid-template-columns:repeat(3,640px);grid-auto-rows:400px;background:#777}figure{margin:0;position:relative;outline:1px solid #333}img{width:640px;height:400px;display:block}figcaption{position:absolute;top:4px;right:6px;background:#c00;color:#fff;font:bold 16px sans-serif;padding:1px 7px}</style>${cells}`)
      await grid.screenshot({ path: path.join(shots, `contact-${String(i / 9 + 1).padStart(2, '0')}.png`) })
    }
    console.log(`Contact sheets written to ${shots}`)
  }

  if (!args.includes('--no-pdf')) {
    await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true, timeout: 0 })
    console.log(`PDF written: ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`)
  }
  const unique = [...new Set(problems)]
  if (unique.length) console.log(`Console problems (${unique.length}):\n${unique.slice(0, 25).join('\n')}`)
} finally {
  await browser.close()
  await server.close()
}
