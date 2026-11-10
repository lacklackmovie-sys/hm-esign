import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { deflateSync } from 'node:zlib'

function crc32(buf: Buffer): number {
  let c, crc = ~0
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
/** 단색(RGBA) PNG 생성. fn 으로 픽셀별 색을 정할 수 있다 */
export function makePng(w: number, h: number, px: (x: number, y: number) => [number, number, number, number]): Uint8Array {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y)
      const o = y * (w * 4 + 1) + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]))
}

export const sigPng = () => makePng(200, 80, (x, y) => (Math.abs(y - 40 - 25 * Math.sin(x / 15)) < 3 ? [18, 24, 43, 255] : [0, 0, 0, 0]))

export const fakeRenderText = async (text: string, o: { sizePt: number }) => {
  const wPt = Math.max(10, text.length * o.sizePt * 0.6)
  const hPt = o.sizePt * 1.35
  return { png: makePng(Math.ceil(wPt * 2), Math.ceil(hPt * 2), () => [200, 30, 30, 255]), wPt, hPt }
}

export async function makeOriginal(rotatePage2 = 0): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 2; i++) {
    const p = d.addPage([595, 842])
    p.drawText(`CONTRACT PAGE ${i + 1}`, { x: 60, y: 780, size: 20, font: f })
    p.drawRectangle({ x: 20, y: 20, width: 20, height: 20, color: rgb(0, 0, 1) }) // 왼쪽 아래 파랑 표시
    if (i === 1 && rotatePage2) p.setRotation(degrees(rotatePage2))
  }
  return d.save()
}
