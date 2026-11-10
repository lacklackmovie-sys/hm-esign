import type { Contract, DbStatus, Field, FieldType, ShownStatus } from './types'

const KST = 'Asia/Seoul'

function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(d)) o[p.type] = p.value
  return o
}

/** 2026-11-10 14:30:05 KST */
export function fmtKSTFull(v: Date | string): string {
  const p = parts(new Date(v))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} KST`
}
/** 2026.11.10 14:30 */
export function fmtKST(v: Date | string | null | undefined): string {
  if (!v) return '-'
  const p = parts(new Date(v))
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`
}
/** 2026년 11월 10일 */
export function fmtDateKo(v: Date | string): string {
  const p = parts(new Date(v))
  return `${p.year}년 ${Number(p.month)}월 ${Number(p.day)}일`
}

export function shownStatus(c: Pick<Contract, 'status' | 'expires_at'> & { mode?: 'single' | 'multi'; closed?: boolean; max_signers?: number | null; signed_count?: number }, now = Date.now()): ShownStatus {
  if (c.mode === 'multi') {
    if (c.expires_at && new Date(c.expires_at).getTime() <= now) return 'expired'
    if (c.closed || (c.max_signers != null && (c.signed_count ?? 0) >= c.max_signers)) return 'closed'
    return 'collecting'
  }
  if (c.status === 'signed') return 'signed'
  if (c.expires_at && new Date(c.expires_at).getTime() <= now) return 'expired'
  return c.status
}
export const STATUS_LABEL: Record<ShownStatus, string> = {
  sent: '보냄', viewed: '열람', signed: '서명완료', expired: '만료', collecting: '모집중', closed: '마감',
}
export const DB_STATUS_ORDER: DbStatus[] = ['sent', 'viewed', 'signed']

export function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('')
}
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data) // 새 버퍼로 복사(공유 버퍼 방지)
  return toHex(await crypto.subtle.digest('SHA-256', copy))
}

export function uid(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return toHex(b)
}

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n))
}

/** 칸 종류별 기본 크기(페이지 폭 대비 비율)와 가로세로비 */
export const FIELD_DEFAULTS: Record<FieldType, { wFrac: number; ratio: number; label: string }> = {
  signature: { wFrac: 0.3, ratio: 0.36, label: '서명' },
  name: { wFrac: 0.24, ratio: 0.2, label: '이름' },
  date: { wFrac: 0.24, ratio: 0.2, label: '날짜' },
}

/** 탭한 위치(비율)를 중심으로 칸을 만든다. pageAspect = 페이지 가로/세로 */
export function newField(type: FieldType, page: number, cx: number, cy: number, pageAspect: number): Field {
  const d = FIELD_DEFAULTS[type]
  const w = d.wFrac
  const h = (w * d.ratio) * pageAspect // 높이 비율 = (폭 × 비율) × (가로/세로)
  return { id: uid(), type, page, ...fitBox(cx - w / 2, cy - h / 2, w, h) }
}

export function fitBox(x: number, y: number, w: number, h: number) {
  w = clamp(w, 0.05, 1)
  h = clamp(h, 0.015, 1)
  return { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h }
}

export function fileBase(name: string): string {
  return name.replace(/\.[^.]+$/, '').slice(0, 100) || '계약서'
}

export function isKakaoUA(ua: string): boolean {
  return /KAKAOTALK/i.test(ua)
}

export function isValidToken(t: string): boolean {
  return /^[a-f0-9]{64}$/.test(t)
}

/** 이 기기를 구분하는 임의 번호(같은 기기의 중복 제출을 막는 데만 쓰인다. 이름으로는 막지 않는다) */
export function deviceId(): string {
  try {
    let d = localStorage.getItem('hm-esign-device')
    if (!d || !/^[A-Za-z0-9-]{8,64}$/.test(d)) { d = crypto.randomUUID(); localStorage.setItem('hm-esign-device', d) }
    return d
  } catch {
    return crypto.randomUUID()
  }
}
