// HM e-sign: 서명자(비로그인) 전용 엣지 함수. 토큰으로만 접근한다.
// 서비스 키는 함수 안에서만 쓰이고 브라우저로 나가지 않는다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

const TOKEN_RE = /^[a-f0-9]{64}$/
const MAX_PDF = 25 * 1024 * 1024
const COLS = 'id,title,recipient_name,status,fields,original_path,page_count,expires_at,signed_at'

const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

async function load(token: unknown) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null
  const { data } = await supabase.from('esign_contracts').select(COLS).eq('token', token).maybeSingle()
  return data
}
const isExpired = (c: { status: string; expires_at: string | null }) =>
  c.status !== 'signed' && !!c.expires_at && new Date(c.expires_at).getTime() <= Date.now()

async function sha256Hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function open(req: Request, body: Record<string, unknown>) {
  const c = await load(body.token)
  if (!c) return json({ error: 'not_found' }, 404)
  if (c.status === 'signed') return json({ status: 'signed', title: c.title, recipient_name: c.recipient_name, signed_at: c.signed_at })
  if (isExpired(c)) return json({ status: 'expired', title: c.title })
  if (c.status === 'sent') {
    await supabase.from('esign_contracts').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'sent')
  }
  const { data: signed, error } = await supabase.storage.from('esign').createSignedUrl(c.original_path, 3600)
  if (error || !signed) return json({ error: 'file_unavailable' }, 500)
  return json({
    status: 'open',
    contract_id: c.id,
    title: c.title,
    recipient_name: c.recipient_name,
    page_count: c.page_count,
    fields: c.fields,
    expires_at: c.expires_at,
    original_url: signed.signedUrl,
    client_ip: clientIp(req),
  })
}

async function sign(req: Request) {
  const form = await req.formData()
  const c = await load(form.get('token'))
  if (!c) return json({ error: 'not_found' }, 404)
  if (c.status === 'signed') return json({ error: 'already_signed' }, 409)
  if (isExpired(c)) return json({ error: 'expired' }, 410)
  const name = String(form.get('signer_name') ?? '').trim()
  if (name.length < 1 || name.length > 60) return json({ error: 'bad_name' }, 400)
  const file = form.get('file')
  if (!(file instanceof File) || file.size < 100 || file.size > MAX_PDF) return json({ error: 'bad_file' }, 400)
  const buf = await file.arrayBuffer()
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, 5))
  if (head !== '%PDF-') return json({ error: 'bad_file' }, 400)
  const hash = await sha256Hex(buf)

  const path = `signed/${c.id}.pdf`
  const up = await supabase.storage.from('esign').upload(path, buf, { contentType: 'application/pdf', upsert: false })
  if (up.error) return json({ error: 'already_signed' }, 409)

  const signedAt = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('esign_contracts')
    .update({
      status: 'signed',
      signed_at: signedAt,
      signed_path: path,
      signed_sha256: hash,
      signer_name: name,
      signer_ip: clientIp(req),
      signer_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    })
    .eq('id', c.id)
    .in('status', ['sent', 'viewed'])
    .or(`expires_at.is.null,expires_at.gt.${signedAt}`)
    .select('id')
  if (error || !rows || rows.length === 0) {
    await supabase.storage.from('esign').remove([path])
    return json({ error: 'conflict' }, 409)
  }
  const { data: dl } = await supabase.storage.from('esign').createSignedUrl(path, 600, { download: 'signed-contract.pdf' })
  return json({ ok: true, signed_at: signedAt, sha256: hash, download_url: dl?.signedUrl ?? null })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('multipart/form-data')) return await sign(req)
    const body = await req.json()
    if (body?.action === 'open') return await open(req, body)
    return json({ error: 'bad_request' }, 400)
  } catch (_e) {
    return json({ error: 'server_error' }, 500)
  }
})
