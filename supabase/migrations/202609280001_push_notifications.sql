create extension if not exists pg_net with schema extensions;

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

alter table public.push_devices add column if not exists platform text not null default 'android';
alter table public.push_devices add column if not exists last_seen_at timestamptz not null default now();
create index if not exists push_devices_enabled_idx on public.push_devices(enabled) where enabled=true;
create index if not exists push_devices_username_idx on public.push_devices(username);

alter table public.push_devices enable row level security;
revoke all on table public.push_devices from anon, authenticated;

create or replace function public.push_device_register(p_token text,p_username text default null,p_auth_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Sesi tidak valid'; end if;
  if coalesce(trim(p_token),'')='' then raise exception 'Push token wajib diisi'; end if;
  if p_auth_user_id is not null and p_auth_user_id<>v_uid then raise exception 'Auth user tidak valid'; end if;
  insert into public.push_devices(token,platform,username,auth_user_id,enabled,last_seen_at,updated_at)
  values(trim(p_token),'android',nullif(trim(coalesce(p_username,'')),''),v_uid,true,now(),now())
  on conflict(token) do update set username=excluded.username,auth_user_id=excluded.auth_user_id,enabled=true,last_seen_at=now(),updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end;
$$;
revoke all on function public.push_device_register(text,text,uuid) from public;
grant execute on function public.push_device_register(text,text,uuid) to authenticated;

create table if not exists public.push_notification_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null check(type in('sale','stock_empty')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.push_notification_queue enable row level security;
revoke all on table public.push_notification_queue from anon,authenticated;
create index if not exists push_notification_queue_status_created_idx on public.push_notification_queue(status,created_at);

create or replace function public.enqueue_push_sale()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid;
begin
  if coalesce(old.total,0)<=0 and coalesce(new.total,0)>0 then
    insert into public.push_notification_queue(type,payload) values('sale',jsonb_build_object('sale_id',new.id,'nomor_transaksi',new.nomor_transaksi,'total',new.total)) returning id into v_id;
    perform net.http_post(url:='https://geoedddgvzvqsykuekdw.supabase.co/functions/v1/send-push-notification',body:=jsonb_build_object('event_id',v_id),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=2000);
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_push_stock_empty()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid;
begin
  if coalesce(old.stok,0)>0 and coalesce(new.stok,0)=0 then
    insert into public.push_notification_queue(type,payload) values('stock_empty',jsonb_build_object('product_id',new.id,'nama_produk',new.nama)) returning id into v_id;
    perform net.http_post(url:='https://geoedddgvzvqsykuekdw.supabase.co/functions/v1/send-push-notification',body:=jsonb_build_object('event_id',v_id),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=2000);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_push_sale on public.sales;
create trigger trg_push_sale after update of total on public.sales for each row execute function public.enqueue_push_sale();
drop trigger if exists trg_push_stock_empty on public.products;
create trigger trg_push_stock_empty after update of stok on public.products for each row execute function public.enqueue_push_stock_empty();
