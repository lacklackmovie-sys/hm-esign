import { FN_URL, SUPABASE_KEY } from './config'
import type { Field } from './types'

export type OpenResult =
  | { status: 'open'; mode: 'single' | 'multi'; contract_id: string; title: string; recipient_name: string; page_count: number; fields: Field[]; expires_at: string | null; original_url: string; client_ip: string | null }
  | { status: 'signed'; title: string; recipient_name: string; signed_at: string }
  | { status: 'expired'; title: string }
  | { status: 'closed' | 'full'; title: string }
  | { status: 'device_signed'; title: string; signed_at: string }
  | { status: 'not_found' }

export async function openContract(token: string, deviceId?: string): Promise<OpenResult> {
  const r = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ action: 'open', token, device_id: deviceId }),
  })
  if (r.status === 404) return { status: 'not_found' }
  if (!r.ok) throw new Error('open_failed')
  return r.json()
}

export interface SignOk { ok: true; signed_at: string; sha256: string; download_url: string | null }

export async function submitSigned(token: string, signerName: string, pdf: Uint8Array, multi?: { phone: string; deviceId: string; signingId: string }): Promise<SignOk> {
  const fd = new FormData()
  fd.append('token', token)
  fd.append('signer_name', signerName)
  if (multi) { fd.append('signer_phone', multi.phone); fd.append('device_id', multi.deviceId); fd.append('signing_id', multi.signingId) }
  fd.append('file', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'signed.pdf')
  const r = await fetch(FN_URL, { method: 'POST', headers: { apikey: SUPABASE_KEY }, body: fd })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error((j as { error?: string }).error ?? 'submit_failed')
    throw e
  }
  return j as SignOk
}

export async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('download_failed')
  return new Uint8Array(await r.arrayBuffer())
}
