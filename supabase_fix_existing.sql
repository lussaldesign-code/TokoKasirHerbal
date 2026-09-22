-- TokoKasirHerbal: post-deploy fix for an existing Supabase database.
-- Run this AFTER supabase_schema.sql in Supabase SQL Editor.
-- It is intentionally idempotent.

create extension if not exists pgcrypto;

-- Ensure an Auth user gets a public.users profile automatically.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nama text;
begin
  v_nama := coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Pengguna'
  );

  insert into public.users(auth_user_id,nama,role,aktif)
  values(new.id,v_nama,'karyawan',true)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public,anon,authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Keep the schema's critical policies exactly as intended, even if an older
-- deployment left stale policies behind.
drop policy if exists users_read on public.users;
drop policy if exists users_admin_update on public.users;
create policy users_read on public.users
  for select to authenticated
  using ((select public.my_user_id()) is not null);
create policy users_admin_update on public.users
  for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

-- Make sure client roles cannot bypass the policy layer.
revoke all on table public.users from anon;
revoke all on table public.users from authenticated;
grant select,update on table public.users to authenticated;

-- Explicitly remove anonymous access to business data.
revoke all on table public.products, public.agents, public.sales,
  public.sale_items, public.receivables, public.receivable_payments,
  public.stock_movements from anon;

-- Verification queries. Run them separately if you want to inspect the result.
-- 1) Current profiles:
-- select id,auth_user_id,nama,username,role,aktif from public.users order by nama;
-- 2) Policies:
-- select schemaname,tablename,policyname,cmd,roles,qual,with_check
-- from pg_policies
-- where schemaname='public'
-- order by tablename,policyname;
-- 3) Grants:
-- select grantee,table_name,privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public'
-- and table_name in ('users','products','agents')
-- order by table_name,grantee,privilege_type;
