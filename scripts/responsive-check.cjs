// Visual QA with isolated network fixtures; never writes production data.
const { chromium } = require('playwright')
const fs = require('node:fs')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  fs.mkdirSync('docs/screenshots/responsive', { recursive: true })
  const failures = []
  for (const width of [320, 390, 768, 1440]) {
    for (const name of ['login', 'brand', 'chat', 'calendar', 'finance']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      await page.route('**/api/**', (route) => {
        const auth = route.request().url().includes('/auth/')
        return route.fulfill({
          status: auth && name === 'login' ? 401 : auth ? 200 : 503,
          contentType: 'application/json',
          body: JSON.stringify(
            auth
              ? {
                  data: {
                    user: {
                      id: 'qa',
                      displayName: 'Demonstração',
                      email: 'qa@example.com',
                      role: 'member',
                    },
                  },
                }
              : { error: 'Ambiente de validação visual' },
          ),
        })
      })
      await page.route('**/*.supabase.co/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        }),
      )
      await page.goto(`http://127.0.0.1:5173/${name}`)
      await page.locator(name === 'login' ? 'h2' : 'h1').waitFor()
      await page.waitForTimeout(700)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
      if (overflow) failures.push(`${name}: ${width}px`)
      await page.screenshot({
        path: `docs/screenshots/responsive/${name}-${width}.png`,
        fullPage: true,
      })
      await page.close()
    }
  }
  await browser.close()
  console.log(JSON.stringify({ overflowFailures: failures }))
  if (failures.length) process.exitCode = 1
})()
