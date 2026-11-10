export type FieldType = 'signature' | 'name' | 'date'

/** 서명 칸. x,y,w,h 는 화면에 보이는 페이지 크기에 대한 비율(0~1), 원점은 왼쪽 위. page 는 0부터. */
export interface Field {
  id: string
  type: FieldType
  page: number
  x: number
  y: number
  w: number
  h: number
}

export interface Template {
  id: string
  name: string
  file_path: string
  page_count: number
  size_bytes: number
  created_at: string
}

export type DbStatus = 'sent' | 'viewed' | 'signed'
export type ShownStatus = DbStatus | 'expired' | 'collecting' | 'closed'
export type Mode = 'single' | 'multi'

export interface Contract {
  id: string
  token: string
  title: string
  template_id: string | null
  recipient_name: string
  recipient_phone: string
  memo: string
  status: DbStatus
  fields: Field[]
  original_path: string
  page_count: number
  mode: Mode
  max_signers: number | null
  closed: boolean
  signed_count?: number
  expires_at: string | null
  created_at: string
  viewed_at: string | null
  signed_at: string | null
  signed_path: string | null
  signed_sha256: string | null
  signer_name: string | null
  signer_ip: string | null
  signer_user_agent: string | null
}

export interface Signing {
  id: string
  contract_id: string
  signer_name: string
  signer_phone: string
  state: 'pending' | 'done'
  created_at: string
  signed_at: string | null
  signed_path: string | null
  signed_sha256: string | null
  signer_ip: string | null
  signer_user_agent: string | null
}
