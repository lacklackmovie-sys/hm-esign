import { useCallback, useEffect, useRef, useState } from 'react'

interface P { x: number; y: number; w: number }
interface Props { onCancel: () => void; onDone: (png: Uint8Array, dataUrl: string) => void }

const INK = '#12182b'

/** 손가락 서명판: 부드러운 곡선, 속도에 따라 굵기가 달라지고, 되돌리기·지우기를 지원한다. */
export default function SignaturePad({ onCancel, onDone }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<P[][]>([])
  const current = useRef<P[] | null>(null)
  const [count, setCount] = useState(0)
  const dims = useRef({ w: 300, h: 220, dpr: 1 })

  const redraw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const g = c.getContext('2d')!
    const { dpr } = dims.current
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, c.width, c.height)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = INK
    g.fillStyle = INK
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) drawStroke(g, s)
  }, [])

  useEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current, c = canvasRef.current
      if (!wrap || !c) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const w = wrap.clientWidth, h = wrap.clientHeight
      dims.current = { w, h, dpr }
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      redraw()
    }
    fit()
    window.addEventListener('resize', fit)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', fit)
      document.body.style.overflow = prev
    }
  }, [redraw])

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    const p = pos(e)
    current.current = [{ ...p, w: 2.6 }]
    redraw()
  }
  const move = (e: React.PointerEvent) => {
    const cur = current.current
    if (!cur) return
    e.preventDefault()
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent]
    const r = canvasRef.current!.getBoundingClientRect()
    for (const ev of evs) {
      const x = ev.clientX - r.left, y = ev.clientY - r.top
      const last = cur[cur.length - 1]
      const d = Math.hypot(x - last.x, y - last.y)
      if (d < 1.2) continue
      const target = Math.max(1.6, Math.min(4.2, 4.6 - d * 0.22))
      cur.push({ x, y, w: last.w * 0.7 + target * 0.3 })
    }
    redraw()
  }
  const up = () => {
    const cur = current.current
    if (!cur) return
    current.current = null
    strokes.current.push(cur)
    setCount(strokes.current.length)
    redraw()
  }

  const undo = () => { strokes.current.pop(); setCount(strokes.current.length); redraw() }
  const clear = () => { strokes.current = []; setCount(0); redraw() }

  const finish = () => {
    const all = strokes.current
    const pts = all.flat()
    const inkLen = all.reduce((n, s) => n + s.length, 0)
    if (pts.length < 8 || inkLen < 8) return
    // 서명이 차지하는 영역만 잘라서 투명 PNG 로 만든다(해상도 3배)
    const pad = 8
    const minX = Math.min(...pts.map((p) => p.x)) - pad
    const minY = Math.min(...pts.map((p) => p.y)) - pad
    const maxX = Math.max(...pts.map((p) => p.x)) + pad
    const maxY = Math.max(...pts.map((p) => p.y)) + pad
    const S = 3
    const out = document.createElement('canvas')
    out.width = Math.max(20, Math.ceil((maxX - minX) * S))
    out.height = Math.max(20, Math.ceil((maxY - minY) * S))
    const g = out.getContext('2d')!
    g.setTransform(S, 0, 0, S, -minX * S, -minY * S)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = INK
    g.fillStyle = INK
    for (const s of all) drawStroke(g, s)
    out.toBlob(async (b) => {
      if (!b) return
      const png = new Uint8Array(await b.arrayBuffer())
      onDone(png, out.toDataURL('image/png'))
    }, 'image/png')
  }

  return (
    <div className="pad-overlay" role="dialog" aria-label="서명하기">
      <div className="pad-head">
        <button className="btn ghost" onClick={onCancel}>취소</button>
        <strong>여기에 손가락으로 서명하세요</strong>
        <span style={{ width: 56 }} />
      </div>
      <div className="pad-body">
        <div className="pad-canvas-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="pad-canvas"
            data-testid="sig-canvas"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          {count === 0 && !current.current && <span className="pad-hint">서명</span>}
          <span className="pad-line" />
        </div>
      </div>
      <div className="pad-foot">
        <button className="btn" onClick={undo} disabled={count === 0}>되돌리기</button>
        <button className="btn" onClick={clear} disabled={count === 0}>모두 지우기</button>
        <button className="btn primary" onClick={finish} disabled={count === 0} data-testid="sig-done">서명 완료</button>
      </div>
    </div>
  )
}

function drawStroke(g: CanvasRenderingContext2D, s: P[]) {
  if (s.length === 1) {
    g.beginPath()
    g.arc(s[0].x, s[0].y, s[0].w / 2 + 0.6, 0, Math.PI * 2)
    g.fill()
    return
  }
  for (let i = 1; i < s.length; i++) {
    const p0 = s[i - 1], p1 = s[i], p2 = s[i + 1] ?? p1
    const m0 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
    const m1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    g.beginPath()
    g.lineWidth = (p0.w + p1.w) / 2
    g.moveTo(i === 1 ? p0.x : m0.x, i === 1 ? p0.y : m0.y)
    g.quadraticCurveTo(p1.x, p1.y, i === s.length - 1 ? p1.x : m1.x, i === s.length - 1 ? p1.y : m1.y)
    g.stroke()
  }
}
