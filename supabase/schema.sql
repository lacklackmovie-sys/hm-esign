-- HM 전자계약(esign) 데이터베이스 설정 (hm-agency Supabase 프로젝트에 이미 적용됨, 참고용)
-- 기존 테이블은 건드리지 않고 esign_ 접두사 테이블 + 전용 비공개 버킷 'esign' 만 추가합니다.
-- 관리자 = public.esign_admins 에 등록된 사용자. 서명자는 로그인 없이 엣지 함수(esign)로 토큰으로만 접근합니다.
create schema if not exists esign_private;
revoke all on schema esign_private from public, anon;
grant usage on schema esign_private to authenticated;

create table public.esign_admins (user_id uuid primary key references auth.users(id) on delete cascade, email text not null, created_at timestamptz not null default now());
alter table public.esign_admins enable row level security;
create or replace function esign_private.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.esign_admins where user_id = (select auth.uid())); $$;
revoke all on function esign_private.is_admin() from public, anon;
grant execute on function esign_private.is_admin() to authenticated;
create policy esign_admins_self_read on public.esign_admins for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.esign_admins from anon, authenticated; grant select on public.esign_admins to authenticated;

create table public.esign_templates (id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 120), file_path text not null, page_count int not null check (page_count between 1 and 200), size_bytes bigint not null default 0, created_at timestamptz not null default now());
alter table public.esign_templates enable row level security;
create policy esign_templates_admin on public.esign_templates for all to authenticated using (esign_private.is_admin()) with check (esign_private.is_admin());
revoke all on public.esign_templates from anon, authenticated; grant select, insert, update, delete on public.esign_templates to authenticated;

create table public.esign_contracts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  title text not null check (char_length(title) between 1 and 160),
  template_id uuid references public.esign_templates(id) on delete set null,
  recipient_name text not null check (char_length(recipient_name) between 1 and 80),
  recipient_phone text not null default '', memo text not null default '',
  status text not null default 'sent' check (status in ('sent','viewed','signed')),
  fields jsonb not null default '[]'::jsonb,
  original_path text not null, page_count int not null check (page_count between 1 and 200),
  expires_at timestamptz, created_at timestamptz not null default now(), viewed_at timestamptz, signed_at timestamptz,
  signed_path text, signed_sha256 text, signer_name text, signer_ip text, signer_user_agent text);
alter table public.esign_contracts enable row level security;
create index esign_contracts_template_idx on public.esign_contracts(template_id);
create index esign_contracts_created_idx on public.esign_contracts(created_at desc);
create policy esign_contracts_admin on public.esign_contracts for all to authenticated using (esign_private.is_admin()) with check (esign_private.is_admin());
revoke all on public.esign_contracts from anon, authenticated; grant select, insert, update, delete on public.esign_contracts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('esign', 'esign', false, 26214400, array['application/pdf']) on conflict (id) do nothing;
create policy esign_storage_admin_all on storage.objects for all to authenticated using (bucket_id = 'esign' and esign_private.is_admin()) with check (bucket_id = 'esign' and esign_private.is_admin());
-- 관리자 추가: insert into public.esign_admins (user_id, email) select id, email from auth.users where email = '...';
