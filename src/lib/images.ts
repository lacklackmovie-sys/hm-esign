import { jpegsToPdf } from './stamp'

/** 사진(JPG/PNG 등)을 한 장씩 페이지로 하는 PDF 로 바꾼다. 휴대폰 사진의 회전 정보(EXIF)를 반영한다. */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const items: { bytes: Uint8Array; w: number; h: number }[] = []
  for (const f of files) {
    const bmp = await createImageBitmap(f)
    const MAX = 2400
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * k))
    const h = Math.max(1, Math.round(bmp.height * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('jpeg'))), 'image/jpeg', 0.9))
    items.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w, h })
  }
  return jpegsToPdf(items)
}
