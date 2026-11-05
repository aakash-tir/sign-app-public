// In-browser classifier latency bench (issue #64).
//
// Serves ml/experiments/bench/index.html + onnxruntime-web (from frontend/node_modules)
// + the experiment's model files on localhost, drives headless Chromium with the
// frontend's Playwright, and times batch-1 inference on single-threaded WASM —
// the same runtime settings the app uses. Classifier time only (MediaPipe excluded).
//
//   cd frontend && node ../ml/experiments/bench/bench.mjs ../ml/experiments/runs/bench/manifest.json
//
// manifest.json: { onnx: [{name,file,feat,handshape?}], mlp: [{name,file}],
//                  windows: number[][] (flattened 30x161), parity?: {raw, expected} }
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..', '..')
// Resolve Playwright from frontend/ (ml/experiments/ has no node_modules).
const { chromium } = createRequire(path.join(repo, 'frontend', 'package.json'))('@playwright/test')
const ortDist = path.join(repo, 'frontend', 'node_modules', 'onnxruntime-web', 'dist')
const manifestPath = path.resolve(process.argv[2])
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const outDir = path.dirname(manifestPath)

// Bundle the app's real MLP forward pass (src/recognition/mlpClassifier.ts).
const mlpBundle = path.join(outDir, 'mlp.mjs')
execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['rolldown', path.join(repo, 'frontend', 'src', 'recognition', 'mlpClassifier.ts'),
    '--format', 'esm', '--file', mlpBundle],
  { cwd: path.join(repo, 'frontend'), stdio: 'inherit', shell: process.platform === 'win32' },
)

const files = new Map() // url path -> absolute file
for (const m of [...manifest.onnx, ...manifest.mlp]) {
  m.url = `/m/${m.name}`
  files.set(m.url, path.resolve(outDir, m.file))
}
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' }

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file
  if (url === '/') file = path.join(here, 'index.html')
  else if (url === '/mlp.mjs') file = mlpBundle
  else if (url.startsWith('/ort/')) file = path.join(ortDist, path.basename(url))
  else file = files.get(url)
  if (!file) { res.writeHead(404).end(); return }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404).end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()) })
await page.goto(`http://127.0.0.1:${port}/`)
await page.waitForFunction(() => typeof window.bench === 'function')
const result = await page.evaluate((args) => window.bench(args), {
  onnx: manifest.onnx.map(({ name, url, feat, handshape }) => ({ name, url, feat, handshape })),
  mlp: manifest.mlp.map(({ name, url }) => ({ name, url })),
  windows: manifest.windows,
  parity: manifest.parity,
  warmup: 50,
  iters: 500,
})
result._env = { chromium: browser.version(), ort: '1.26.0', numThreads: 1, ep: 'wasm', batch: 1 }
await browser.close()
server.close()
await writeFile(path.join(outDir, 'latency.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
