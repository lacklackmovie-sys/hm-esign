import { BASE } from '../lib/config'

// 허니미디어 민트 로고(벡터). size = 높이(px)
export default function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img className={`logo ${className}`} src={`${BASE}logo.svg`} alt="HONEY MEDIA" height={size} width={Math.round((size * 130) / 194)} data-testid="logo" />
}
