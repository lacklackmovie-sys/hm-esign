import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import { BASE } from './config'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy
const tasks = new WeakMap<PdfDoc, pdfjs.PDFDocumentLoadingTask>()

/** 바이트로 PDF 를 연다. pdf.js 가 버퍼를 가져가므로 복사본을 넘긴다. */
export async function openPdf(bytes: Uint8Array): Promise<PdfDoc> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    cMapUrl: `${BASE}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${BASE}pdfjs/standard_fonts/`,
    wasmUrl: `${BASE}pdfjs/wasm/`,
  })
  const doc = await task.promise
  tasks.set(doc, task)
  return doc
}

export function destroyPdf(doc: PdfDoc) {
  tasks.get(doc)?.destroy().catch(() => {})
}

/** 렌더 크기(픽셀 수)가 너무 크면 아이폰 사파리에서 캔버스가 비므로 줄인다. */
export function pickScale(cssWidth: number, pageW: number, pageH: number, dpr: number): number {
  const wanted = (cssWidth / pageW) * Math.min(dpr, 2)
  const maxPixels = 12_000_000
  const cap = Math.sqrt(maxPixels / (pageW * pageH))
  return Math.max(0.2, Math.min(wanted, cap))
}

export async function renderPageTo(doc: PdfDoc, pageNo: number, canvas: HTMLCanvasElement, cssWidth: number) {
  const page = await doc.getPage(pageNo)
  const base = page.getViewport({ scale: 1 })
  const scale = pickScale(cssWidth, base.width, base.height, window.devicePixelRatio || 1)
  const vp = page.getViewport({ scale })
  canvas.width = Math.floor(vp.width)
  canvas.height = Math.floor(vp.height)
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
}

export async function pageAspects(doc: PdfDoc): Promise<number[]> {
  const out: number[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const v = p.getViewport({ scale: 1 })
    out.push(v.width / v.height)
  }
  return out
}
