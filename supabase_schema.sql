-- TokoKasirHerbal / Supabase schema
-- Safe schema + authorization baseline.
-- Jalankan di Supabase SQL Editor. Bagian CREATE/ALTER memakai IF NOT EXISTS
-- agar aman dipakai pada database yang sudah berisi data.

create extension if not exists pgcrypto;

-- ================================================================
-- USER PROFILE / AUTH LINK
-- ================================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  nama text not null default 'Pengguna',
  username text unique,
  role text not null default 'karyawan' check (role in ('admin','karyawan')),
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists auth_user_id uuid;
alter table public.users add column if not exists nama text;
alter table public.users add column if not exists username text;
alter table public.users add column if not exists role text;
alter table public.users add column if not exists aktif boolean;
alter table public.users add column if not exists created_at timestamptz;
alter table public.users add column if not exists updated_at timestamptz;

update public.users set nama='Pengguna' where nama is null;
update public.users set role='karyawan' where role is null or role not in ('admin','karyawan');
update public.users set aktif=true where aktif is null;
update public.users set created_at=now() where created_at is null;
update public.users set updated_at=now() where updated_at is null;

alter table public.users alter column nama set default 'Pengguna';
alter table public.users alter column nama set not null;
alter table public.users alter column role set default 'karyawan';
alter table public.users alter column role set not null;
alter table public.users alter column aktif set default true;
alter table public.users alter column aktif set not null;
alter table public.users alter column created_at set default now();
alter table public.users alter column created_at set not null;
alter table public.users alter column updated_at set default now();
alter table public.users alter column updated_at set not null;

create unique index if not exists users_auth_user_id_uidx on public.users(auth_user_id);
create unique index if not exists users_username_uidx on public.users(username) where username is not null;
create index if not exists users_auth_user_id_idx on public.users(auth_user_id);
create index if not exists users_role_aktif_idx on public.users(role,aktif);

-- ================================================================
-- BUSINESS TABLES
-- ================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  harga_ecer numeric(14,2) not null default 0,
  harga_reseller numeric(14,2) not null default 0,
  harga_agen numeric(14,2) not null default 0,
  harga_grosir numeric(14,2) not null default 0,
  stok integer not null default 0 check (stok >= 0),
  kategori text not null default 'Lainnya',
  gambar text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  hp text,
  alamat text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  nomor_transaksi text not null unique,
  kasir_id uuid not null references public.users(id),
  agent_id uuid references public.agents(id),
  subtotal numeric(14,2) not null default 0,
  diskon numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  metode_pembayaran text not null check (metode_pembayaran in ('tunai','piutang')),
  dibayar numeric(14,2) not null default 0,
  kembalian numeric(14,2) not null default 0,
  status text not null default 'selesai',
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  nama_produk text not null,
  harga numeric(14,2) not null default 0,
  qty integer not null check (qty > 0),
  subtotal numeric(14,2) not null default 0,
  tipe_harga text not null default 'ecer'
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  agent_id uuid not null references public.agents(id),
  total numeric(14,2) not null default 0,
  dibayar numeric(14,2) not null default 0,
  sisa numeric(14,2) not null default 0,
  status text not null default 'belum_lunas',
  jatuh_tempo date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  kasir_id uuid not null references public.users(id),
  jumlah numeric(14,2) not null check (jumlah > 0),
  keterangan text,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  user_id uuid references public.users(id),
  tipe text not null check (tipe in ('masuk','keluar','penyesuaian')),
  qty integer not null,
  stok_sebelum integer,
  stok_sesudah integer,
  reference_type text,
  reference_id uuid,
  keterangan text,
  created_at timestamptz not null default now()
);

-- ================================================================
-- RLS + PRIVILEGES
-- ================================================================
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.agents enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.receivables enable row level security;
alter table public.receivable_payments enable row level security;
alter table public.stock_movements enable row level security;

revoke all on table public.users, public.products, public.agents, public.sales,
  public.sale_items, public.receivables, public.receivable_payments,
  public.stock_movements from anon;

revoke all on table public.users, public.products, public.agents, public.sales,
  public.sale_items, public.receivables, public.receivable_payments,
  public.stock_movements from authenticated;

grant select on table public.users to authenticated;
grant select,insert,update,delete on table public.products, public.agents to authenticated;
grant select on table public.sales, public.sale_items, public.receivables,
  public.receivable_payments, public.stock_movements to authenticated;

-- ================================================================
-- ROLE HELPERS
-- ================================================================
create or replace function public.my_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.aktif = true
  limit 1;
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.aktif = true
  limit 1;
$$;

revoke all on function public.my_user_id() from public, anon;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_user_id() to authenticated;
grant execute on function public.my_role() to authenticated;

-- ================================================================
-- CLEAN OLD POLICIES
-- ================================================================
drop policy if exists users_read on public.users;
drop policy if exists users_admin_update on public.users;
drop policy if exists users_admin_insert on public.users;
drop policy if exists users_admin_delete on public.users;

drop policy if exists products_read on public.products;
drop policy if exists products_admin_write on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

drop policy if exists agents_read on public.agents;
drop policy if exists agents_admin_write on public.agents;
drop policy if exists agents_admin_insert on public.agents;
drop policy if exists agents_admin_update on public.agents;
drop policy if exists agents_admin_delete on public.agents;

drop policy if exists sales_read on public.sales;
drop policy if exists sale_items_read on public.sale_items;
drop policy if exists receivables_read on public.receivables;
drop policy if exists receivable_payments_read on public.receivable_payments;
drop policy if exists stock_movements_read on public.stock_movements;

-- ================================================================
-- USERS POLICIES
-- A signed-in user may read profiles so the existing app can load its
-- profile. Only admin may modify roles/active state.
-- ================================================================
create policy users_read on public.users
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy users_admin_update on public.users
  for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

-- No browser INSERT/DELETE on users. User profiles should be provisioned
-- by a trusted backend/admin SQL process and linked to auth.users.

-- ================================================================
-- PRODUCTS
-- ================================================================
create policy products_read on public.products
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy products_admin_insert on public.products
  for insert to authenticated
  with check ((select public.my_role()) = 'admin');

create policy products_admin_update on public.products
  for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

create policy products_admin_delete on public.products
  for delete to authenticated
  using ((select public.my_role()) = 'admin');

-- ================================================================
-- AGENTS
-- ================================================================
create policy agents_read on public.agents
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy agents_admin_insert on public.agents
  for insert to authenticated
  with check ((select public.my_role()) = 'admin');

create policy agents_admin_update on public.agents
  for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

create policy agents_admin_delete on public.agents
  for delete to authenticated
  using ((select public.my_role()) = 'admin');

-- ================================================================
-- READ-ONLY REPORTING TABLES
-- Writes are performed by SECURITY DEFINER checkout/payment functions.
-- ================================================================
create policy sales_read on public.sales
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy sale_items_read on public.sale_items
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy receivables_read on public.receivables
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy receivable_payments_read on public.receivable_payments
  for select to authenticated
  using ((select public.my_user_id()) is not null);

create policy stock_movements_read on public.stock_movements
  for select to authenticated
  using ((select public.my_user_id()) is not null);

-- ================================================================
-- CHECKOUT ATOMIC FUNCTION
-- ================================================================
create or replace function public.create_sale(
  p_kasir_id uuid,
  p_agent_id uuid,
  p_metode text,
  p_dibayar numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
  v_product public.products%rowtype;
  v_sale uuid;
  v_no text;
  v_item jsonb;
  v_qty integer;
  v_type text;
  v_price numeric;
  v_sub numeric := 0;
  v_total numeric := 0;
  v_change numeric := 0;
  v_sisa numeric := 0;
begin
  select * into v_user from public.users
  where auth_user_id = (select auth.uid()) and aktif = true limit 1;

  if v_user.id is null or v_user.id <> p_kasir_id then
    raise exception 'Kasir tidak valid';
  end if;

  if p_metode not in ('tunai','piutang') then
    raise exception 'Metode pembayaran tidak valid';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong';
  end if;

  v_no := 'TRX-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.sales(nomor_transaksi,kasir_id,agent_id,metode_pembayaran,dibayar)
  values(v_no,p_kasir_id,p_agent_id,p_metode,greatest(coalesce(p_dibayar,0),0))
  returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'qty')::integer,0);
    if v_qty <= 0 then raise exception 'Qty tidak valid'; end if;

    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and aktif = true
    for update;

    if v_product.id is null then raise exception 'Produk tidak ditemukan'; end if;
    if v_product.stok < v_qty then
      raise exception 'Stok % tidak cukup. Tersedia %',v_product.nama,v_product.stok;
    end if;

    v_type := lower(coalesce(v_item->>'tipe_harga','ecer'));
    v_price := case v_type
      when 'reseller' then v_product.harga_reseller
      when 'agen' then v_product.harga_agen
      when 'grosir' then v_product.harga_grosir
      else v_product.harga_ecer
    end;

    v_sub := v_price * v_qty;
    v_total := v_total + v_sub;

    insert into public.sale_items(sale_id,product_id,nama_produk,harga,qty,subtotal,tipe_harga)
    values(v_sale,v_product.id,v_product.nama,v_price,v_qty,v_sub,v_type);

    update public.products set stok=stok-v_qty,updated_at=now() where id=v_product.id;

    insert into public.stock_movements(product_id,user_id,tipe,qty,stok_sebelum,stok_sesudah,reference_type,reference_id,keterangan)
    values(v_product.id,p_kasir_id,'keluar',v_qty,v_product.stok,v_product.stok-v_qty,'sale',v_sale,'Penjualan '||v_no);
  end loop;

  if p_metode = 'tunai' then
    if coalesce(p_dibayar,0) < v_total then
      raise exception 'Uang tunai kurang. Total %',v_total;
    end if;
    v_change := p_dibayar - v_total;
  else
    if p_agent_id is null then raise exception 'Pilih agen untuk piutang'; end if;
    if not exists (select 1 from public.agents where id=p_agent_id and aktif=true) then
      raise exception 'Agen tidak ditemukan atau nonaktif';
    end if;
    v_sisa := greatest(v_total-greatest(coalesce(p_dibayar,0),0),0);
    insert into public.receivables(sale_id,agent_id,total,dibayar,sisa,status,jatuh_tempo)
    values(v_sale,p_agent_id,v_total,greatest(coalesce(p_dibayar,0),0),v_sisa,case when v_sisa=0 then 'lunas' else 'belum_lunas' end,current_date+30);
  end if;

  update public.sales set subtotal=v_total,total=v_total,kembalian=v_change where id=v_sale;

  return jsonb_build_object('sale_id',v_sale,'nomor_transaksi',v_no,'total',v_total,'kembalian',v_change);
end;
$$;

revoke all on function public.create_sale(uuid,uuid,text,numeric,jsonb) from public,anon;
grant execute on function public.create_sale(uuid,uuid,text,numeric,jsonb) to authenticated;

-- ================================================================
-- RECEIVABLE PAYMENT
-- ================================================================
create or replace function public.pay_receivable(
  p_receivable_id uuid,
  p_kasir_id uuid,
  p_jumlah numeric,
  p_keterangan text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
  v_rec public.receivables%rowtype;
  v_bayar numeric;
  v_sisa numeric;
begin
  select * into v_user from public.users where auth_user_id=(select auth.uid()) and aktif=true limit 1;
  if v_user.id is null or v_user.id<>p_kasir_id then raise exception 'Kasir tidak valid'; end if;

  select * into v_rec from public.receivables where id=p_receivable_id for update;
  if v_rec.id is null then raise exception 'Piutang tidak ditemukan'; end if;

  v_bayar := least(greatest(coalesce(p_jumlah,0),0),v_rec.sisa);
  if v_bayar <= 0 then raise exception 'Jumlah pembayaran tidak valid'; end if;
  v_sisa := v_rec.sisa-v_bayar;

  insert into public.receivable_payments(receivable_id,kasir_id,jumlah,keterangan)
  values(p_receivable_id,p_kasir_id,v_bayar,p_keterangan);

  update public.receivables
  set dibayar=dibayar+v_bayar,sisa=v_sisa,
      status=case when v_sisa=0 then 'lunas' else 'belum_lunas' end,
      updated_at=now()
  where id=p_receivable_id;

  return jsonb_build_object('dibayar',v_bayar,'sisa',v_sisa);
end;
$$;

revoke all on function public.pay_receivable(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.pay_receivable(uuid,uuid,numeric,text) to authenticated;

-- ================================================================
-- TRIGGER FOR UPDATED_AT
-- ================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public,anon,authenticated;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists receivables_set_updated_at on public.receivables;
create trigger receivables_set_updated_at before update on public.receivables
for each row execute function public.set_updated_at();

-- IMPORTANT:
-- A public.users profile must exist for every Auth account that logs in.
-- Create/link the first admin profile from the Supabase SQL Editor, e.g.:
-- insert into public.users(auth_user_id,nama,username,role,aktif)
-- values ('AUTH-USER-UUID','Nama Admin','admin','admin',true);

-- ================================================================
-- BARANG DIBAWA / STOCK OUT UNTIL COMPLETION
-- ================================================================
create table if not exists public.barang_dibawa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  diambil_oleh text not null,
  status text not null default 'dibawa' check (status in ('dibawa','selesai')),
  catatan text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.barang_dibawa_items (
  id uuid primary key default gen_random_uuid(),
  barang_dibawa_id uuid not null references public.barang_dibawa(id) on delete cascade,
  product_id uuid not null references public.products(id),
  nama_produk text not null,
  qty_dibawa integer not null check (qty_dibawa > 0),
  qty_terjual integer not null default 0 check (qty_terjual >= 0),
  qty_kembali integer not null default 0 check (qty_kembali >= 0),
  harga numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.barang_dibawa enable row level security;
alter table public.barang_dibawa_items enable row level security;
revoke all on table public.barang_dibawa, public.barang_dibawa_items from anon, authenticated;
grant select on table public.barang_dibawa, public.barang_dibawa_items to authenticated;
drop policy if exists barang_dibawa_read on public.barang_dibawa;
drop policy if exists barang_dibawa_items_read on public.barang_dibawa_items;
create policy barang_dibawa_read on public.barang_dibawa for select to authenticated using ((select public.my_user_id()) is not null);
create policy barang_dibawa_items_read on public.barang_dibawa_items for select to authenticated using ((select public.my_user_id()) is not null);

create or replace function public.create_barang_dibawa(p_user_id uuid,p_diambil_oleh text,p_catatan text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.users%rowtype; v_product public.products%rowtype; v_header uuid; v_item jsonb; v_qty integer; v_total integer:=0;
begin
 select * into v_user from public.users where auth_user_id=(select auth.uid()) and aktif=true limit 1;
 if v_user.id is null or v_user.id<>p_user_id then raise exception 'Pengguna tidak valid'; end if;
 if nullif(trim(p_diambil_oleh),'') is null then raise exception 'Nama pengambil wajib diisi'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Barang yang dibawa masih kosong'; end if;
 insert into public.barang_dibawa(user_id,diambil_oleh,catatan) values(p_user_id,trim(p_diambil_oleh),nullif(trim(coalesce(p_catatan,'')),'')) returning id into v_header;
 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty:=coalesce((v_item->>'qty')::integer,0);
  if v_qty<=0 then raise exception 'Qty barang dibawa tidak valid'; end if;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and aktif=true for update;
  if v_product.id is null then raise exception 'Produk tidak ditemukan'; end if;
  if v_product.stok<v_qty then raise exception 'Stok % tidak cukup. Tersedia %',v_product.nama,v_product.stok; end if;
  insert into public.barang_dibawa_items(barang_dibawa_id,product_id,nama_produk,qty_dibawa,harga) values(v_header,v_product.id,v_product.nama,v_qty,v_product.harga_ecer);
  update public.products set stok=stok-v_qty,updated_at=now() where id=v_product.id;
  insert into public.stock_movements(product_id,user_id,tipe,qty,stok_sebelum,stok_sesudah,reference_type,reference_id,keterangan)
  values(v_product.id,p_user_id,'keluar',v_qty,v_product.stok,v_product.stok-v_qty,'barang_dibawa',v_header,'Barang dibawa oleh '||trim(p_diambil_oleh));
  v_total:=v_total+v_qty;
 end loop;
 return jsonb_build_object('id',v_header,'total_qty',v_total);
end; $$;

create or replace function public.complete_barang_dibawa(p_user_id uuid,p_barang_dibawa_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.users%rowtype; v_header public.barang_dibawa%rowtype; v_item public.barang_dibawa_items%rowtype; v_sold integer; v_return integer; v_sale uuid; v_no text; v_total numeric:=0; v_return_total integer:=0; v_sold_total integer:=0; v_remaining integer; v_product public.products%rowtype;
begin
 select * into v_user from public.users where auth_user_id=(select auth.uid()) and aktif=true limit 1;
 if v_user.id is null or v_user.id<>p_user_id then raise exception 'Pengguna tidak valid'; end if;
 select * into v_header from public.barang_dibawa where id=p_barang_dibawa_id for update;
 if v_header.id is null then raise exception 'Data barang dibawa tidak ditemukan'; end if;
 if v_header.status='selesai' then raise exception 'Barang dibawa ini sudah diselesaikan'; end if;
 if jsonb_typeof(p_items)<>'array' then raise exception 'Data penyelesaian tidak valid'; end if;
 for v_item in select * from public.barang_dibawa_items where barang_dibawa_id=p_barang_dibawa_id for update loop
  select coalesce((x->>'qty_terjual')::integer,0),coalesce((x->>'qty_kembali')::integer,0) into v_sold,v_return
  from jsonb_array_elements(p_items) x where (x->>'item_id')::uuid=v_item.id limit 1;
  if v_sold is null then v_sold:=0; end if; if v_return is null then v_return:=0; end if;
  if v_sold<0 or v_return<0 or v_sold+v_return<>v_item.qty_dibawa then raise exception 'Qty % harus memenuhi dibawa = terjual + kembali',v_item.nama_produk; end if;
  update public.barang_dibawa_items set qty_terjual=v_sold,qty_kembali=v_return where id=v_item.id;
  if v_return>0 then
   select * into v_product from public.products where id=v_item.product_id for update;
   if v_product.id is null then raise exception 'Produk % tidak ditemukan',v_item.nama_produk; end if;
   update public.products set stok=stok+v_return,updated_at=now() where id=v_item.product_id;
   insert into public.stock_movements(product_id,user_id,tipe,qty,stok_sebelum,stok_sesudah,reference_type,reference_id,keterangan)
   values(v_item.product_id,p_user_id,'masuk',v_return,v_product.stok,v_product.stok+v_return,'barang_dibawa_kembali',p_barang_dibawa_id,'Pengembalian barang dibawa oleh '||v_header.diambil_oleh);
  end if;
  v_sold_total:=v_sold_total+v_sold; v_return_total:=v_return_total+v_return; v_total:=v_total+(v_sold*v_item.harga);
 end loop;
 select coalesce(sum(qty_dibawa),0)-coalesce(sum(qty_terjual),0)-coalesce(sum(qty_kembali),0) into v_remaining from public.barang_dibawa_items where barang_dibawa_id=p_barang_dibawa_id;
 if v_remaining<>0 then raise exception 'Qty penyelesaian belum lengkap'; end if;
 if v_sold_total>0 then
  v_no:='TRX-BD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.sales(nomor_transaksi,kasir_id,metode_pembayaran,dibayar,kembalian,subtotal,total,status)
  values(v_no,p_user_id,'tunai',v_total,0,v_total,v_total,'selesai') returning id into v_sale;
  for v_item in select * from public.barang_dibawa_items where barang_dibawa_id=p_barang_dibawa_id and qty_terjual>0 loop
   insert into public.sale_items(sale_id,product_id,nama_produk,harga,qty,subtotal,tipe_harga) values(v_sale,v_item.product_id,v_item.nama_produk,v_item.harga,v_item.qty_terjual,v_item.harga*v_item.qty_terjual,'ecer');
  end loop;
 end if;
 update public.barang_dibawa set status='selesai',completed_at=now() where id=p_barang_dibawa_id;
 return jsonb_build_object('sale_id',v_sale,'nomor_transaksi',v_no,'total_terjual',v_sold_total,'total_kembali',v_return_total,'total_penjualan',v_total);
end; $$;
revoke all on function public.create_barang_dibawa(uuid,text,text,jsonb) from public,anon;
revoke all on function public.complete_barang_dibawa(uuid,uuid,jsonb) from public,anon;
grant execute on function public.create_barang_dibawa(uuid,text,text,jsonb) to authenticated;
grant execute on function public.complete_barang_dibawa(uuid,uuid,jsonb) to authenticated;
