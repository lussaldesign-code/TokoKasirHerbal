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
