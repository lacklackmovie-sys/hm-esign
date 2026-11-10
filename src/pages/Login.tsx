import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login({ notAdmin }: { notAdmin?: boolean }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) setErr('이메일 또는 비밀번호가 맞지 않아요.')
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo"><Logo size={96} /></div>
        <h1>전자계약 관리자</h1>
        <p className="muted">허니미디어 관리자만 들어올 수 있어요.</p>
        {notAdmin && (
          <div className="err box">
            이 계정은 전자계약 관리자 권한이 없어요.
            <button className="link" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          </div>
        )}
        <form onSubmit={submit}>
          <label className="field"><span>이메일</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required data-testid="login-email" />
          </label>
          <label className="field"><span>비밀번호</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required data-testid="login-pw" />
          </label>
          {err && <p className="err" data-testid="login-err">{err}</p>}
          <button className="btn primary big" disabled={busy} data-testid="login-submit">{busy ? '로그인 중…' : '로그인'}</button>
        </form>
      </div>
    </div>
  )
}
