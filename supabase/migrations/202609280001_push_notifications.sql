create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  platform text not null default 'android' check (platform = 'android'),
  username text,
  auth_user_id uuid,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_enabled_idx on public.push_devices (enabled) where enabled = true;
create index if not exists push_devices_username_idx on public.push_devices (username);

alter table public.push_devices enable row level security;

drop policy if exists push_devices_no_public_select on public.push_devices;
drop policy if exists push_devices_no_public_update on public.push_devices;
drop policy if exists push_devices_no_public_delete on public.push_devices;
drop policy if exists push_devices_no_public_insert on public.push_devices;

create policy push_devices_no_public_select on public.push_devices for select to anon, authenticated using (false);
create policy push_devices_no_public_update on public.push_devices for update to anon, authenticated using (false) with check (false);
create policy push_devices_no_public_delete on public.push_devices for delete to anon, authenticated using (false);
create policy push_devices_no_public_insert on public.push_devices for insert to anon, authenticated with check (false);

create or replace function public.push_device_register(
  p_token text,
  p_username text default null,
  p_auth_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_token), '') = '' then
    raise exception 'Push token wajib diisi';
  end if;
  insert into public.push_devices(token, username, auth_user_id, enabled, last_seen_at, updated_at)
  values (trim(p_token), nullif(trim(p_username), ''), p_auth_user_id, true, now(), now())
  on conflict (token) do update set
    username = excluded.username,
    auth_user_id = excluded.auth_user_id,
    enabled = true,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.push_device_register(text, text, uuid) from public;
grant execute on function public.push_device_register(text, text, uuid) to anon, authenticated;

create or replace function public.push_device_disable(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_devices
  set enabled = false, updated_at = now()
  where token = trim(p_token);
end;
$$;

revoke all on function public.push_device_disable(text) from public;
grant execute on function public.push_device_disable(text) to anon, authenticated;
