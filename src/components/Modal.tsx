import { useEffect, type ReactNode } from 'react'

export default function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><strong>{title}</strong><button className="x" onClick={onClose} aria-label="닫기">×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
