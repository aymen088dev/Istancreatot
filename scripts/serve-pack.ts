/**
 * Tiny static downloader for the built pack.
 *
 * There is no web app any more — this only exists so the workspace preview
 * serves the generated `.mcaddon` for download. No dependencies, no build step.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'

const ROOT = 'dist-pack'
const port = Number(process.env.PORT ?? 5173)

function list(): { name: string; size: string }[] {
  if (!existsSync(ROOT)) return []
  return readdirSync(ROOT)
    .filter((name) => name.endsWith('.mcaddon') || name.endsWith('.mcpack'))
    .map((name) => ({
      name,
      size: `${(readFileSync(`${ROOT}/${name}`).length / 1048576).toFixed(2)} Mo`,
    }))
}

const page = (items: { name: string; size: string }[]) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>REMNANT — pack genere</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    background:#0b0d0b; color:#e7e5e4;
    font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace }
  main { width:min(680px,92vw); padding:40px 0 }
  h1 { font-size:20px; letter-spacing:.28em; text-transform:uppercase; color:#a3e635; margin:0 0 6px }
  p  { color:#8a8f88; margin:0 0 28px }
  a  { display:flex; justify-content:space-between; gap:16px; padding:16px 20px; margin-bottom:10px;
    border:1px solid #2a2f27; border-radius:10px; background:#141813;
    color:#e7e5e4; text-decoration:none }
  a:hover { border-color:#a3e63566; background:#1a2018 }
  span { color:#8a8f88 }
  em { color:#ea580c; font-style:normal }
</style></head><body><main>
<h1>Remnant</h1>
<p>Le site a ete supprime. Le pack genere est ici.</p>
${
  items.length === 0
    ? '<p><em>Aucun pack dans dist-pack/.</em> Lance <code>bun run pack:build</code>.</p>'
    : items
        .map(
          (item) =>
            `<a href="/pack/${encodeURIComponent(item.name)}"><strong>${item.name}</strong><span>${item.size}</span></a>`,
        )
        .join('\n')
}
</main></body></html>`

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

  if (pathname.startsWith('/pack/')) {
    const name = decodeURIComponent(pathname.slice('/pack/'.length))
    // Reject anything that tries to escape dist-pack/.
    if (name.includes('/') || name.includes('..') || !existsSync(`${ROOT}/${name}`)) {
      response.writeHead(404).end('Not found')
      return
    }
    const body = readFileSync(`${ROOT}/${name}`)
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': body.length,
      'content-disposition': `attachment; filename="${name}"`,
    })
    response.end(body)
    return
  }

  const body = Buffer.from(page(list()), 'utf8')
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': body.length })
  response.end(body)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`REMNANT pack server -> http://0.0.0.0:${port}`)
})
