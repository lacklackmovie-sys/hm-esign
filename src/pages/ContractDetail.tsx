import { useCallback, useEffect, useState } from 'react'
import Modal from '../components/Modal'
import PdfPages from '../components/PdfPages'
import { toast } from '../components/Toast'
import { deleteContract, downloadBytes, extendContract, getContract, linkFor, signedUrl } from '../lib/admin'
import { go } from '../lib/hooks'
import { copyText, shareText } from '../lib/share'
import type { Contract } from '../lib/types'
import { fmtKST, shownStatus } from '../lib/util'
import { triggerDownload } from './Templates'
import { StatusPill } from './Contracts'

export default function ContractDetail({ id, isNew }: { id: string; isNew: boolean }) {
  const [c, setC] = useState<Contract | null | undefined>(undefined)
  const [view, setView] = useState<Uint8Array | null>(null)
  const [del, setDel] = useState(false)
  const [ext, setExt] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setC(await getContract(id)) } catch { setErr('불러오지 못했어요.'); setC(null) }
  }, [id])
  useEffect(() => { load() }, [load])

  if (c === undefined) return <p className="muted pad center">불러오는 중…</p>
  if (c === null) return <section><p className="err">{err || '계약서를 찾을 수 없어요.'}</p><button className="btn" onClick={() => go('/contracts')}>목록으로</button></section>

  const status = shownStatus(c)
  const link = linkFor(c.token)
  const msg = `[허니미디어] ${c.recipient_name}님, 전자계약서 서명을 요청드려요.\n「${c.title}」\n아래 링크를 눌러 내용을 확인하고 서명해 주세요.\n${link}`

  async function share() {
    const r = await shareText('전자계약 서명 요청', msg)
    if (r === 'copied') toast('복사했어요. 카카오톡 대화창에 붙여넣기 하세요')
    else if (r === 'failed') toast('복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요')
  }
  async function copy() {
    toast((await copyText(link)) ? '링크를 복사했어요' : '복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요')
  }
  async function viewSigned() {
    if (!c?.signed_path) return
    try { setView(await downloadBytes(c.signed_path)) } catch { toast('서명본을 열지 못했어요') }
  }
  async function downloadSigned() {
    if (!c?.signed_path) return
    try { triggerDownload(await signedUrl(c.signed_path, `${c.title}_서명완료.pdf`)) } catch { toast('다운로드 링크를 만들지 못했어요') }
  }

  return (
    <section>
      <div className="page-head">
        <button className="link" onClick={() => go('/contracts')}>← 목록</button>
      </div>
      <h1 data-testid="detail-title">{c.title}</h1>
      <div className="row"><StatusPill s={status} /><span className="muted small">{c.recipient_name}{c.recipient_phone ? ` · ${c.recipient_phone}` : ''}</span></div>
      {isNew && <p className="banner ok">계약서를 만들었어요. 아래 버튼으로 링크를 보내 주세요.</p>}

      {status !== 'signed' && (
        <div className="sharebox" data-testid="sharebox">
          {status === 'expired' ? <p className="err">링크 기한이 지났어요. ‘기한 다시 열기’로 새 기한을 주면 같은 링크를 다시 쓸 수 있어요.</p> : <p className="small muted">받는 사람에게 이 링크를 보내세요. 링크를 아는 사람만 열 수 있어요.</p>}
          <input className="linkfield" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="link-field" aria-label="서명 링크" />
          <div className="two">
            <button className="btn big" onClick={copy} data-testid="copy-link">링크 복사</button>
            <button className="btn primary big" onClick={share} data-testid="share-link">카톡으로 보내기</button>
          </div>
          <p className="small muted">‘카톡으로 보내기’는 휴대폰 공유창을 열어요. 거기서 카카오톡을 고르면 돼요. 컴퓨터에서는 메시지가 복사돼요.</p>
        </div>
      )}

      {status === 'signed' && (
        <div className="signedbox" data-testid="signedbox">
          <h2>서명 완료</h2>
          <p>{c.signer_name}님이 {fmtKST(c.signed_at)}에 서명했어요.</p>
          <div className="two">
            <button className="btn big" onClick={viewSigned} data-testid="view-signed">서명본 보기</button>
            <button className="btn primary big" onClick={downloadSigned} data-testid="dl-signed">서명본 다운로드</button>
          </div>
        </div>
      )}

      <dl className="info">
        <dt>상태</dt><dd>{({ sent: '보냄 (아직 안 열어 봄)', viewed: '열람함', signed: '서명 완료', expired: '만료' } as const)[status]}</dd>
        <dt>만든 시각</dt><dd>{fmtKST(c.created_at)}</dd>
        <dt>처음 연 시각</dt><dd>{fmtKST(c.viewed_at)}</dd>
        <dt>서명 시각</dt><dd>{fmtKST(c.signed_at)}</dd>
        <dt>링크 기한</dt><dd>{c.expires_at ? fmtKST(c.expires_at) : '제한 없음'}</dd>
        <dt>서명 칸</dt><dd>{c.fields.length === 0 ? '지정 안 함 (확인서 페이지에 서명)' : `${c.fields.length}개`}</dd>
        {c.memo && (<><dt>메모</dt><dd className="pre">{c.memo}</dd></>)}
        {c.signed_at && (<>
          <dt>서명자 IP</dt><dd>{c.signer_ip ?? '-'}</dd>
          <dt>서명 환경</dt><dd className="break small">{c.signer_user_agent ?? '-'}</dd>
          <dt>서명본 SHA-256</dt><dd className="break small"><code data-testid="hash">{c.signed_sha256}</code></dd>
        </>)}
      </dl>

      <div className="row-actions">
        {status !== 'signed' && <button className="btn" onClick={() => setExt(true)} data-testid="extend-btn">{status === 'expired' ? '기한 다시 열기' : '기한 변경'}</button>}
        <button className="btn danger" onClick={() => setDel(true)} data-testid="del-contract">계약 삭제</button>
      </div>

      {view && <Modal title="서명본" wide onClose={() => setView(null)}><PdfPages bytes={view} /></Modal>}
      {ext && (
        <Modal title="링크 기한" onClose={() => setExt(false)}>
          <p className="small muted">지금부터 며칠 동안 열어 둘까요?</p>
          <div className="chips">
            {[1, 3, 7, 14, 30].map((d) => <button key={d} className="chip" onClick={async () => { await extendContract(c.id, d); setExt(false); toast(`${d}일로 바꿨어요`); load() }}>{d}일</button>)}
            <button className="chip" onClick={async () => { await extendContract(c.id, null); setExt(false); toast('기한을 없앴어요'); load() }}>제한 없음</button>
          </div>
        </Modal>
      )}
      {del && (
        <Modal title="계약 삭제" onClose={() => setDel(false)}>
          <p>「{c.title}」 계약을 삭제할까요?</p>
          <p className="small err">서명된 파일도 함께 지워지고 되돌릴 수 없어요. 필요하면 먼저 서명본을 다운로드해 두세요.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDel(false)}>취소</button>
            <button className="btn danger solid" data-testid="del-contract-confirm" onClick={async () => {
              try { await deleteContract(c); toast('삭제했어요'); go('/contracts') } catch { toast('삭제하지 못했어요') }
            }}>삭제</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
