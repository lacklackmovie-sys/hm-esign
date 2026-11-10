import { describe, expect, it, vi } from 'vitest'
import { deviceId, FIELD_DEFAULTS, fileBase, fitBox, fmtDateKo, fmtKST, fmtKSTFull, fmtSize, isKakaoUA, isValidToken, newField, shownStatus, sha256Hex } from '../src/lib/util'
import { shareText } from '../src/lib/share'

describe('util', () => {
  it('KST 표시: UTC 05:30 은 한국 14:30', () => {
    expect(fmtKSTFull('2026-11-10T05:30:05Z')).toBe('2026-11-10 14:30:05 KST')
    expect(fmtKST('2026-11-10T05:30:05Z')).toBe('2026.11.10 14:30')
    expect(fmtKST('2026-11-10T15:00:00Z')).toBe('2026.11.11 00:00')
    expect(fmtDateKo('2026-11-10T20:00:00Z')).toBe('2026년 11월 11일')
    expect(fmtKST(null)).toBe('-')
  })
  it('상태: 서명완료가 만료보다 우선, 기한 지난 미서명은 만료', () => {
    const now = Date.parse('2026-11-10T00:00:00Z')
    expect(shownStatus({ status: 'signed', expires_at: '2020-01-01T00:00:00Z' }, now)).toBe('signed')
    expect(shownStatus({ status: 'sent', expires_at: '2026-11-09T00:00:00Z' }, now)).toBe('expired')
    expect(shownStatus({ status: 'viewed', expires_at: '2026-11-11T00:00:00Z' }, now)).toBe('viewed')
    expect(shownStatus({ status: 'sent', expires_at: null }, now)).toBe('sent')
  })
  it('다중 모드 상태: 모집중/마감(수동·정원)/만료', () => {
    const now = Date.parse('2026-11-10T00:00:00Z')
    const base = { status: 'sent' as const, mode: 'multi' as const, expires_at: null, closed: false, max_signers: 3, signed_count: 2 }
    expect(shownStatus(base, now)).toBe('collecting')
    expect(shownStatus({ ...base, signed_count: 3 }, now)).toBe('closed')
    expect(shownStatus({ ...base, closed: true }, now)).toBe('closed')
    expect(shownStatus({ ...base, max_signers: null, signed_count: 999 }, now)).toBe('collecting')
    expect(shownStatus({ ...base, expires_at: '2026-11-09T00:00:00Z' }, now)).toBe('expired')
  })
  it('기기 번호: 저장소에 한 번 만들고 계속 같은 값, 저장소가 막히면 임시 값', () => {
    const mem: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } })
    const a = deviceId()
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(deviceId()).toBe(a)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(deviceId()).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    vi.unstubAllGlobals()
  })
  it('토큰 형식: 64자리 16진수만 허용', () => {
    expect(isValidToken('a'.repeat(64))).toBe(true)
    expect(isValidToken('A'.repeat(64))).toBe(false)
    expect(isValidToken('a'.repeat(63))).toBe(false)
    expect(isValidToken('../etc/passwd')).toBe(false)
  })
  it('칸 만들기: 페이지 밖으로 나가지 않고 크기 비율이 맞다', () => {
    const f = newField('signature', 0, 0.99, 0.99, 595 / 842)
    expect(f.x + f.w).toBeLessThanOrEqual(1.0000001)
    expect(f.y + f.h).toBeLessThanOrEqual(1.0000001)
    const g = newField('name', 1, 0.5, 0.5, 595 / 842)
    expect(g.x).toBeCloseTo(0.5 - FIELD_DEFAULTS.name.wFrac / 2, 5)
    // 폭×비율(pt) 대비 높이: h*842 == w*595*ratio
    expect((g.h * 842) / (g.w * 595)).toBeCloseTo(FIELD_DEFAULTS.name.ratio, 5)
    expect(fitBox(-1, -1, 0.0001, 0.0001)).toMatchObject({ x: 0, y: 0, w: 0.05, h: 0.015 })
  })
  it('기타', () => {
    expect(fmtSize(2048)).toBe('2KB')
    expect(fileBase('계약서 양식.final.pdf')).toBe('계약서 양식.final')
    expect(isKakaoUA('Mozilla/5.0 (iPhone) KAKAOTALK 10.0')).toBe(true)
    expect(isKakaoUA('Mozilla/5.0 Chrome')).toBe(false)
  })
  it('SHA-256', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('공유: share 가 있으면 공유창, 취소는 취소로 구분, 없으면 복사 대체', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    expect(await shareText('t', 'hello')).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'hello' })
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) })
    expect(await shareText('t', 'hello')).toBe('cancelled')
    vi.unstubAllGlobals()
  })
})
