// 카카오톡 링크 미리보기용 배너(1200x630) 생성: node scripts/make-og.mjs → public/og.png, assets-b64/og.png.b64
import puppeteer from 'puppeteer-core'
import fs from 'fs'
const logo = fs.readFileSync('public/logo.svg').toString('base64')
const font = fs.readFileSync('node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2').toString('base64')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:P;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:45 920}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:radial-gradient(ellipse at 50% 45%,#1b1a17 0%,#0e0e0d 62%,#080807 100%);font-family:P;color:#fff;position:relative;overflow:hidden}
.frame{position:absolute;inset:26px;border:1.5px solid rgba(201,162,39,.75)}
.frame::after{content:'';position:absolute;inset:8px;border:1px solid rgba(201,162,39,.28)}
.wrap{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:34px}
.logo{height:330px}
.txt{width:318px}
.t{font-size:68px;font-weight:800;line-height:1.16;letter-spacing:-.02em}
.bar{width:84px;height:4px;background:#c9a227;margin:26px 0 22px}
.d{font-size:27px;font-weight:500;color:#cfcbc2;line-height:1.45;letter-spacing:-.01em}
.s{position:absolute;bottom:50px;left:0;right:0;text-align:center;font-size:17px;letter-spacing:.42em;color:#c9a227;font-weight:600}
</style></head><body><div class="frame"></div>
<div class="wrap"><img class="logo" src="data:image/svg+xml;base64,${logo}"><div class="txt"><div class="t">허니미디어<br>전자계약서</div><div class="bar"></div><div class="d">계약서를 확인하고<br>서명해 주세요.</div></div></div>
<div class="s">HONEY MEDIA</div></body></html>`
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true })
const p = await b.newPage()
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await p.setContent(html)
await p.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 400))
const buf = await p.screenshot({ type: 'png' })
fs.writeFileSync('public/og.png', buf)
fs.mkdirSync('assets-b64', { recursive: true })
fs.writeFileSync('assets-b64/og.png.b64', buf.toString('base64'))
await b.close()
console.log('og.png', buf.length)
