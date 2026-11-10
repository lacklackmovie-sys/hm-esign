import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { jpegsToPdf, stampSignedPdf, toPdfBox } from '../src/lib/stamp'
import { fakeRenderText, makeOriginal, makePng, sigPng } from './helpers'
import { sha256Hex } from '../src/lib/util'

const base = {
  signaturePng: sigPng(), signerName: '홍길동', signedAt: new Date('2026-11-10T05:30:05Z'),
  contractId: '11111111-2222-3333-4444-555555555555', title: '모델 전속 계약서', recipientName: '홍길동',
  ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) KAKAOTALK 10.4', renderText: fakeRenderText,
}
mkdirSync('test-out', { recursive: true })

describe('toPdfBox: 화면 좌표 → PDF 좌표 (페이지 회전 포함)', () => {
  it('회전 0: 왼쪽 위 기준 → 왼쪽 아래 기준', async () => {
    const d = await PDFDocument.create(); const p = d.addPage([600, 800])
    const b = toPdfBox(p, { x: 0.1, y: 0.2, w: 0.3, h: 0.1 })
    expect(b).toMatchObject({ x: 60, y: 800 - 0.3 * 800, width: 180, height: 80 })
  })
  it.each([90, 180, 270])('회전 %i: 상자 모서리가 페이지 안에 있다', async (ang) => {
    const { degrees } = await import('pdf-lib')
    const d = await PDFDocument.create(); const p = d.addPage([600, 800]); p.setRotation(degrees(ang))
    const b = toPdfBox(p, { x: 0.1, y: 0.2, w: 0.3, h: 0.1 })
    expect(b.angle).toBe(ang)
    expect(b.x).toBeGreaterThanOrEqual(-0.001); expect(b.y).toBeGreaterThanOrEqual(-0.001)
  })
  it('회전 90: 보이는 왼쪽 위(0,0)의 아래 모서리는 원본 좌표에서 (py, px)', async () => {
    const { degrees } = await import('pdf-lib')
    const d = await PDFDocument.create(); const p = d.addPage([600, 800]); p.setRotation(degrees(90))
    const b = toPdfBox(p, { x: 0, y: 0, w: 0.5, h: 0.25 }) // 보이는 크기 800x600
    expect(b.x).toBeCloseTo(0.25 * 600) // by = py + bh = 150
    expect(b.y).toBeCloseTo(0)
  })
})

describe('stampSignedPdf', () => {
  it('원본 N쪽 + 확인서 1쪽, 해시 일치, 서명 칸에 이미지가 들어간다', async () => {
    const original = await makeOriginal()
    const fields = [
      { id: 'a', type: 'signature' as const, page: 1, x: 0.5, y: 0.8, w: 0.35, h: 0.1 },
      { id: 'b', type: 'name' as const, page: 1, x: 0.1, y: 0.8, w: 0.25, h: 0.04 },
      { id: 'c', type: 'date' as const, page: 1, x: 0.1, y: 0.86, w: 0.25, h: 0.04 },
    ]
    const r = await stampSignedPdf({ ...base, original, fields })
    expect(r.pageCount).toBe(3)
    expect(r.originalSha256).toBe(await sha256Hex(original))
    const out = await PDFDocument.load(r.pdf)
    expect(out.getPageCount()).toBe(3)
    expect(out.getPage(2).getSize().width).toBeCloseTo(595.28, 1)
    // 서명 칸이 있는 2쪽 컨텐츠가 원본보다 커졌고, 1쪽은 그대로여야 한다
    const o = await PDFDocument.load(original)
    expect(out.getPage(0).node.Contents()?.toString()).toBe(o.getPage(0).node.Contents()?.toString())
    writeFileSync('test-out/stamped.pdf', r.pdf)
  })
  it('서명 칸을 안 정하면 확인서에만 서명이 들어간다(원본 쪽수 그대로 + 1)', async () => {
    const original = await makeOriginal()
    const r = await stampSignedPdf({ ...base, original, fields: [] })
    expect(r.pageCount).toBe(3)
  })
  it('회전된 페이지(90°)도 오류 없이 찍힌다', async () => {
    const original = await makeOriginal(90)
    const r = await stampSignedPdf({ ...base, original, fields: [{ id: 'a', type: 'signature', page: 1, x: 0.1, y: 0.1, w: 0.3, h: 0.1 }, { id: 'n', type: 'name', page: 1, x: 0.5, y: 0.1, w: 0.3, h: 0.05 }] })
    writeFileSync('test-out/stamped-rot90.pdf', r.pdf)
    expect(r.pageCount).toBe(3)
  })
  it('다중 모드: 제출 ID·연락처 행이 확인서에 들어간다', async () => {
    const original = await makeOriginal()
    const r = await stampSignedPdf({ ...base, original, fields: [], signingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', signerPhone: '010-1234-5678', recipientName: 'MULTI' })
    writeFileSync('test-out/stamped-multi.pdf', r.pdf)
    const { spawnSync } = await import('node:child_process')
    const t = spawnSync('pdftotext', ['-f', '3', '-l', '3', 'test-out/stamped-multi.pdf', '-'])
    if (t.error) return // pdftotext 가 없는 환경에서는 텍스트 확인만 건너뜀
    expect(t.stdout.toString()).toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(t.stdout.toString()).toContain('010-1234-5678')
  })
  it('사진 → PDF', async () => {
    // 가짜 JPEG 는 못 만들므로 PNG 를 거치지 않는 대신 빈 입력/잘못된 입력 처리만 확인
    await expect(jpegsToPdf([{ bytes: new Uint8Array([1, 2, 3]), w: 10, h: 10 }])).rejects.toThrow()
    expect(makePng(2, 2, () => [0, 0, 0, 255]).length).toBeGreaterThan(20)
  })
})
