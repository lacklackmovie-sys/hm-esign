import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function useHash(): string {
  const [h, setH] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const f = () => { setH(window.location.hash || '#/'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}

export function go(path: string) {
  window.location.hash = path
}

export type AuthState = { loading: true } | { loading: false; session: Session | null; isAdmin: boolean }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true })
  useEffect(() => {
    let dead = false
    const check = async (session: Session | null) => {
      if (!session) { if (!dead) setState({ loading: false, session: null, isAdmin: false }); return }
      const { data } = await supabase.from('esign_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
      if (!dead) setState({ loading: false, session, isAdmin: !!data })
    }
    supabase.auth.getSession().then(({ data }) => check(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === 'TOKEN_REFRESHED') return
      // onAuthStateChange 안에서 바로 supabase 를 부르면 잠기는 경우가 있어 한 틱 미룬다
      setTimeout(() => check(session), 0)
    })
    return () => { dead = true; sub.subscription.unsubscribe() }
  }, [])
  return state
}
