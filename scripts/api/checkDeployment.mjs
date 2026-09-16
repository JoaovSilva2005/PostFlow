// Read-only verification; never prints keys or tokens from deployed assets.
import { loadEnvFile } from 'node:process'
loadEnvFile('.env')
const origin = 'https://post-flow-ochre.vercel.app'
const html = await (await fetch(origin)).text()
const asset = html.match(/src="([^"]+\.js)"/)?.[1]
if (!asset) throw new Error('JavaScript asset not found')
const js = await (await fetch(new URL(asset, origin))).text()
console.log(
  JSON.stringify({
    asset,
    localDatabase: process.env.VITE_SUPABASE_URL,
    productionDatabases: [
      ...new Set(js.match(/https:\/\/[a-z0-9]+\.supabase\.co/g) || []),
    ],
    fiscalWithoutSession: (
      await fetch(`${origin}/api/fiscal/report?period=2026-09`)
    ).status,
  }),
)
