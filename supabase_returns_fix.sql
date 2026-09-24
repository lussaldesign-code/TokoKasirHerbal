-- TokoKasirHerbal: fix retur and data synchronization
-- Production migration: fix_return_sync_and_access
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;

drop policy if exists "sales_select_admin" on public.sales;
create policy "sales_select_owner_or_admin" on public.sales for select to authenticated
using ((select public.my_role())='admin' or kasir_id=(select public.kiosk_user_id()));

drop policy if exists "sale_items_select" on public.sale_items;
drop policy if exists "sale_items_read" on public.sale_items;
create policy "sale_items_select_owner_or_admin" on public.sale_items for select to authenticated
using ((select public.my_role())='admin' or exists(
 select 1 from public.sales s where s.id=sale_items.sale_id and s.kasir_id=(select public.kiosk_user_id())
));

drop policy if exists "return_sales_select_authenticated" on public.sale_returns;
create policy "return_sales_select_owner_or_admin" on public.sale_returns for select to authenticated
using ((select public.my_role())='admin' or kasir_id=(select public.kiosk_user_id()));

drop policy if exists "return_sale_items_select_authenticated" on public.sale_return_items;
create policy "return_sale_items_select_owner_or_admin" on public.sale_return_items for select to authenticated
using ((select public.my_role())='admin' or exists(
 select 1 from public.sale_returns r where r.id=sale_return_items.sale_return_id and r.kasir_id=(select public.kiosk_user_id())
));

drop policy if exists "return_purchases_select_authenticated" on public.purchase_returns;
create policy "return_purchases_select_admin" on public.purchase_returns for select to authenticated
using ((select public.my_role())='admin');

drop policy if exists "return_purchase_items_select_authenticated" on public.purchase_return_items;
create policy "return_purchase_items_select_admin" on public.purchase_return_items for select to authenticated
using ((select public.my_role())='admin');

-- Return RPCs are deployed with SECURITY DEFINER, pinned search_path,
-- session validation, quantity validation, stock validation and stock movements.
