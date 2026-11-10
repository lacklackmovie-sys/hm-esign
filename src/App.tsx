import { lazy, Suspense } from 'react'
import { ToastHost } from './components/Toast'
import Logo from './components/Logo'
import { go, useAuth, useHash } from './lib/hooks'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Signer from './pages/Signer'

const Templates = lazy(() => import('./pages/Templates'))
const Contracts = lazy(() => import('./pages/Contracts'))
const NewContract = lazy(() => import('./pages/NewContract'))
const ContractDetail = lazy(() => import('./pages/ContractDetail'))

export default function App() {
  const hash = useHash()
  const path = hash.replace(/^#/, '') || '/'
  const sm = path.match(/^\/s\/([A-Za-z0-9]+)/)
  if (sm) return <><Signer token={sm[1]} /><ToastHost /></>
  return <><Admin path={path} /><ToastHost /></>
}

function Admin({ path }: { path: string }) {
  const auth = useAuth()
  if (auth.loading) return <p className="muted center pad" data-testid="auth-loading">불러오는 중…</p>
  if (!auth.session) return <Login />
  if (!auth.isAdmin) return <Login notAdmin />

  const [route, query = ''] = path.split('?')
  const q = new URLSearchParams(query)
  const detail = route.match(/^\/contracts\/([0-9a-f-]{36})$/)
  const tab = route.startsWith('/templates') ? 'templates' : 'contracts'

  return (
    <div className="admin">
      <header className="a-head">
        <Logo />
        <span className="a-title">전자계약</span>
        <button className="link light" onClick={() => supabase.auth.signOut()} data-testid="logout">로그아웃</button>
      </header>
      <nav className="tabs" aria-label="메뉴">
        <button className={tab === 'contracts' ? 'on' : ''} onClick={() => go('/contracts')} data-testid="tab-contracts">계약 목록</button>
        <button className={tab === 'templates' ? 'on' : ''} onClick={() => go('/templates')} data-testid="tab-templates">계약서 양식</button>
      </nav>
      <main>
        <Suspense fallback={<p className="muted center pad">불러오는 중…</p>}>
          {route.startsWith('/templates') ? <Templates />
            : route === '/new' ? <NewContract templateId={q.get('template')} />
            : detail ? <ContractDetail id={detail[1]} isNew={q.get('new') === '1'} />
            : <Contracts />}
        </Suspense>
      </main>
    </div>
  )
}
