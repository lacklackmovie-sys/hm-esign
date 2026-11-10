import { useRef } from 'react'
import type { Field } from '../lib/types'
import { FIELD_DEFAULTS, fitBox } from '../lib/util'

interface Props {
  page: number
  fields: Field[]
  selected: string | null
  onSelect: (id: string | null) => void
  onChange: (f: Field) => void
  onDelete: (id: string) => void
}

/** 한 페이지 위의 서명 칸들. 끌어서 옮기고, 오른쪽 아래 점으로 크기를 바꾼다. */
export default function FieldLayer({ page, fields, selected, onSelect, onChange, onDelete }: Props) {
  const drag = useRef<null | { mode: 'move' | 'size'; sx: number; sy: number; f: Field; rw: number; rh: number }>(null)

  const start = (e: React.PointerEvent, f: Field, mode: 'move' | 'size') => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const pr = (e.currentTarget as HTMLElement).closest('.pdf-page')!.getBoundingClientRect()
    drag.current = { mode, sx: e.clientX, sy: e.clientY, f, rw: pr.width, rh: pr.height }
    onSelect(f.id)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / d.rw
    const dy = (e.clientY - d.sy) / d.rh
    if (d.mode === 'move') onChange({ ...d.f, ...fitBox(d.f.x + dx, d.f.y + dy, d.f.w, d.f.h) })
    else {
      const w = Math.min(1 - d.f.x, d.f.w + dx)
      const h = Math.min(1 - d.f.y, d.f.h + dy)
      onChange({ ...d.f, ...fitBox(d.f.x, d.f.y, w, h) })
    }
  }
  const end = () => { drag.current = null }

  return (
    <>
      {fields.filter((f) => f.page === page).map((f) => {
        const sel = selected === f.id
        return (
          <div
            key={f.id}
            className={`fbox ${f.type} ${sel ? 'sel' : ''}`}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
            data-field={f.type}
            data-testid="fbox"
            onPointerDown={(e) => start(e, f, 'move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <span className="flabel">{FIELD_DEFAULTS[f.type].label}</span>
            {sel && (
              <>
                <button className="fdel" aria-label="이 칸 삭제" data-testid="fdel"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(f.id) }}>×</button>
                <span className="fsize" onPointerDown={(e) => start(e, f, 'size')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
