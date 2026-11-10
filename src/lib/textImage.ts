import type { TextImage } from './stamp'

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif'

async function ensureFont(bold: boolean) {
  try {
    await Promise.all([
      document.fonts.load(`${bold ? 700 : 500} 20px "Pretendard Variable"`, '가나다ABC123'),
    ])
  } catch { /* 시스템 글꼴로 진행 */ }
}

/** 글자를 투명 배경 PNG 로 그린다. sizePt = PDF 에서의 글자 크기(pt). 4배 해상도. */
export const renderTextImage = async (
  text: string,
  opt: { sizePt: number; color?: string; maxWidthPt?: number; bold?: boolean },
): Promise<TextImage> => {
  await ensureFont(!!opt.bold)
  const S = 4
  const size = opt.sizePt
  const font = `${opt.bold ? 700 : 500} ${size * S}px ${FONT}`
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = font
  const maxW = (opt.maxWidthPt ?? 10000) * S
  // 줄바꿈: 글자 단위(한글은 어절 경계가 없어도 읽히도록)
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const ch of para) {
      const next = line + ch
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = ch } else line = next
    }
    lines.push(line)
  }
  const lh = size * S * 1.35
  const w = Math.max(1, Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))))
  const h = Math.ceil(lh * lines.length)
  c.width = w + 2
  c.height = h + 2
  const g = c.getContext('2d')!
  g.font = font
  g.fillStyle = opt.color ?? '#111111'
  g.textBaseline = 'middle'
  lines.forEach((l, i) => g.fillText(l, 1, 1 + lh * i + lh / 2))
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'))
  const png = new Uint8Array(await blob.arrayBuffer())
  return { png, wPt: c.width / S, hPt: c.height / S }
}
