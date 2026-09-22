-- TokoKasirHerbal: fungsi transaksi atomik untuk Supabase
-- Jalankan sekali di Supabase SQL Editor setelah tabel/RLS V1 sudah ada.
-- Tidak memakai service_role di browser.

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
  v_auth_user uuid := auth.uid();
  v_kasir public.users%rowtype;
  v_sale_id uuid;
  v_invoice text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_kembalian numeric(14,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_harga numeric(14,2);
  v_item_subtotal numeric(14,2);
  v_tipe_harga text;
  v_sisa numeric(14,2);
begin
  if v_auth_user is null then
    raise exception 'Anda belum login';
  end if;

  select * into v_kasir
  from public.users
  where public.users.auth_user_id = v_auth_user
    and public.users.aktif = true
  limit 1;

  if v_kasir.id is null or v_kasir.id <> p_kasir_id then
    raise exception 'Kasir tidak valid';
  end if;

  if p_metode not in ('tunai','piutang') then
    raise exception 'Metode pembayaran tidak valid';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong';
  end if;

  v_invoice := 'TRX-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.sales (nomor_transaksi, kasir_id, agent_id, subtotal, diskon, total, metode_pembayaran, dibayar, kembalian, status)
  values (v_invoice, p_kasir_id, p_agent_id, 0, 0, 0, p_metode, greatest(coalesce(p_dibayar,0),0), 0, 'selesai')
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(coalesce((v_item->>'qty')::integer,0),0);
    if v_qty <= 0 then raise exception 'Qty produk tidak valid'; end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and aktif = true
    for update;

    if v_product.id is null then
      raise exception 'Produk tidak ditemukan atau tidak aktif';
    end if;

    if v_product.stok < v_qty then
      raise exception 'Stok % tidak cukup. Tersedia: %', v_product.nama, v_product.stok;
    end if;

    v_tipe_harga := coalesce(v_item->>'tipe_harga','ecer');
    if v_tipe_harga = 'agen' then
      v_harga := v_product.harga_agen;
    else
      v_harga := v_product.harga_ecer;
      v_tipe_harga := 'ecer';
    end if;

    v_item_subtotal := v_harga * v_qty;
    v_subtotal := v_subtotal + v_item_subtotal;

    insert into public.sale_items (sale_id, product_id, nama_produk, harga, qty, subtotal, tipe_harga)
    values (v_sale_id, v_product.id, v_product.nama, v_harga, v_qty, v_item_subtotal, v_tipe_harga);

    update public.products
    set stok = stok - v_qty, updated_at = now()
    where id = v_product.id;

    insert into public.stock_movements (product_id, user_id, tipe, qty, stok_sebelum, stok_sesudah, reference_type, reference_id, keterangan)
    values (v_product.id, p_kasir_id, 'keluar', v_qty, v_product.stok, v_product.stok - v_qty, 'sale', v_sale_id, 'Penjualan ' || v_invoice);
  end loop;

  v_total := v_subtotal;

  if p_metode = 'tunai' then
    if coalesce(p_dibayar,0) < v_total then
      raise exception 'Uang dibayar kurang. Total: %', v_total;
    end if;
    v_kembalian := p_dibayar - v_total;
  else
    if p_agent_id is null then
      raise exception 'Pilih agen untuk transaksi piutang';
    end if;
    v_sisa := greatest(v_total - greatest(coalesce(p_dibayar,0),0),0);
    insert into public.receivables (sale_id, agent_id, total, dibayar, sisa, status, jatuh_tempo)
    values (v_sale_id, p_agent_id, v_total, greatest(coalesce(p_dibayar,0),0), v_sisa, case when v_sisa <= 0 then 'lunas' else 'belum_lunas' end, current_date + 30);
  end if;

  update public.sales
  set subtotal = v_subtotal,
      diskon = 0,
      total = v_total,
      dibayar = greatest(coalesce(p_dibayar,0),0),
      kembalian = v_kembalian
  where id = v_sale_id;

  return jsonb_build_object('sale_id',v_sale_id,'nomor_transaksi',v_invoice,'subtotal',v_subtotal,'total',v_total,'dibayar',greatest(coalesce(p_dibayar,0),0),'kembalian',v_kembalian);
end;
$$;

revoke all on function public.create_sale(uuid,uuid,text,numeric,jsonb) from public;
grant execute on function public.create_sale(uuid,uuid,text,numeric,jsonb) to authenticated;

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
  v_auth_user uuid := auth.uid();
  v_kasir public.users%rowtype;
  v_rec public.receivables%rowtype;
  v_bayar numeric(14,2);
  v_sisa numeric(14,2);
begin
  select * into v_kasir from public.users where auth_user_id=v_auth_user and aktif=true limit 1;
  if v_kasir.id is null or v_kasir.id <> p_kasir_id then raise exception 'Kasir tidak valid'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah pembayaran harus lebih dari 0'; end if;

  select * into v_rec from public.receivables where id=p_receivable_id for update;
  if v_rec.id is null then raise exception 'Piutang tidak ditemukan'; end if;
  if v_rec.sisa <= 0 then raise exception 'Piutang sudah lunas'; end if;

  v_bayar := least(p_jumlah, v_rec.sisa);
  v_sisa := v_rec.sisa - v_bayar;

  insert into public.receivable_payments (receivable_id, kasir_id, jumlah, keterangan)
  values (p_receivable_id, p_kasir_id, v_bayar, p_keterangan);

  update public.receivables
  set dibayar = dibayar + v_bayar,
      sisa = v_sisa,
      status = case when v_sisa <= 0 then 'lunas' else 'belum_lunas' end,
      updated_at = now()
  where id=p_receivable_id;

  return jsonb_build_object('receivable_id',p_receivable_id,'dibayar',v_bayar,'sisa',v_sisa,'status',case when v_sisa<=0 then 'lunas' else 'belum_lunas' end);
end;
$$;

revoke all on function public.pay_receivable(uuid,uuid,numeric,text) from public;
grant execute on function public.pay_receivable(uuid,uuid,numeric,text) to authenticated;
