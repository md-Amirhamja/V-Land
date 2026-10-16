revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('audit_write', 'audit_verify')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
