import { BASE } from '../lib/config'

export default function Logo() {
  return (
    <span className="logo">
      <img src={`${BASE}mark.svg`} alt="" height={26} />
      <b>HONEY MEDIA</b>
    </span>
  )
}
