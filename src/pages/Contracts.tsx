import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { deleteContract, listContracts, signedUrl, triggerDownload } from '../lib/admin'
import { go } from '../lib/hooks'
import type { Contract, ShownStatus } from '../lib/types'
import { fmtKST, shownStatus, STATUS_LABEL } from '../lib/util'

export function StatusPill({ s }: { s: ShownStatus }) {
  return <span className={`pill ${s}`} data-status={s}>{STATUS_LABEL[s]}</span>
}

const FILTERS: { k: ShownStatus | 'all'; l: string }[] = [
  { k: 'all', l: '전체' }, { k: 'sent', l: '보냄' }, { k: 'viewed', l: '열람' }, { k: 'signed', l: '서명완료' }, { k: 'expired', l: '만료' },
]

export default function Contracts() {
  const [items, setItems] = useState<Contract[] | null>(null)
  const [f, setF] = useState<ShownStatus | 'all'>('all')
  const [err, setErr] = useState('')
  const [del, setDel] = useState<Contract | null>(null)
  const load = useCallback(() => { listContracts().then(setItems).catch(() => setErr('목록을 불러오지 못했어요.')) }, [])
  useEffect(() => { load() }, [load])
  async function download(c: Contract) {
    if (!c.signed_path) return
    try { triggerDownload(await signedUrl(c.signed_path, `${c.title}_서명완료.pdf`)) } catch { toast('다운로드 링크를 만들지 못했어요') }
  }
  const shown = items?.filter((c) => f === 'all' || shownStatus(c) === f)

  return (
    <section>
      <div className="page-head">
        <h1>계약 목록</h1>
        <button className="btn primary" onClick={() => go('/new')} data-testid="new-contract-btn">+ 새 계약</button>
      </div>
      <div className="toolbar scroll">
        {FILTERS.map((x) => <button key={x.k} className={`chip ${f === x.k ? 'on' : ''}`} onClick={() => setF(x.k)}>{x.l}</button>)}
      </div>
      {err && <p className="err">{err}</p>}
      {items === null && !err && <p className="muted pad center">불러오는 중…</p>}
      {shown?.length === 0 && <div className="empty"><p>{items?.length ? '해당하는 계약이 없어요.' : '아직 만든 계약이 없어요.'}</p></div>}
      <ul className="cards">
        {shown?.map((c) => (
          <li key={c.id} className="card clickable" onClick={() => go(`/contracts/${c.id}`)} data-testid="contract-item" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`/contracts/${c.id}`)}>
            <div className="card-main">
              <strong className="ttl">{c.title}</strong>
              <span className="meta">{c.recipient_name} · {fmtKST(c.created_at)}{c.signed_at ? ` · 서명 ${fmtKST(c.signed_at)}` : ''}</span>
            </div>
            <StatusPill s={shownStatus(c)} />
            {c.status === 'signed' && c.signed_path && (
              <div className="actions two-act" role="group" aria-label="서명본 작업" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <button className="btn dl act" onClick={() => download(c)} data-testid="list-dl-signed"><Icon name="download" />서명본 다운로드</button>
                <button className="btn danger act" onClick={() => setDel(c)} data-testid="list-del-contract"><Icon name="trash" />삭제</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {del && (
        <Modal title="계약 삭제" onClose={() => setDel(null)}>
          <p>「{del.title}」 계약을 삭제할까요?</p>
          <p className="small err">서명된 파일도 함께 지워지고 되돌릴 수 없어요. 필요하면 먼저 서명본을 다운로드해 두세요.</p>
          <div className="modal-actions">
            <button className="btn act" onClick={() => setDel(null)}>취소</button>
            <button className="btn danger solid act" data-testid="list-del-confirm" onClick={async () => {
              try { await deleteContract(del); setDel(null); toast('삭제했어요'); load() } catch { toast('삭제하지 못했어요') }
            }}><Icon name="trash" />삭제</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
