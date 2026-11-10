import { PDFDocument } from 'pdf-lib'
import { BUCKET } from './config'
import { supabase } from './supabase'
import { imagesToPdf } from './images'
import { destroyPdf, openPdf } from './pdf'
import type { Contract, Field, Template } from './types'
import { uid } from './util'

export const MAX_UPLOAD = 20 * 1024 * 1024

export function linkFor(token: string): string {
  const u = new URL(window.location.href)
  u.hash = `#/s/${token}`
  u.search = ''
  return u.toString()
}

export async function listTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from('esign_templates').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Template[]
}

export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await supabase.from('esign_contracts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Contract[]
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase.from('esign_contracts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Contract | null
}

export async function signedUrl(path: string, download?: string, expires = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expires, download ? { download } : undefined)
  if (error || !data) throw error ?? new Error('url')
  return data.signedUrl
}

export async function downloadBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw error ?? new Error('download')
  return new Uint8Array(await data.arrayBuffer())
}

export class UploadError extends Error {}

/** PDF 또는 사진(JPG/PNG)을 받아 서명용 PDF 로 저장한다. */
export async function uploadTemplate(files: File[], name: string): Promise<Template> {
  if (files.length === 0) throw new UploadError('파일을 선택해 주세요.')
  const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
  let bytes: Uint8Array
  if (files.length === 1 && isPdf(files[0])) {
    if (files[0].size > MAX_UPLOAD) throw new UploadError('파일이 너무 커요. 20MB 이하로 올려 주세요.')
    bytes = new Uint8Array(await files[0].arrayBuffer())
  } else {
    if (files.some(isPdf)) throw new UploadError('PDF 는 한 번에 하나씩 올려 주세요. 사진은 여러 장을 한꺼번에 올릴 수 있어요.')
    if (files.some((f) => !/^image\/(jpeg|png)$/.test(f.type) && !/\.(jpe?g|png)$/i.test(f.name))) throw new UploadError('PDF 또는 JPG/PNG 사진만 올릴 수 있어요.')
    if (files.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024) throw new UploadError('사진 용량이 너무 커요.')
    try { bytes = await imagesToPdf(files) } catch { throw new UploadError('사진을 읽을 수 없어요. 다른 파일로 시도해 주세요.') }
  }
  if (bytes.byteLength > MAX_UPLOAD) throw new UploadError('변환된 파일이 너무 커요(20MB 초과). 사진 수를 줄여 주세요.')
  // 서명 때 글자·서명을 찍을 수 있는 PDF 인지 미리 확인(암호 걸린 PDF 등은 거절)
  let pages = 0
  try {
    const d = await PDFDocument.load(bytes)
    pages = d.getPageCount()
    const v = await openPdf(bytes)
    pages = v.numPages
    destroyPdf(v)
  } catch {
    throw new UploadError('이 PDF 는 서명용으로 쓸 수 없어요(암호가 걸렸거나 손상된 파일). 암호를 풀고 다시 저장해서 올려 주세요.')
  }
  if (pages < 1 || pages > 200) throw new UploadError('페이지 수가 1~200쪽인 문서만 올릴 수 있어요.')

  const path = `templates/${crypto.randomUUID()}.pdf`
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (up.error) throw new UploadError('업로드에 실패했어요. 잠시 뒤에 다시 시도해 주세요.')
  const { data, error } = await supabase.from('esign_templates')
    .insert({ name: name.trim().slice(0, 120) || '계약서 양식', file_path: path, page_count: pages, size_bytes: bytes.byteLength })
    .select('*').single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new UploadError('저장에 실패했어요. 다시 시도해 주세요.')
  }
  return data as Template
}

export async function renameTemplate(id: string, name: string) {
  const { error } = await supabase.from('esign_templates').update({ name: name.trim().slice(0, 120) }).eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(t: Template) {
  const { error } = await supabase.from('esign_templates').delete().eq('id', t.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([t.file_path])
}

export interface NewContract {
  template: Template
  title: string
  recipient_name: string
  recipient_phone: string
  memo: string
  fields: Field[]
  expiresInDays: number | null
}

export async function createContract(n: NewContract): Promise<Contract> {
  // 양식을 지워도 계약서가 남도록 계약마다 원본 사본을 따로 둔다
  const id = crypto.randomUUID()
  const path = `contracts/${id}/original.pdf`
  const cp = await supabase.storage.from(BUCKET).copy(n.template.file_path, path)
  if (cp.error) throw new Error('양식 파일을 복사하지 못했어요.')
  const expires_at = n.expiresInDays ? new Date(Date.now() + n.expiresInDays * 86400_000).toISOString() : null
  const { data, error } = await supabase.from('esign_contracts').insert({
    id,
    title: n.title.trim().slice(0, 160),
    template_id: n.template.id,
    recipient_name: n.recipient_name.trim().slice(0, 80),
    recipient_phone: n.recipient_phone.trim().slice(0, 40),
    memo: n.memo.trim().slice(0, 1000),
    fields: n.fields,
    original_path: path,
    page_count: n.template.page_count,
    expires_at,
  }).select('*').single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error('계약서를 만들지 못했어요.')
  }
  return data as Contract
}

export async function deleteContract(c: Contract) {
  const files = [c.original_path, ...(c.signed_path ? [c.signed_path] : [])]
  const { error } = await supabase.from('esign_contracts').delete().eq('id', c.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove(files)
}

export async function extendContract(id: string, days: number | null) {
  const expires_at = days ? new Date(Date.now() + days * 86400_000).toISOString() : null
  const { error } = await supabase.from('esign_contracts').update({ expires_at }).eq('id', id).neq('status', 'signed')
  if (error) throw error
}

export { uid }

export function triggerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
