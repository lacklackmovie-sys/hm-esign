import { useEffect, useMemo, useState } from 'react'
import PdfPages from '../components/PdfPages'
import SignaturePad from '../components/SignaturePad'
import { fetchBytes, openContract, submitSigned, type OpenResult, type SignOk } from '../lib/signerApi'
import { stampSignedPdf } from '../lib/stamp'
import { renderTextImage } from '../lib/textImage'
import { fmtDateKo, fmtKST, isKakaoUA, isValidToken } from '../lib/util'
import type { Field } from '../lib/types'
import Logo from '../components/Logo'

type Phase = 'loading' | 'error' | 'ready' | 'working' | 'done'

export default function Signer({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [info, setInfo] = useState<OpenResult | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [agree, setAgree] = useState(false)
  const [name, setName] = useState('')
  const [sig, setSig] = useState<{ png: Uint8Array; url: string } | null>(null)
  const [padOpen, setPadOpen] = useState(false)
  const [done, setDone] = useState<SignOk | null>(null)
  const [err, setErr] = useState('')
  const [kakaoHint, setKakaoHint] = useState(() => isKakaoUA(navigator.userAgent))
  const [today] = useState(() => new Date())

  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!isValidToken(token)) { setInfo({ status: 'not_found' }); setPhase('ready'); return }
      try {
        const r = await openContract(token)
        if (dead) return
        setInfo(r)
        if (r.status === 'open') setBytes(await fetchBytes(r.original_url))
        if (!dead) setPhase('ready')
      } catch {
        if (!dead) { setErr('계약서를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.'); setPhase('error') }
      }
    })()
    return () => { dead = true }
  }, [token])

  const open = info?.status === 'open' ? info : null
  const fields: Field[] = open?.fields ?? []
  const hasBoxes = fields.some((f) => f.type === 'signature')
  const trimmed = name.trim()
  const canSubmit = !!open && agree && trimmed.length > 0 && !!sig

  const missing = useMemo(() => {
    const m: string[] = []
    if (!agree) m.push('내용 확인에 동의해 주세요')
    if (!trimmed) m.push('이름을 입력해 주세요')
    if (!sig) m.push('서명을 해 주세요')
    return m
  }, [agree, trimmed, sig])

  async function submit() {
    if (!open || !bytes || !sig || !canSubmit) return
    setPhase('working')
    setErr('')
    try {
      const res = await stampSignedPdf({
        original: bytes,
        fields,
        signaturePng: sig.png,
        signerName: trimmed,
        signedAt: new Date(),
        contractId: open.contract_id,
        title: open.title,
        recipientName: open.recipient_name,
        ip: open.client_ip,
        userAgent: navigator.userAgent,
        renderText: renderTextImage,
      })
      const ok = await submitSigned(token, trimmed, res.pdf)
      setDone(ok)
      setPhase('done')
    } catch (e) {
      const code = (e as Error).message
      if (code === 'already_signed') setErr('이미 서명이 끝난 계약서예요.')
      else if (code === 'expired') setErr('서명 기한이 지났어요. 보낸 분께 새 링크를 요청해 주세요.')
      else setErr('제출하지 못했어요. 잠시 뒤에 다시 눌러 주세요.')
      setPhase('ready')
    }
  }

  if (phase === 'loading') return <Shell><p className="muted center pad" data-testid="signer-loading">계약서를 불러오는 중…</p></Shell>
  if (phase === 'error') return <Shell><Notice title="불러오기 실패" body={err} /></Shell>
  if (info?.status === 'not_found') return <Shell><Notice title="링크가 올바르지 않아요" body="보내 드린 링크를 그대로 다시 열어 주세요. 계속 안 되면 보낸 분께 새 링크를 요청해 주세요." /></Shell>
  if (info?.status === 'expired') return <Shell><Notice title="서명 기한이 지났어요" body={`「${info.title}」 계약서의 서명 기한이 끝났어요. 보낸 분께 새 링크를 요청해 주세요.`} /></Shell>
  if (info?.status === 'signed') return <Shell><Notice icon="✓" title="이미 서명이 완료된 계약서예요" body={`「${info.title}」 계약서는 ${fmtKST(info.signed_at)}에 서명이 끝났어요. 다시 서명할 수 없어요.`} testid="signer-already" /></Shell>

  if (phase === 'done' && done) {
    return (
      <Shell>
        <div className="done" data-testid="signer-done">
          <div className="done-mark">✓</div>
          <h1>서명이 완료되었어요</h1>
          <p className="muted">「{open?.title}」 계약서에 서명했어요.<br />서명 일시 {fmtKST(done.signed_at)} (한국 시간)</p>
          {done.download_url && (
            <a className="btn primary big" href={done.download_url} data-testid="dl-copy">내 사본(PDF) 받기</a>
          )}
          <p className="small muted">사본 받기 링크는 10분 동안만 열려 있어요. 이 화면을 닫으면 다시 서명할 수 없어요.</p>
          <p className="small muted break">문서 확인 코드(SHA-256)<br /><code>{done.sha256}</code></p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {kakaoHint && (
        <div className="hint">
          카카오톡 안에서 열렸어요. 화면이 불편하면 오른쪽 아래 <b>⋯</b> → <b>다른 브라우저로 열기</b>를 눌러 주세요.
          <button className="x" onClick={() => setKakaoHint(false)} aria-label="닫기">×</button>
        </div>
      )}
      <div className="s-intro">
        <p className="eyebrow">서명 요청</p>
        <h1 data-testid="signer-title">{open?.title}</h1>
        <p className="muted">{open?.recipient_name}님께 요청된 계약서예요. 내용을 끝까지 읽고 아래에서 서명해 주세요.</p>
        {open?.expires_at && <p className="small muted">서명 기한 {fmtKST(open.expires_at)}</p>}
        <p className="small muted">두 손가락으로 벌리면 크게 볼 수 있어요.</p>
      </div>

      {bytes && (
        <PdfPages
          bytes={bytes}
          overlay={(pi) => fields.filter((f) => f.page === pi).map((f) => (
            <FieldMark key={f.id} f={f} sigUrl={sig?.url} name={trimmed} dateText={fmtDateKo(today)} onTap={() => f.type === 'signature' && setPadOpen(true)} />
          ))}
        />
      )}

      <section className="sign-panel" data-testid="sign-panel">
        <h2>서명하기</h2>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-testid="agree" />
          <span>위 계약서 내용을 모두 읽었고, 내용에 동의합니다.</span>
        </label>
        <label className="field">
          <span>이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="본인 이름을 입력하세요" maxLength={60} autoComplete="name" data-testid="signer-name" />
        </label>
        <div className="field">
          <span>서명</span>
          <button className={`sig-box ${sig ? 'has' : ''}`} onClick={() => setPadOpen(true)} data-testid="open-pad">
            {sig ? <img src={sig.url} alt="내 서명" /> : <em>눌러서 손가락으로 서명하기</em>}
          </button>
          {sig && <button className="link" onClick={() => setPadOpen(true)}>다시 서명하기</button>}
        </div>
        {!hasBoxes && <p className="small muted">이 계약서는 서명 위치가 따로 지정되지 않아, 마지막에 붙는 ‘전자서명 확인서’ 페이지에 서명이 들어가요.</p>}
        {err && <p className="err" data-testid="signer-err">{err}</p>}
        <button className="btn primary big" disabled={!canSubmit || phase === 'working'} onClick={submit} data-testid="submit-sign">
          {phase === 'working' ? '서명 문서를 만드는 중…' : '서명 완료하고 제출하기'}
        </button>
        {!canSubmit && phase !== 'working' && <p className="small muted center">{missing.join(' · ')}</p>}
      </section>

      {padOpen && <SignaturePad onCancel={() => setPadOpen(false)} onDone={(png, url) => { setSig({ png, url }); setPadOpen(false) }} />}
    </Shell>
  )
}

function FieldMark({ f, sigUrl, name, dateText, onTap }: { f: Field; sigUrl?: string; name: string; dateText: string; onTap: () => void }) {
  const style = { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }
  const label = f.type === 'signature' ? '여기에 서명' : f.type === 'name' ? '이름' : '날짜'
  const filled = f.type === 'signature' ? !!sigUrl : f.type === 'name' ? !!name : true
  return (
    <button className={`mark ${filled ? 'filled' : ''}`} style={style} onClick={onTap} data-field={f.type} tabIndex={f.type === 'signature' ? 0 : -1}>
      {f.type === 'signature' && sigUrl && <img src={sigUrl} alt="" />}
      {f.type === 'name' && (name ? <span className="mt">{name}</span> : <em>{label}</em>)}
      {f.type === 'date' && <span className="mt">{dateText}</span>}
      {f.type === 'signature' && !sigUrl && <em>{label}</em>}
    </button>
  )
}

function Notice({ title, body, icon, testid }: { title: string; body: string; icon?: string; testid?: string }) {
  return (
    <div className="notice" data-testid={testid ?? 'signer-notice'}>
      {icon && <div className="done-mark">{icon}</div>}
      <h1>{title}</h1>
      <p className="muted">{body}</p>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="signer">
      <header className="s-head"><Logo /><span>전자계약 서명</span></header>
      <main>{children}</main>
      <footer className="s-foot">허니미디어 HONEY MEDIA · 간편 전자서명 (공인전자서명 아님)</footer>
    </div>
  )
}
