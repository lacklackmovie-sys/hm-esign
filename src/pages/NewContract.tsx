import { useEffect, useMemo, useState } from 'react'
import FieldLayer from '../components/FieldEditor'
import PdfPages from '../components/PdfPages'
import { toast } from '../components/Toast'
import { createContract, downloadBytes, listTemplates } from '../lib/admin'
import { go } from '../lib/hooks'
import type { Field, FieldType, Mode, Template } from '../lib/types'
import { FIELD_DEFAULTS, newField } from '../lib/util'

export default function NewContract({ templateId }: { templateId: string | null }) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [tid, setTid] = useState<string | null>(templateId)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [title, setTitle] = useState('')
  const [rname, setRname] = useState('')
  const [phone, setPhone] = useState('')
  const [memo, setMemo] = useState('')
  const [mode, setMode] = useState<Mode>('single')
  const [maxSigners, setMaxSigners] = useState('')
  const [days, setDays] = useState<string>('7')
  const [fields, setFields] = useState<Field[]>([])
  const [tool, setTool] = useState<FieldType | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const tpl = useMemo(() => templates?.find((t) => t.id === tid) ?? null, [templates, tid])

  useEffect(() => { listTemplates().then(setTemplates).catch(() => setErr('양식 목록을 불러오지 못했어요.')) }, [])
  useEffect(() => {
    setBytes(null)
    setFields([])
    if (!tpl) return
    setTitle((t) => t || tpl.name)
    downloadBytes(tpl.file_path).then(setBytes).catch(() => setErr('양식 파일을 불러오지 못했어요.'))
  }, [tpl?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sigCount = fields.filter((f) => f.type === 'signature').length

  async function create() {
    if (!tpl) return
    setBusy(true)
    setErr('')
    try {
      const c = await createContract({
        template: tpl, title: title || tpl.name, recipient_name: mode === 'multi' ? '다중 서명' : rname, recipient_phone: mode === 'multi' ? '' : phone, memo, fields,
        expiresInDays: days === 'none' ? null : Number(days),
        mode, maxSigners: mode === 'multi' && maxSigners.trim() ? Math.max(1, Math.min(10000, Math.floor(Number(maxSigners)) || 1)) : null,
      })
      toast('계약서를 만들었어요')
      go(`/contracts/${c.id}?new=1`)
    } catch (e) {
      setErr((e as Error).message || '만들지 못했어요.')
      setBusy(false)
    }
  }

  if (templates && templates.length === 0) {
    return <section><h1>새 계약 만들기</h1><div className="empty"><p>먼저 계약서 양식을 올려 주세요.</p><button className="btn primary" onClick={() => go('/templates')}>양식 올리러 가기</button></div></section>
  }

  return (
    <section>
      <h1>새 계약 만들기</h1>
      <div className="modes" role="radiogroup" aria-label="보내는 방식" data-testid="mode-toggle">
        <button role="radio" aria-checked={mode === 'single'} className={`mode ${mode === 'single' ? 'on' : ''}`} onClick={() => setMode('single')} data-testid="mode-single">
          <b>싱글 모드</b><span className="tag">1:1</span>
          <small>한 사람에게 링크 하나. 한 번 서명하면 잠겨요.</small>
        </button>
        <button role="radio" aria-checked={mode === 'multi'} className={`mode ${mode === 'multi' ? 'on' : ''}`} onClick={() => setMode('multi')} data-testid="mode-multi">
          <b>다중 모드</b><span className="tag">여러 명</span>
          <small>링크 하나를 여러 명이 열어 각자 이름 쓰고 서명해요.</small>
        </button>
      </div>
      <div className="form">
        <label className="field"><span>1. 계약서 양식</span>
          <select value={tid ?? ''} onChange={(e) => { setTid(e.target.value || null); setTitle('') }} data-testid="tpl-select">
            <option value="">양식을 고르세요</option>
            {templates?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.page_count}쪽)</option>)}
          </select>
        </label>
        <label className="field"><span>2. 계약명 (서명하는 분에게도 보여요)</span>
          <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} data-testid="c-title" />
        </label>
        {mode === 'single' ? (
          <>
            <label className="field"><span>3. 받는 사람 이름 *</span>
              <input value={rname} maxLength={80} onChange={(e) => setRname(e.target.value)} placeholder="예) 홍길동" data-testid="c-name" />
            </label>
            <label className="field"><span>연락처 (선택, 관리용 메모)</span>
              <input value={phone} maxLength={40} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" data-testid="c-phone" />
            </label>
          </>
        ) : (
          <label className="field"><span>3. 최대 서명 인원 (선택)</span>
            <input value={maxSigners} inputMode="numeric" onChange={(e) => setMaxSigners(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="비워 두면 제한 없음" data-testid="c-max" />
            <small className="muted">서명하는 사람이 각자 이름과 연락처(선택)를 직접 입력해요. 정원이 차면 자동으로 마감돼요.</small>
          </label>
        )}
        <label className="field"><span>메모 (선택, 나만 봐요)</span>
          <textarea value={memo} maxLength={1000} rows={2} onChange={(e) => setMemo(e.target.value)} data-testid="c-memo" />
        </label>
        <label className="field"><span>링크 유효기간</span>
          <select value={days} onChange={(e) => setDays(e.target.value)} data-testid="c-days">
            <option value="1">1일</option><option value="3">3일</option><option value="7">7일</option>
            <option value="14">14일</option><option value="30">30일</option><option value="none">제한 없음</option>
          </select>
        </label>
      </div>

      {tpl && (
        <div className="editor">
          <h2>4. 서명 위치 정하기 <small>(선택)</small></h2>
          <p className="small muted">
            아래 버튼으로 종류를 고른 뒤 문서를 탭하면 칸이 생겨요. 칸을 끌어서 옮기고, 오른쪽 아래 점으로 크기를 바꿔요.
            {' '}서명 칸을 안 만들면 마지막에 붙는 ‘전자서명 확인서’ 페이지에 서명이 들어가요.
          </p>
          <div className="toolbar" role="toolbar">
            {(['signature', 'name', 'date'] as FieldType[]).map((t) => (
              <button key={t} className={`chip ${tool === t ? 'on' : ''}`} onClick={() => { setTool(tool === t ? null : t); setSelected(null) }} data-testid={`tool-${t}`}>
                {FIELD_DEFAULTS[t].label} 칸 추가
              </button>
            ))}
          </div>
          {tool && <p className="banner" data-testid="tool-banner">문서에서 {FIELD_DEFAULTS[tool].label} 칸을 놓을 곳을 탭하세요</p>}
          <p className="small">서명 칸 {sigCount}개 · 이름 칸 {fields.filter((f) => f.type === 'name').length}개 · 날짜 칸 {fields.filter((f) => f.type === 'date').length}개</p>
          {bytes ? (
            <PdfPages
              bytes={bytes}
              className={tool ? 'placing' : ''}
              onPageClick={(page, x, y, aspect) => {
                if (!tool) { setSelected(null); return }
                const f = newField(tool, page, x, y, aspect)
                setFields((fs) => [...fs, f])
                setSelected(f.id)
                setTool(null)
              }}
              overlay={(pi) => (
                <FieldLayer page={pi} fields={fields} selected={selected} onSelect={setSelected}
                  onChange={(nf) => setFields((fs) => fs.map((f) => (f.id === nf.id ? nf : f)))}
                  onDelete={(id) => { setFields((fs) => fs.filter((f) => f.id !== id)); setSelected(null) }} />
              )}
            />
          ) : <p className="muted pad center">문서를 불러오는 중…</p>}
        </div>
      )}

      {err && <p className="err" data-testid="new-err">{err}</p>}
      <div className="sticky-cta">
        <button className="btn primary big" disabled={!tpl || (mode === 'single' && !rname.trim()) || !title.trim() || busy} onClick={create} data-testid="create-contract">
          {busy ? '만드는 중…' : '계약서 만들고 링크 받기'}
        </button>
      </div>
    </section>
  )
}
