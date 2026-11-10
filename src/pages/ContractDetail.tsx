import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import PdfPages from '../components/PdfPages'
import { toast } from '../components/Toast'
import {
  deleteContract, deleteSigning, downloadBytes, extendContract, getContract, linkFor, listSignings, setClosed, setMaxSigners,
  signedUrl, triggerBlobDownload, triggerDownload, zipSignings,
} from '../lib/admin'
import { go } from '../lib/hooks'
import { copyText, shareText } from '../lib/share'
import type { Contract, Signing } from '../lib/types'
import { fmtKST, shownStatus } from '../lib/util'
import { StatusPill } from './Contracts'

export default function ContractDetail({ id, isNew }: { id: string; isNew: boolean }) {
  const [c, setC] = useState<Contract | null | undefined>(undefined)
  const [signings, setSignings] = useState<Signing[]>([])
  const [view, setView] = useState<{ title: string; bytes: Uint8Array } | null>(null)
  const [del, setDel] = useState(false)
  const [delSigning, setDelSigning] = useState<Signing | null>(null)
  const [ext, setExt] = useState(false)
  const [limit, setLimit] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const x = await getContract(id)
      setC(x)
      if (x?.mode === 'multi') setSignings(await listSignings(id))
    } catch { setErr('불러오지 못했어요.'); setC(null) }
  }, [id])
  useEffect(() => { load() }, [load])

  if (c === undefined) return <p className="muted pad center">불러오는 중…</p>
  if (c === null) return <section><p className="err">{err || '계약서를 찾을 수 없어요.'}</p><button className="btn" onClick={() => go('/contracts')}>목록으로</button></section>

  const multi = c.mode === 'multi'
  const count = multi ? signings.length : 0
  const status = shownStatus({ ...c, signed_count: count })
  const link = linkFor(c.token)
  const msg = multi
    ? `[허니미디어] 전자계약 서명을 요청드려요.\n「${c.title}」\n아래 링크를 눌러 내용을 확인하고 서명해 주세요.\n${link}`
    : `[허니미디어] ${c.recipient_name}님, 전자계약서 서명을 요청드려요.\n「${c.title}」\n아래 링크를 눌러 내용을 확인하고 서명해 주세요.\n${link}`

  async function share() {
    const r = await shareText('전자계약 서명 요청', msg)
    if (r === 'copied') toast('복사했어요. 카카오톡 대화창에 붙여넣기 하세요')
    else if (r === 'failed') toast('복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요')
  }
  async function copy() {
    toast((await copyText(link)) ? '링크를 복사했어요' : '복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요')
  }
  async function viewPath(path: string | null, title: string) {
    if (!path) return
    try { setView({ title, bytes: await downloadBytes(path) }) } catch { toast('서명본을 열지 못했어요') }
  }
  async function downloadPath(path: string | null, name: string) {
    if (!path) return
    try { triggerDownload(await signedUrl(path, name)) } catch { toast('다운로드 링크를 만들지 못했어요') }
  }
  async function zipAll() {
    setZipping(true)
    try { triggerBlobDownload(await zipSignings(c!.title, signings), `${c!.title}_서명본_전체.zip`) } catch { toast('ZIP 을 만들지 못했어요') }
    setZipping(false)
  }

  return (
    <section>
      <div className="page-head">
        <button className="link" onClick={() => go('/contracts')}>← 목록</button>
      </div>
      <div className="titlerow"><span className={`badge ${c.mode}`} data-testid="detail-badge">{multi ? '다중 모드' : '싱글 모드 · 1:1'}</span></div>
      <h1 data-testid="detail-title">{c.title}</h1>
      <div className="row"><StatusPill s={status} />{!multi && <span className="muted small">{c.recipient_name}{c.recipient_phone ? ` · ${c.recipient_phone}` : ''}</span>}</div>
      {isNew && <p className="banner ok">계약서를 만들었어요. 아래 버튼으로 링크를 보내 주세요.</p>}

      {(multi ? status !== 'expired' : status !== 'signed') && (
        <div className="sharebox" data-testid="sharebox">
          {status === 'expired' ? <p className="err">링크 기한이 지났어요. ‘기한 다시 열기’로 새 기한을 주면 같은 링크를 다시 쓸 수 있어요.</p>
            : multi ? <p className="small muted">이 링크 하나를 여러 명에게 보내세요. 각자 자기 이름으로 서명하고, 한 기기에서는 한 번만 서명할 수 있어요.</p>
            : <p className="small muted">받는 사람에게 이 링크를 보내세요. 링크를 아는 사람만 열 수 있어요.</p>}
          <input className="linkfield" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="link-field" aria-label="서명 링크" />
          <div className="two">
            <button className="btn big" onClick={copy} data-testid="copy-link">링크 복사</button>
            <button className="btn primary big" onClick={share} data-testid="share-link">카톡으로 보내기</button>
          </div>
          <p className="small muted">‘카톡으로 보내기’는 휴대폰 공유창을 열어요. 거기서 카카오톡을 고르면 돼요. 컴퓨터에서는 메시지가 복사돼요.</p>
        </div>
      )}

      {multi && (
        <>
          <div className="stat" data-testid="multi-stat">
            <div><b data-testid="signed-count">{count}명</b><span>서명 완료</span></div>
            <div><b>{c.max_signers ? `${c.max_signers}명` : '제한 없음'}</b><span>최대 인원</span></div>
            <div><b data-testid="accept-state">{c.closed ? '중지됨' : status === 'closed' ? '정원 마감' : status === 'expired' ? '기한 지남' : '접수 중'}</b><span>접수 상태</span></div>
          </div>
          <div className="row-actions">
            <button className={`btn act ${c.closed ? 'primary' : 'danger'}`} data-testid="toggle-closed" onClick={async () => { await setClosed(c.id, !c.closed); toast(c.closed ? '접수를 다시 열었어요' : '접수를 중지했어요'); load() }}>
              {c.closed ? '▶ 접수 다시 열기' : '■ 접수 중지'}
            </button>
            <button className="btn act" data-testid="change-limit" onClick={() => setLimit(c.max_signers ? String(c.max_signers) : '')}>최대 인원 변경</button>
          </div>

          <h2 style={{ marginTop: 18 }}>서명한 사람 ({count}명)</h2>
          {count > 0 && (
            <button className="btn dl act" onClick={zipAll} disabled={zipping} data-testid="zip-all"><Icon name="download" />{zipping ? '묶는 중…' : `전체 ZIP 다운로드 (${count}개)`}</button>
          )}
          {count === 0 && <div className="empty"><p>아직 서명한 사람이 없어요.</p></div>}
          <ul className="signers" data-testid="signers">
            {signings.map((s) => (
              <li key={s.id} className="card" data-testid="signer-item">
                <div className="card-main">
                  <strong className="ttl" data-testid="signer-row-name">{s.signer_name}</strong>
                  <span className="meta">{s.signer_phone || '연락처 없음'} · {fmtKST(s.signed_at)}</span>
                </div>
                <span className="pill signed">서명완료</span>
                <div className="actions" role="group" aria-label={`${s.signer_name} 서명본`}>
                  <button className="btn act" onClick={() => viewPath(s.signed_path, `${s.signer_name} 서명본`)} data-testid="signer-view"><Icon name="eye" />미리보기</button>
                  <button className="btn dl act" onClick={() => downloadPath(s.signed_path, `${c.title}_${s.signer_name}_서명완료.pdf`)} data-testid="signer-dl"><Icon name="download" />다운로드</button>
                  <button className="btn danger act" onClick={() => setDelSigning(s)} data-testid="signer-del"><Icon name="trash" />삭제</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {!multi && status === 'signed' && (
        <div className="signedbox" data-testid="signedbox">
          <h2>서명 완료</h2>
          <p>{c.signer_name}님이 {fmtKST(c.signed_at)}에 서명했어요.</p>
          <div className="two">
            <button className="btn big" onClick={() => viewPath(c.signed_path, '서명본')} data-testid="view-signed"><Icon name="eye" />서명본 미리보기</button>
            <button className="btn dl big" onClick={() => downloadPath(c.signed_path, `${c.title}_서명완료.pdf`)} data-testid="dl-signed"><Icon name="download" />서명본 다운로드</button>
          </div>
        </div>
      )}

      <dl className="info">
        <dt>보내는 방식</dt><dd>{multi ? '다중 모드 (링크 하나, 여러 명)' : '싱글 모드 (1:1)'}</dd>
        {!multi && (<><dt>상태</dt><dd>{({ sent: '보냄 (아직 안 열어 봄)', viewed: '열람함', signed: '서명 완료', expired: '만료', collecting: '', closed: '' } as const)[status]}</dd></>)}
        <dt>만든 시각</dt><dd>{fmtKST(c.created_at)}</dd>
        <dt>처음 연 시각</dt><dd>{fmtKST(c.viewed_at)}</dd>
        {!multi && (<><dt>서명 시각</dt><dd>{fmtKST(c.signed_at)}</dd></>)}
        <dt>링크 기한</dt><dd>{c.expires_at ? fmtKST(c.expires_at) : '제한 없음'}</dd>
        <dt>서명 칸</dt><dd>{c.fields.length === 0 ? '지정 안 함 (확인서 페이지에 서명)' : `${c.fields.length}개`}</dd>
        {c.memo && (<><dt>메모</dt><dd className="pre">{c.memo}</dd></>)}
        {!multi && c.signed_at && (<>
          <dt>서명자 IP</dt><dd>{c.signer_ip ?? '-'}</dd>
          <dt>서명 환경</dt><dd className="break small">{c.signer_user_agent ?? '-'}</dd>
          <dt>서명본 SHA-256</dt><dd className="break small"><code data-testid="hash">{c.signed_sha256}</code></dd>
        </>)}
      </dl>

      <div className="row-actions">
        {(multi || status !== 'signed') && <button className="btn act" onClick={() => setExt(true)} data-testid="extend-btn">{status === 'expired' ? '기한 다시 열기' : '기한 변경'}</button>}
        <button className="btn danger act" onClick={() => setDel(true)} data-testid="del-contract"><Icon name="trash" />{multi ? '이 계약과 서명본 전체 삭제' : status === 'signed' ? '서명본·계약 삭제' : '계약 삭제'}</button>
      </div>

      {view && <Modal title={view.title} wide onClose={() => setView(null)}><PdfPages bytes={view.bytes} /></Modal>}
      {ext && (
        <Modal title="링크 기한" onClose={() => setExt(false)}>
          <p className="small muted">지금부터 며칠 동안 열어 둘까요?</p>
          <div className="chips">
            {[1, 3, 7, 14, 30].map((d) => <button key={d} className="chip" onClick={async () => { await extendContract(c.id, d); setExt(false); toast(`${d}일로 바꿨어요`); load() }}>{d}일</button>)}
            <button className="chip" onClick={async () => { await extendContract(c.id, null); setExt(false); toast('기한을 없앴어요'); load() }}>제한 없음</button>
          </div>
        </Modal>
      )}
      {limit !== null && (
        <Modal title="최대 서명 인원" onClose={() => setLimit(null)}>
          <label className="field"><span>인원 (비워 두면 제한 없음)</span>
            <input value={limit} inputMode="numeric" onChange={(e) => setLimit(e.target.value.replace(/\D/g, '').slice(0, 5))} data-testid="limit-input" />
          </label>
          <div className="modal-actions">
            <button className="btn act" onClick={() => setLimit(null)}>취소</button>
            <button className="btn primary act" data-testid="limit-save" onClick={async () => {
              const n = limit.trim() ? Math.max(1, Math.min(10000, Number(limit))) : null
              try { await setMaxSigners(c.id, n); setLimit(null); toast('저장했어요'); load() } catch { toast('저장하지 못했어요') }
            }}>저장</button>
          </div>
        </Modal>
      )}
      {delSigning && (
        <Modal title="서명본 삭제" onClose={() => setDelSigning(null)}>
          <p>「{delSigning.signer_name}」님의 서명본을 삭제할까요?</p>
          <p className="small err">파일이 지워지고 되돌릴 수 없어요. 인원수에서도 빠지고, 그 기기는 다시 서명할 수 있게 돼요.</p>
          <div className="modal-actions">
            <button className="btn act" onClick={() => setDelSigning(null)}>취소</button>
            <button className="btn danger solid act" data-testid="signer-del-confirm" onClick={async () => {
              try { await deleteSigning(delSigning); setDelSigning(null); toast('삭제했어요'); load() } catch { toast('삭제하지 못했어요') }
            }}><Icon name="trash" />삭제</button>
          </div>
        </Modal>
      )}
      {del && (
        <Modal title="계약 삭제" onClose={() => setDel(false)}>
          <p>「{c.title}」 계약을 삭제할까요?</p>
          <p className="small err">{multi ? '모든 사람의 서명본 파일이 함께 지워지고' : '서명된 파일도 함께 지워지고'} 되돌릴 수 없어요. 필요하면 먼저 서명본을 다운로드해 두세요.</p>
          <div className="modal-actions">
            <button className="btn act" onClick={() => setDel(false)}>취소</button>
            <button className="btn danger solid act" data-testid="del-contract-confirm" onClick={async () => {
              try { await deleteContract(c); toast('삭제했어요'); go('/contracts') } catch { toast('삭제하지 못했어요') }
            }}><Icon name="trash" />삭제</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
