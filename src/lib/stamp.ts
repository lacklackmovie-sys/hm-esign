import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { Field } from './types'
import { fmtDateKo, fmtKSTFull, sha256Hex } from './util'

export interface TextImage { png: Uint8Array; wPt: number; hPt: number }
/** 한글 글자는 PDF 글꼴 대신 이미지로 그린다(브라우저 글꼴로 렌더). 테스트에서는 가짜로 바꿔 끼운다. */
export type TextRenderer = (text: string, opt: { sizePt: number; color?: string; maxWidthPt?: number; bold?: boolean }) => Promise<TextImage>

export interface StampInput {
  original: Uint8Array
  fields: Field[]
  signaturePng: Uint8Array
  signerName: string
  signedAt: Date
  contractId: string
  title: string
  recipientName: string
  ip: string | null
  userAgent: string
  /** 다중 모드: 제출 번호와 입력한 연락처 */
  signingId?: string
  signerPhone?: string
  renderText: TextRenderer
}

export interface StampResult { pdf: Uint8Array; originalSha256: string; signatureSha256: string; pageCount: number }

/** 화면에서 본 페이지 기준의 좌표(왼쪽 위, pt)를 PDF 원본 좌표로 바꾼다. 페이지 회전(/Rotate)도 처리한다. */
export function toPdfBox(page: PDFPage, f: { x: number; y: number; w: number; h: number }) {
  const { width: W, height: H } = page.getSize()
  const angle = ((page.getRotation().angle % 360) + 360) % 360
  const dw = angle === 90 || angle === 270 ? H : W
  const dh = angle === 90 || angle === 270 ? W : H
  const px = f.x * dw
  const py = f.y * dh
  const bw = f.w * dw
  const bh = f.h * dh
  // 보이는 상자의 왼쪽 아래 모서리(px, py+bh)를 원본 좌표로
  const bx = px
  const by = py + bh
  let x: number, y: number
  switch (angle) {
    case 90: x = by; y = bx; break
    case 180: x = W - bx; y = H - by; break
    case 270: x = W - by; y = H - bx; break
    default: x = bx; y = H - by
  }
  return { x, y, width: bw, height: bh, angle }
}

const ASCII = /^[\x20-\x7e]*$/

export async function stampSignedPdf(input: StampInput): Promise<StampResult> {
  const originalSha256 = await sha256Hex(input.original)
  const signatureSha256 = await sha256Hex(input.signaturePng)
  const doc = await PDFDocument.load(input.original)
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const sig = await doc.embedPng(input.signaturePng)
  const pages = doc.getPages()
  const dateKo = fmtDateKo(input.signedAt)

  const imgCache = new Map<string, { img: PDFImage; wPt: number; hPt: number }>()
  const textImg = async (text: string, sizePt: number, extra: { color?: string; maxWidthPt?: number; bold?: boolean } = {}) => {
    const key = `${text}|${sizePt}|${extra.color ?? ''}|${extra.maxWidthPt ?? ''}|${extra.bold ?? ''}`
    let c = imgCache.get(key)
    if (!c) {
      const t = await input.renderText(text, { sizePt, ...extra })
      c = { img: await doc.embedPng(t.png), wPt: t.wPt, hPt: t.hPt }
      imgCache.set(key, c)
    }
    return c
  }

  // 1) 원본 페이지의 서명 칸에 찍기
  for (const f of input.fields) {
    const page = pages[f.page]
    if (!page) continue
    const b = toPdfBox(page, f)
    const rot = b.angle ? degrees(b.angle) : undefined
    // 칸 안에서 가운데 정렬로 contain. 회전 페이지에서는 칸의 왼쪽 아래 모서리를 기준으로 회전시킨다.
    const place = (w: number, h: number) => {
      const ox = (b.width - w) / 2
      const oy = (b.height - h) / 2
      const rad = (b.angle * Math.PI) / 180
      const cos = Math.cos(rad), sin = Math.sin(rad)
      return { x: b.x + ox * cos - oy * sin, y: b.y + ox * sin + oy * cos }
    }
    if (f.type === 'signature') {
      const s = Math.min(b.width / sig.width, b.height / sig.height)
      const w = sig.width * s, h = sig.height * s
      const p = place(w, h)
      page.drawImage(sig, { x: p.x, y: p.y, width: w, height: h, rotate: rot })
    } else {
      const text = f.type === 'name' ? input.signerName : dateKo
      const size = Math.max(6, Math.min(16, b.height * 0.62))
      const t = await textImg(text, size, { color: '#111111', maxWidthPt: b.width })
      const s = Math.min(1, b.width / t.wPt, b.height / t.hPt)
      const w = t.wPt * s, h = t.hPt * s
      const p = place(w, h)
      page.drawImage(t.img, { x: p.x, y: p.y, width: w, height: h, rotate: rot })
    }
  }

  // 2) 마지막 확인서 페이지
  const A4: [number, number] = [595.28, 841.89]
  const ap = doc.addPage(A4)
  const M = 48
  const gold = rgb(0.788, 0.635, 0.153)
  const ink = rgb(0.07, 0.07, 0.06)
  const grey = rgb(0.42, 0.41, 0.39)
  ap.drawRectangle({ x: 0, y: A4[1] - 92, width: A4[0], height: 92, color: rgb(0.055, 0.055, 0.05) })
  ap.drawRectangle({ x: 0, y: A4[1] - 96, width: A4[0], height: 4, color: gold })
  const ttl = await textImg('전자서명 확인서', 22, { color: '#ffffff', bold: true })
  ap.drawImage(ttl.img, { x: M, y: A4[1] - 52 - ttl.hPt / 2 + 6, width: ttl.wPt, height: ttl.hPt })
  ap.drawText('HONEY MEDIA  /  E-SIGNATURE CERTIFICATE', { x: M, y: A4[1] - 78, size: 8.5, font: helv, color: gold })

  let y = A4[1] - 96 - 40
  const label = async (text: string, yy: number) => {
    const t = await textImg(text, 9.5, { color: '#6b6963' })
    ap.drawImage(t.img, { x: M, y: yy - 2, width: t.wPt, height: t.hPt })
  }
  const value = async (text: string, yy: number, size = 11, mono = false): Promise<number> => {
    const maxW = A4[0] - M * 2 - 120
    const x = M + 120
    if (ASCII.test(text)) {
      const lines = wrapAscii(text, helv, size, maxW)
      lines.forEach((ln, i) => ap.drawText(ln, { x, y: yy - i * (size + 3), size, font: helv, color: ink }))
      void mono
      return lines.length * (size + 3)
    }
    const t = await textImg(text, size, { color: '#111111', maxWidthPt: maxW })
    ap.drawImage(t.img, { x, y: yy - t.hPt + size + 1, width: t.wPt, height: t.hPt })
    return t.hPt
  }
  const rows: [string, string][] = [
    ['계약서 ID', input.contractId],
    ['계약명', input.title],
    ...(input.signingId ? ([['제출 ID', input.signingId]] as [string, string][]) : []),
    ['서명 요청 대상', input.recipientName],
    ['서명자(입력한 이름)', input.signerName],
    ...(input.signerPhone ? ([['연락처(입력)', input.signerPhone]] as [string, string][]) : []),
    ['서명 일시', fmtKSTFull(input.signedAt)],
    ['접속 IP', input.ip ?? '확인되지 않음'],
    ['접속 환경(UA)', input.userAgent || '확인되지 않음'],
    ['원본 문서 SHA-256', originalSha256],
    ['서명 이미지 SHA-256', signatureSha256],
  ]
  for (const [k, v] of rows) {
    await label(k, y)
    const h = await value(v, y, k.includes('SHA') ? 9 : 11)
    ap.drawLine({ start: { x: M, y: y - Math.max(12, h - 2) }, end: { x: A4[0] - M, y: y - Math.max(12, h - 2) }, thickness: 0.5, color: rgb(0.85, 0.83, 0.78) })
    y -= Math.max(32, h + 20)
  }

  y -= 14
  await label('서명', y)
  const boxW = 240, boxH = 100
  ap.drawRectangle({ x: M + 120, y: y - boxH + 14, width: boxW, height: boxH, borderColor: rgb(0.78, 0.76, 0.7), borderWidth: 0.8 })
  const s = Math.min((boxW - 16) / sig.width, (boxH - 16) / sig.height)
  ap.drawImage(sig, { x: M + 120 + (boxW - sig.width * s) / 2, y: y - boxH + 14 + (boxH - sig.height * s) / 2, width: sig.width * s, height: sig.height * s })
  y -= boxH + 26

  const note = [
    '이 문서는 서명자가 모바일 웹에서 위 계약서를 열람하고 직접 손으로 서명하여 제출한 전자문서입니다.',
    '본 서명은 단순 전자서명이며 공인전자서명(공동인증서 등)이 아닙니다.',
    '위 SHA-256 값은 서명 당시의 원본 문서와 서명 이미지의 해시입니다. 최종 서명본 파일의 해시는 관리자 화면에 따로 기록됩니다.',
  ]
  for (const n of note) {
    const t = await textImg(n, 8.5, { color: '#6b6963', maxWidthPt: A4[0] - M * 2 })
    ap.drawImage(t.img, { x: M, y: y - t.hPt + 8, width: t.wPt, height: t.hPt })
    y -= t.hPt + 4
  }
  void grey

  doc.setTitle(input.title)
  doc.setProducer('HM E-Sign')
  doc.setCreator('HM E-Sign')
  const pdf = await doc.save()
  return { pdf, originalSha256, signatureSha256, pageCount: pages.length + 1 }
}

export function wrapAscii(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (font.widthOfTextAtSize(next, size) > maxW && line) {
      out.push(line)
      line = ch
    } else line = next
  }
  if (line) out.push(line)
  return out.length ? out : ['']
}

/** 서명 이미지를 PDF 로 합치는 순수 함수: JPEG 바이트들을 페이지로 만든다. */
export async function jpegsToPdf(items: { bytes: Uint8Array; w: number; h: number }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const it of items) {
    const img = await doc.embedJpg(it.bytes)
    const w = 595.28
    const h = (w * it.h) / it.w
    const page = doc.addPage([w, h])
    page.drawImage(img, { x: 0, y: 0, width: w, height: h })
  }
  return doc.save()
}
