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
