import puppeteer from 'puppeteer-core'
import fs from 'fs'
const svg = fs.readFileSync('public/logo.svg', 'utf8')
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true })
const p = await b.newPage()
async function shot(size, pad, name, round) {
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await p.setContent(`<body style="margin:0;background:#0e0e0d;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center"><img src="${dataUrl}" style="height:${size * (1 - 2 * pad)}px"></body>`)
  const buf = await p.screenshot({ type: 'png' })
  fs.writeFileSync(`icons-b64/${name}.b64`, buf.toString('base64'))
}
await shot(192, 0.14, 'icon-192.png')
await shot(512, 0.14, 'icon-512.png')
await shot(512, 0.24, 'icon-512-maskable.png')
await shot(180, 0.14, 'apple-touch-icon.png')
await b.close()
