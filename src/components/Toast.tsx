import { useEffect, useState } from 'react'

let push: (m: string) => void = () => {}
export const toast = (m: string) => push(m)

export function ToastHost() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let t: number
    push = (m) => { setMsg(m); window.clearTimeout(t); t = window.setTimeout(() => setMsg(''), 2600) }
    return () => window.clearTimeout(t)
  }, [])
  return msg ? <div className="toast" role="status" data-testid="toast">{msg}</div> : null
}
