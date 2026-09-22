-- Run once after supabase_schema.sql for an existing project.
-- Existing Supabase Auth accounts that do not yet have a public.users row
-- will receive a karyawan profile. Promote the intended owner to admin.

insert into public.users(auth_user_id,nama,role,aktif)
select
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data->>'full_name',''),
    nullif(au.raw_user_meta_data->>'name',''),
    nullif(split_part(coalesce(au.email,''),'@',1),''),
    'Pengguna'
  ),
  'karyawan',
  true
from auth.users au
left join public.users u on u.auth_user_id=au.id
where u.id is null;

-- Check profiles after the backfill:
select id,auth_user_id,nama,username,role,aktif
from public.users
order by nama;
