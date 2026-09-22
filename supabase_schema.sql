-- Jalankan SEKALI di Supabase SQL Editor.
-- Schema POS: products, agents, sales, piutang, stok, RLS, dan RPC transaksi.
create extension if not exists pgcrypto;

create table if not exists public.products(
 id uuid primary key default gen_random_uuid(), nama text not null,
 harga_ecer numeric(14,2) not null default 0, harga_reseller numeric(14,2) not null default 0,
 harga_agen numeric(14,2) not null default 0, harga_grosir numeric(14,2) not null default 0,
 stok integer not null default 0 check(stok>=0), kategori text not null default 'Lainnya',
 gambar text, aktif boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.agents(
 id uuid primary key default gen_random_uuid(), nama text not null, hp text, alamat text,
 aktif boolean not null default true, created_at timestamptz not null default now());

create table if not exists public.sales(
 id uuid primary key default gen_random_uuid(), nomor_transaksi text not null unique,
 kasir_id uuid not null references public.users(id), agent_id uuid references public.agents(id),
 subtotal numeric(14,2) not null default 0, diskon numeric(14,2) not null default 0,
 total numeric(14,2) not null default 0, metode_pembayaran text not null check(metode_pembayaran in('tunai','piutang')),
 dibayar numeric(14,2) not null default 0, kembalian numeric(14,2) not null default 0,
 status text not null default 'selesai', created_at timestamptz not null default now());

create table if not exists public.sale_items(
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
 product_id uuid not null references public.products(id), nama_produk text not null, harga numeric(14,2) not null default 0,
 qty integer not null check(qty>0), subtotal numeric(14,2) not null default 0, tipe_harga text not null default 'ecer');

create table if not exists public.receivables(
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
 agent_id uuid not null references public.agents(id), total numeric(14,2) not null default 0,
 dibayar numeric(14,2) not null default 0, sisa numeric(14,2) not null default 0,
 status text not null default 'belum_lunas', jatuh_tempo date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.receivable_payments(
 id uuid primary key default gen_random_uuid(), receivable_id uuid not null references public.receivables(id) on delete cascade,
 kasir_id uuid not null references public.users(id), jumlah numeric(14,2) not null check(jumlah>0),
 keterangan text, created_at timestamptz not null default now());

create table if not exists public.stock_movements(
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), user_id uuid references public.users(id),
 tipe text not null check(tipe in('masuk','keluar','penyesuaian')), qty integer not null,
 stok_sebelum integer, stok_sesudah integer, reference_type text, reference_id uuid, keterangan text,
 created_at timestamptz not null default now());

-- Buat profile public.users otomatis ketika akun Auth dibuat.
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.users(auth_user_id,username,nama,role,aktif)
 values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(coalesce(new.email,''),'@',1)),coalesce(new.raw_user_meta_data->>'nama',coalesce(new.email,'')),case when coalesce(new.raw_user_meta_data->>'role','')='admin' then 'admin' else 'karyawan' end,true)
 on conflict(auth_user_id) do nothing; return new;
end;$$;
drop trigger if exists on_auth_user_created_pos on auth.users;
create trigger on_auth_user_created_pos after insert on auth.users for each row execute procedure public.handle_new_auth_user();

create schema if not exists private;
create or replace function private.is_admin() returns boolean language sql security definer set search_path='' stable as $$
 select exists(select 1 from public.users u where u.auth_user_id=(select auth.uid()) and u.aktif=true and u.role='admin');
$$;
revoke all on function private.is_admin() from public; grant usage on schema private to authenticated; grant execute on function private.is_admin() to authenticated;

alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.agents enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.receivables enable row level security;
alter table public.receivable_payments enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists users_self_or_admin on public.users;
create policy users_self_or_admin on public.users for select to authenticated using(auth_user_id=(select auth.uid()) or (select private.is_admin()));
drop policy if exists users_admin_update on public.users;
create policy users_admin_update on public.users for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));

drop policy if exists products_read on public.products; create policy products_read on public.products for select to authenticated using(true);
drop policy if exists products_admin_insert on public.products; create policy products_admin_insert on public.products for insert to authenticated with check((select private.is_admin()));
drop policy if exists products_admin_update on public.products; create policy products_admin_update on public.products for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
drop policy if exists products_admin_delete on public.products; create policy products_admin_delete on public.products for delete to authenticated using((select private.is_admin()));

drop policy if exists agents_read on public.agents; create policy agents_read on public.agents for select to authenticated using(true);
drop policy if exists agents_admin_insert on public.agents; create policy agents_admin_insert on public.agents for insert to authenticated with check((select private.is_admin()));
drop policy if exists agents_admin_update on public.agents; create policy agents_admin_update on public.agents for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
drop policy if exists agents_admin_delete on public.agents; create policy agents_admin_delete on public.agents for delete to authenticated using((select private.is_admin()));

drop policy if exists sales_read on public.sales; create policy sales_read on public.sales for select to authenticated using(true);
drop policy if exists sale_items_read on public.sale_items; create policy sale_items_read on public.sale_items for select to authenticated using(true);
drop policy if exists receivables_read on public.receivables; create policy receivables_read on public.receivables for select to authenticated using(true);
drop policy if exists receivable_payments_read on public.receivable_payments; create policy receivable_payments_read on public.receivable_payments for select to authenticated using(true);
drop policy if exists stock_movements_read on public.stock_movements; create policy stock_movements_read on public.stock_movements for select to authenticated using(true);

revoke all on public.products,public.agents,public.sales,public.sale_items,public.receivables,public.receivable_payments,public.stock_movements from anon;
grant select,insert,update,delete on public.products,public.agents to authenticated;
grant select on public.sales,public.sale_items,public.receivables,public.receivable_payments,public.stock_movements to authenticated;
grant select,update on public.users to authenticated;

-- Checkout atomik: stok dan transaksi berubah dalam satu database transaction.
create or replace function public.create_sale(p_kasir_id uuid,p_agent_id uuid,p_metode text,p_dibayar numeric,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.users%rowtype; v_product public.products%rowtype; v_sale uuid; v_no text; v_item jsonb; v_qty int; v_type text; v_price numeric; v_sub numeric:=0; v_total numeric:=0; v_change numeric:=0; v_sisa numeric:=0;
begin
 select * into v_user from public.users where auth_user_id=auth.uid() and aktif=true limit 1;
 if v_user.id is null or v_user.id<>p_kasir_id then raise exception 'Kasir tidak valid'; end if;
 if p_metode not in('tunai','piutang') then raise exception 'Metode tidak valid'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Keranjang kosong'; end if;
 v_no:='TRX-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.sales(nomor_transaksi,kasir_id,agent_id,metode_pembayaran,dibayar) values(v_no,p_kasir_id,p_agent_id,p_metode,greatest(coalesce(p_dibayar,0),0)) returning id into v_sale;
 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty:=coalesce((v_item->>'qty')::int,0); if v_qty<=0 then raise exception 'Qty tidak valid'; end if;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and aktif=true for update;
  if v_product.id is null then raise exception 'Produk tidak ditemukan'; end if;
  if v_product.stok<v_qty then raise exception 'Stok % tidak cukup. Tersedia %',v_product.nama,v_product.stok; end if;
  v_type:=lower(coalesce(v_item->>'tipe_harga','ecer'));
  v_price:=case v_type when 'reseller' then v_product.harga_reseller when 'agen' then v_product.harga_agen when 'grosir' then v_product.harga_grosir else v_product.harga_ecer end;
  v_sub:=v_price*v_qty; v_total:=v_total+v_sub;
  insert into public.sale_items(sale_id,product_id,nama_produk,harga,qty,subtotal,tipe_harga) values(v_sale,v_product.id,v_product.nama,v_price,v_qty,v_sub,v_type);
  update public.products set stok=stok-v_qty,updated_at=now() where id=v_product.id;
  insert into public.stock_movements(product_id,user_id,tipe,qty,stok_sebelum,stok_sesudah,reference_type,reference_id,keterangan) values(v_product.id,p_kasir_id,'keluar',v_qty,v_product.stok,v_product.stok-v_qty,'sale',v_sale,'Penjualan '||v_no);
 end loop;
 if p_metode='tunai' then if coalesce(p_dibayar,0)<v_total then raise exception 'Uang tunai kurang. Total %',v_total; end if; v_change:=p_dibayar-v_total;
 else if p_agent_id is null then raise exception 'Pilih agen untuk piutang'; end if; v_sisa:=greatest(v_total-greatest(coalesce(p_dibayar,0),0),0); insert into public.receivables(sale_id,agent_id,total,dibayar,sisa,status,jatuh_tempo) values(v_sale,p_agent_id,v_total,greatest(coalesce(p_dibayar,0),0),v_sisa,case when v_sisa=0 then 'lunas' else 'belum_lunas' end,current_date+30); end if;
 update public.sales set subtotal=v_total,total=v_total,kembalian=v_change where id=v_sale;
 return jsonb_build_object('sale_id',v_sale,'nomor_transaksi',v_no,'total',v_total,'kembalian',v_change);
end;$$;
revoke all on function public.create_sale(uuid,uuid,text,numeric,jsonb) from public,anon; grant execute on function public.create_sale(uuid,uuid,text,numeric,jsonb) to authenticated;

create or replace function public.pay_receivable(p_receivable_id uuid,p_kasir_id uuid,p_jumlah numeric,p_keterangan text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.users%rowtype; v_rec public.receivables%rowtype; v_bayar numeric; v_sisa numeric;
begin
 select * into v_user from public.users where auth_user_id=auth.uid() and aktif=true limit 1; if v_user.id is null or v_user.id<>p_kasir_id then raise exception 'Kasir tidak valid'; end if;
 select * into v_rec from public.receivables where id=p_receivable_id for update; if v_rec.id is null then raise exception 'Piutang tidak ditemukan'; end if;
 v_bayar:=least(greatest(p_jumlah,0),v_rec.sisa); if v_bayar<=0 then raise exception 'Jumlah pembayaran tidak valid'; end if; v_sisa:=v_rec.sisa-v_bayar;
 insert into public.receivable_payments(receivable_id,kasir_id,jumlah,keterangan) values(p_receivable_id,p_kasir_id,v_bayar,p_keterangan);
 update public.receivables set dibayar=dibayar+v_bayar,sisa=v_sisa,status=case when v_sisa=0 then 'lunas' else 'belum_lunas' end,updated_at=now() where id=p_receivable_id;
 return jsonb_build_object('dibayar',v_bayar,'sisa',v_sisa);
end;$$;
revoke all on function public.pay_receivable(uuid,uuid,numeric,text) from public,anon; grant execute on function public.pay_receivable(uuid,uuid,numeric,text) to authenticated;

insert into public.products(nama,harga_ecer,harga_reseller,harga_agen,harga_grosir,stok,kategori) values('Agarillus Proren Kapsul',150000,135000,120000,100000,50,'Kapsul') on conflict do nothing;
insert into public.products(nama,harga_ecer,harga_reseller,harga_agen,harga_grosir,stok,kategori) values('Agarillus Celte',200000,180000,165000,150000,35,'Cair') on conflict do nothing;
