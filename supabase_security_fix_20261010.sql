-- Supabase security hardening applied on 2026-10-10.
-- Remove permissive duplicate policies that exposed every receivable/payment row.
drop policy if exists receivables_select on public.receivables;
drop policy if exists receivable_payments_select on public.receivable_payments;

-- Restrict settings reads to sessions mapped to a valid kiosk user.
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated
  using ((select public.my_user_id()) is not null);

-- Disable legacy RPCs not used by current clients.
-- The old kiosk_login contained a hard-coded PIN; kiosk_register_cashier
-- could create arbitrary cashier accounts; login_by_username exposed account details.
revoke execute on function public.kiosk_login(text, text) from public, anon, authenticated;
revoke execute on function public.kiosk_register_cashier(text) from public, anon, authenticated;
revoke execute on function public.login_by_username(text) from public, anon, authenticated;


-- Remove default PUBLIC/anon execution from exposed SECURITY DEFINER functions.
-- Authenticated app sessions include Supabase anonymous-auth sessions; active RPCs
-- remain available to authenticated while the legacy/insecure endpoints stay revoked.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           oidvectortypes(p.proargtypes) AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      fn.schema_name, fn.function_name, fn.arg_types
    );
    IF fn.function_name NOT IN (
      'kiosk_login',
      'kiosk_register_cashier',
      'login_by_username',
      'enqueue_push_sale',
      'enqueue_push_stock_empty',
      'handle_new_auth_user'
    ) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
        fn.schema_name, fn.function_name, fn.arg_types
      );
    END IF;
  END LOOP;
END $$;


-- Tighten duplicate permissive product/agent policies.
drop policy if exists products_select on public.products;
drop policy if exists products_read on public.products;
drop policy if exists agents_select on public.agents;
drop policy if exists agents_read on public.agents;

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated
  using (aktif = true or (select public.my_role()) = 'admin');

drop policy if exists agents_select_authenticated on public.agents;
create policy agents_select_authenticated on public.agents
  for select to authenticated
  using (aktif = true or (select public.my_role()) = 'admin');

-- Limit receivables/payments to the cashier who owns the sale, or an admin.
drop policy if exists receivables_read on public.receivables;
drop policy if exists receivables_select on public.receivables;
drop policy if exists receivables_select_authenticated on public.receivables;
create policy receivables_select_owner_or_admin on public.receivables
  for select to authenticated
  using (
    (select public.my_role()) = 'admin'
    or exists (
      select 1 from public.sales s
      where s.id = receivables.sale_id
        and s.kasir_id = (select public.kiosk_user_id())
    )
  );

drop policy if exists receivable_payments_read on public.receivable_payments;
drop policy if exists receivable_payments_select on public.receivable_payments;
drop policy if exists receivable_payments_select_owner_or_admin on public.receivable_payments;
create policy receivable_payments_select_owner_or_admin on public.receivable_payments
  for select to authenticated
  using (
    (select public.my_role()) = 'admin'
    or exists (
      select 1 from public.receivables r
      join public.sales s on s.id = r.sale_id
      where r.id = receivable_payments.receivable_id
        and s.kasir_id = (select public.kiosk_user_id())
    )
  );

-- Limit carried-stock records to their owner or an admin.
drop policy if exists barang_dibawa_read on public.barang_dibawa;
create policy barang_dibawa_read on public.barang_dibawa
  for select to authenticated
  using ((select public.my_role()) = 'admin' or user_id = (select public.kiosk_user_id()));

drop policy if exists barang_dibawa_items_read on public.barang_dibawa_items;
create policy barang_dibawa_items_read on public.barang_dibawa_items
  for select to authenticated
  using (
    (select public.my_role()) = 'admin'
    or exists (
      select 1 from public.barang_dibawa b
      where b.id = barang_dibawa_items.barang_dibawa_id
        and b.user_id = (select public.kiosk_user_id())
    )
  );

revoke execute on function public.enqueue_push_sale() from public, anon, authenticated;
revoke execute on function public.enqueue_push_stock_empty() from public, anon, authenticated;

-- The purchase function uses schema-qualified table references; pin its search_path.
alter function public.create_purchase(text, date, text, jsonb) set search_path = '';


-- Ensure a cashier cannot complete another cashier's carried-stock record.
DO $patch$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='complete_barang_dibawa'
    AND oidvectortypes(p.proargtypes)='uuid, uuid, jsonb';
  IF v_def IS NULL THEN RAISE EXCEPTION 'complete_barang_dibawa not found'; END IF;
  v_def := replace(v_def,
    $old$if v_header.id is null then raise exception 'Data barang dibawa tidak ditemukan'; end if;$old$,
    $new$if v_header.id is null then raise exception 'Data barang dibawa tidak ditemukan'; end if;
 if v_user.role <> 'admin' and v_header.user_id <> p_user_id then
   raise exception 'Data barang dibawa bukan milik pengguna ini';
 end if;$new$);
  IF position('Data barang dibawa bukan milik pengguna ini' in v_def)=0 THEN
    RAISE EXCEPTION 'Ownership guard was not inserted';
  END IF;
  EXECUTE v_def;
END
$patch$;

-- Cashiers may only collect payment for receivables from their own sales.
DO $patch$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='pay_receivable'
    AND oidvectortypes(p.proargtypes)='uuid, uuid, numeric, text';
  IF v_def IS NULL THEN RAISE EXCEPTION 'pay_receivable not found'; END IF;
  v_def := replace(v_def,
    $old$if v_rec.id is null then raise exception 'Piutang tidak ditemukan'; end if;$old$,
    $new$if v_rec.id is null then raise exception 'Piutang tidak ditemukan'; end if;
 if v_user.role <> 'admin' and not exists (
   select 1 from public.sales s
   where s.id = v_rec.sale_id and s.kasir_id = v_user.id
 ) then
   raise exception 'Piutang bukan milik kasir ini';
 end if;$new$);
  IF position('Piutang bukan milik kasir ini' in v_def)=0 THEN
    RAISE EXCEPTION 'Receivable ownership guard was not inserted';
  END IF;
  EXECUTE v_def;
END
$patch$;

-- Cashiers may only return their own sales; admins can handle all sales.
DO $patch$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='create_sale_return'
    AND oidvectortypes(p.proargtypes)='uuid, uuid, jsonb, text';
  IF v_def IS NULL THEN RAISE EXCEPTION 'create_sale_return not found'; END IF;
  v_def := replace(v_def,
    $old$if not exists(select 1 from public.sales where id=p_sale_id) then
    raise exception 'Transaksi penjualan tidak ditemukan';
  end if;$old$,
    $new$if not exists(
    select 1 from public.sales s
    where s.id=p_sale_id
      and ((select public.my_role()) = 'admin'
           or s.kasir_id = (select public.kiosk_user_id()))
  ) then
    raise exception 'Transaksi penjualan tidak ditemukan atau bukan milik kasir ini';
  end if;$new$);
  IF position('bukan milik kasir ini' in v_def)=0 THEN
    RAISE EXCEPTION 'Sale return ownership guard was not inserted';
  END IF;
  EXECUTE v_def;
END
$patch$;
