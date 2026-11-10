import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal'
import PdfPages from '../components/PdfPages'
import { toast } from '../components/Toast'
import { deleteTemplate, downloadBytes, listTemplates, renameTemplate, signedUrl, uploadTemplate, UploadError } from '../lib/admin'
import { go } from '../lib/hooks'
import type { Template } from '../lib/types'
import { fileBase, fmtKST, fmtSize } from '../lib/util'

export function triggerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function Templates() {
  const [items, setItems] = useState<Template[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ files: File[]; name: string } | null>(null)
  const [err, setErr] = useState('')
  const [rename, setRename] = useState<Template | null>(null)
  const [del, setDel] = useState<Template | null>(null)
  const [preview, setPreview] = useState<{ t: Template; bytes: Uint8Array } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try { setItems(await listTemplates()) } catch { setErr('목록을 불러오지 못했어요.') }
  }, [])
  useEffect(() => { load() }, [load])

  function pick(fl: FileList | null) {
    if (!fl || fl.length === 0) return
    const files = Array.from(fl)
    setErr('')
    setPending({ files, name: fileBase(files[0].name) })
    if (input.current) input.current.value = ''
  }

  async function doUpload() {
    if (!pending) return
    setBusy(true)
    setErr('')
    try {
      await uploadTemplate(pending.files, pending.name)
      setPending(null)
      toast('양식을 올렸어요')
      await load()
    } catch (e) {
      setErr(e instanceof UploadError ? e.message : '업로드에 실패했어요.')
    } finally { setBusy(false) }
  }

  async function download(t: Template) {
    try { triggerDownload(await signedUrl(t.file_path, `${t.name}.pdf`)) } catch { toast('다운로드 링크를 만들지 못했어요') }
  }
  async function showPreview(t: Template) {
    try { setPreview({ t, bytes: await downloadBytes(t.file_path) }) } catch { toast('미리보기를 열지 못했어요') }
  }

  return (
    <section>
      <div className="page-head">
        <h1>계약서 양식</h1>
        <button className="btn primary" onClick={() => input.current?.click()} data-testid="upload-btn">+ 양식 올리기</button>
        <input ref={input} type="file" accept="application/pdf,.pdf,image/jpeg,image/png" multiple hidden onChange={(e) => pick(e.target.files)} data-testid="upload-input" />
      </div>
      <p className="muted small">PDF 파일 또는 사진(JPG/PNG)을 올려요. 사진은 PDF 로 바꿔서 저장돼요. (파일당 20MB 이하)</p>
      {err && !pending && <p className="err">{err}</p>}
      {items === null && <p className="muted pad center">불러오는 중…</p>}
      {items?.length === 0 && (
        <div className="empty">
          <p>아직 올린 양식이 없어요.</p>
          <button className="btn primary" onClick={() => input.current?.click()}>첫 양식 올리기</button>
        </div>
      )}
      <ul className="cards">
        {items?.map((t) => (
          <li key={t.id} className="card" data-testid="template-item">
            <div className="card-main">
              <strong className="ttl">{t.name}</strong>
              <span className="meta">{t.page_count}쪽 · {fmtSize(t.size_bytes)} · {fmtKST(t.created_at)}</span>
            </div>
            <div className="row-actions">
              <button className="btn primary sm" onClick={() => go(`/new?template=${t.id}`)} data-testid="use-template">계약 만들기</button>
              <button className="btn sm" onClick={() => showPreview(t)}>보기</button>
              <button className="btn sm" onClick={() => download(t)} data-testid="dl-template">다운로드</button>
              <button className="btn sm" onClick={() => setRename(t)}>이름 변경</button>
              <button className="btn sm danger" onClick={() => setDel(t)} data-testid="del-template">삭제</button>
            </div>
          </li>
        ))}
      </ul>

      {pending && (
        <Modal title="양식 올리기" onClose={() => !busy && setPending(null)}>
          <p className="small muted">{pending.files.length === 1 ? pending.files[0].name : `사진 ${pending.files.length}장`}</p>
          <label className="field"><span>양식 이름</span>
            <input value={pending.name} maxLength={120} onChange={(e) => setPending({ ...pending, name: e.target.value })} data-testid="upload-name" />
          </label>
          {err && <p className="err" data-testid="upload-err">{err}</p>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setPending(null)} disabled={busy}>취소</button>
            <button className="btn primary" onClick={doUpload} disabled={busy || !pending.name.trim()} data-testid="upload-confirm">{busy ? '올리는 중…' : '올리기'}</button>
          </div>
        </Modal>
      )}
      {rename && <RenameModal t={rename} onClose={() => setRename(null)} onDone={() => { setRename(null); load() }} />}
      {del && (
        <Modal title="양식 삭제" onClose={() => setDel(null)}>
          <p>「{del.name}」 양식을 삭제할까요?</p>
          <p className="small muted">이미 만든 계약서는 그대로 남아요.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDel(null)}>취소</button>
            <button className="btn danger solid" data-testid="del-confirm" onClick={async () => {
              try { await deleteTemplate(del); setDel(null); toast('삭제했어요'); load() } catch { toast('삭제하지 못했어요') }
            }}>삭제</button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.t.name} wide onClose={() => setPreview(null)}>
          <PdfPages bytes={preview.bytes} />
        </Modal>
      )}
    </section>
  )
}

function RenameModal({ t, onClose, onDone }: { t: Template; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(t.name)
  return (
    <Modal title="이름 변경" onClose={onClose}>
      <label className="field"><span>양식 이름</span>
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} data-testid="rename-input" />
      </label>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn primary" disabled={!name.trim()} data-testid="rename-confirm" onClick={async () => {
          try { await renameTemplate(t.id, name); toast('이름을 바꿨어요'); onDone() } catch { toast('바꾸지 못했어요') }
        }}>저장</button>
      </div>
    </Modal>
  )
}
