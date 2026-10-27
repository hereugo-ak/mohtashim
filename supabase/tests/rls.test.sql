-- Run with `supabase test db` after installing pgTAP and applying migrations.
begin;
select plan(7);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.student_contributions'::regclass),
  'RLS is enabled on student contributions'
);
select ok(
  not has_table_privilege('anon', 'public.student_contributions', 'select'),
  'anon cannot read contributions'
);
select ok(
  not has_table_privilege('authenticated', 'public.student_contributions', 'select'),
  'authenticated users cannot read contributions directly'
);
select ok(
  not has_table_privilege('anon', 'public.student_contributions', 'insert'),
  'anon cannot insert directly'
);
select ok(
  not has_function_privilege('anon', 'public.submit_student_contribution(text,text,text,text,text,text,boolean)', 'execute'),
  'anon cannot execute submission RPC'
);
select ok(
  has_function_privilege('service_role', 'public.submit_student_contribution(text,text,text,text,text,text,boolean)', 'execute'),
  'server role can execute submission RPC'
);
select ok(
  has_function_privilege('service_role', 'public.contribution_backend_health()', 'execute'),
  'server role can execute backend health RPC'
);

select * from finish();
rollback;
