import { useEffect, useRef, useState, type ReactNode } from 'react'
import { destroyPdf, openPdf, pageAspects, renderPageTo, type PdfDoc } from '../lib/pdf'

interface Props {
  bytes: Uint8Array
  /** 페이지 위에 겹쳐 그릴 것(서명 칸 등). 좌표는 페이지 크기에 대한 비율로 배치하세요. */
  overlay?: (pageIndex: number, aspect: number) => ReactNode
  onPageClick?: (pageIndex: number, xFrac: number, yFrac: number, aspect: number) => void
  onReady?: (info: { pages: number; aspects: number[] }) => void
  className?: string
}

/** PDF 를 세로로 이어 보여준다(화면 폭에 맞춤, 손가락 확대/축소는 브라우저 기본 동작 그대로). */
export default function PdfPages({ bytes, overlay, onPageClick, onReady, className }: Props) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [aspects, setAspects] = useState<number[]>([])
  const [error, setError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const readyRef = useRef(onReady)
  readyRef.current = onReady

  useEffect(() => {
    let dead = false
    let d: PdfDoc | null = null
    setDoc(null)
    setError('')
    ;(async () => {
      try {
        d = await openPdf(bytes)
        const a = await pageAspects(d)
        if (dead) return
        setAspects(a)
        setDoc(d)
        readyRef.current?.({ pages: d.numPages, aspects: a })
      } catch {
        if (!dead) setError('문서를 열 수 없어요.')
      }
    })()
    return () => {
      dead = true
      if (d) destroyPdf(d)
    }
  }, [bytes])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)))
    ro.observe(el)
    setWidth(Math.round(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className={`pdf-pages ${className ?? ''}`}>
      {error && <p className="err">{error}</p>}
      {!doc && !error && <p className="muted center pad">문서를 불러오는 중…</p>}
      {doc && width > 0 && aspects.map((a, i) => (
        <PageView key={i} doc={doc} index={i} aspect={a} width={width} overlay={overlay} onPageClick={onPageClick} />
      ))}
    </div>
  )
}

function PageView({ doc, index, aspect, width, overlay, onPageClick }: {
  doc: PdfDoc; index: number; aspect: number; width: number
  overlay?: Props['overlay']; onPageClick?: Props['onPageClick']
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(index < 2)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el || visible) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setVisible(true) }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !canvasRef.current) return
    let dead = false
    setDone(false)
    renderPageTo(doc, index + 1, canvasRef.current, width).then(() => { if (!dead) setDone(true) }).catch(() => {})
    return () => { dead = true }
  }, [visible, doc, index, width])

  return (
    <div
      ref={boxRef}
      className="pdf-page"
      data-page={index}
      data-rendered={done ? '1' : '0'}
      style={{ aspectRatio: String(aspect) }}
      onClick={(e) => {
        if (!onPageClick || e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('pdf-canvas')) return
        const r = boxRef.current!.getBoundingClientRect()
        onPageClick(index, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, aspect)
      }}
    >
      <canvas ref={canvasRef} className="pdf-canvas" />
      <span className="pdf-no">{index + 1}</span>
      {overlay?.(index, aspect)}
    </div>
  )
}
