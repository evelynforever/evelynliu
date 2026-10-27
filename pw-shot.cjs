const { chromium } = require('playwright')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:5173/world-test.html', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const svgCount = await page.evaluate(() => document.querySelectorAll('svg').length)
  console.log('svg count:', svgCount)
  await page.screenshot({ path: '/private/tmp/world-branch-pw.png', fullPage: false })
  console.log('screenshot ok, size=', fs.statSync('/private/tmp/world-branch-pw.png').size)
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
