const P: Record<string, string> = {
  download: 'M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  plus: 'M12 5v14M5 12h14',
}
/** 글자와 함께 쓰는 아이콘(장식용) */
export default function Icon({ name }: { name: keyof typeof P }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
