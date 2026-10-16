-- engine.sql - V-Land P5 / Build Round 2 (E. Tests)
-- Run:  npm run test:engine      (or: supabase db query --linked -f supabase/tests/engine.sql)
-- Runs each scenario as the demo citizen, then checks verdict and the exact set of rule codes.
-- R20 ("thin record", Info, 0 points) is ignored because it never changes a verdict.
set search_path = public, extensions;

create temp table res(test text, expected text, got text, ok boolean);

do $$
declare
  uid uuid; r record; pid bigint; vd text; f text; got text; c text; vid bigint;
  v_code text; txt text; txt2 text; txt3 text; n bigint;
  codes text[] := array['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16','R17','R18','R19'];
begin
  select id into uid from auth.users where email = 'citizen.demo@example.com';
  if uid is null then raise exception 'Demo citizen citizen.demo@example.com not found in auth.users'; end if;

  -- ===== A. the 15 scenarios =====
  for r in select * from (values
    ('SCN-01', 'clear',   '',                'Mahbub Alam',         'Sirajul Alam',   1.0),
    ('SCN-02', 'stop',    'R01,R07',         'Jalal Sheikh',        'Hafizur Sheikh', 1.0),
    ('SCN-03', 'stop',    'R02',             'Selim Reza',          'Abdur Reza',     1.0),
    ('SCN-04', 'stop',    'R03',             'Tofazzal Hossain',    'Nurul Hossain',  1.0),
    ('SCN-05', 'stop',    'R05',             'Anisur Rahman',       'Mokbul Rahman',  1.0),
    ('SCN-06', 'caution', 'R06',             'Golam Mostafa',       'Fazlul Mostafa', 1.0),
    ('SCN-07', 'stop',    'R07',             'Abdul Kader Mia',     'Samsul Mia',     1.0),
    ('SCN-08', 'caution', 'R08',             'Nazrul Islam',        'Rafiqul Islam',  1.0),
    ('SCN-09', 'stop',    'R09',             'Habibur Rahman',      'Lutfur Rahman',  1.0),
    ('SCN-10', 'caution', 'R10',             'Shamim Ahmed',        'Jahangir Ahmed', 1.0),
    ('SCN-11', 'caution', 'R11',             'Nuruzzaman Talukder', 'Ershad Talukder',1.0),
    ('SCN-12', 'caution', 'R13,R14',         'Obaidul Haque',       'Fazlul Haque',   1.0),
    ('SCN-13', 'caution', 'R15,R16',         'Parvez Ahmed',        'Mansur Ahmed',   1.0),
    ('SCN-14', 'caution', 'R04',             'Quddus Mia',          'Ruhul Mia',      1.0),
    ('SCN-15', 'caution', 'R17,R18',         'Rokeya Begum',        'Abdus Samad',    0.5)
  ) as t(code, ev, ec, seller, father, share) loop
    select id into pid from plots where scenario_code = r.code;
    if pid is null then
      insert into res values (r.code, r.ev || ' [' || r.ec || ']', 'plot missing - run the seed first', false);
      continue;
    end if;
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', uid::text, true);
      set local role authenticated;
      perform run_verification(pid, r.seller, r.father, r.share::numeric, null::numeric, 'buy');
      reset role;
      select verdict::text, findings::text into vd, f
        from verifications where user_id = uid and plot_id = pid order by id desc limit 1;
      got := '';
      foreach c in array codes loop
        if f like '%"' || c || '"%' then got := got || case when got = '' then '' else ',' end || c; end if;
      end loop;
      insert into res values (r.code, r.ev || ' [' || r.ec || ']', vd || ' [' || got || ']', vd = r.ev and got = r.ec);
      delete from verifications where user_id = uid and plot_id = pid;
    exception when others then
      insert into res values (r.code, r.ev || ' [' || r.ec || ']', 'ERROR: ' || sqlerrm, false);
    end;
  end loop;

  -- ===== B. security: anonymous visitors and citizens cannot read land tables =====
  foreach c in array array['plots', 'ownerships', 'persons', 'deeds'] loop
    begin
      set local role anon;
      execute format('select count(*) from %I', c);
      reset role;
      insert into res values ('anon cannot read ' || c, 'denied', 'READ ALLOWED', false);
    exception when insufficient_privilege then
      insert into res values ('anon cannot read ' || c, 'denied', 'denied', true);
    when others then
      insert into res values ('anon cannot read ' || c, 'denied', 'ERROR: ' || sqlerrm, false);
    end;

    begin
      set local role authenticated;
      execute format('select count(*) from %I', c) into n;
      reset role;
      insert into res values ('citizen sees no rows of ' || c, '0 rows or denied', n::text || ' rows', n = 0);
    exception when insufficient_privilege then
      insert into res values ('citizen sees no rows of ' || c, '0 rows or denied', 'denied', true);
    when others then
      insert into res values ('citizen sees no rows of ' || c, '0 rows or denied', 'ERROR: ' || sqlerrm, false);
    end;
  end loop;

  -- ===== C. certificate: issue, public verify, no personal data, change, tamper =====
  begin
    select id into pid from plots where scenario_code = 'SCN-01';
    set local role authenticated;
    perform run_verification(pid, 'Mahbub Alam', 'Sirajul Alam', 1::numeric, null::numeric, 'buy');
    reset role;
    select v.id into vid from verifications v where v.user_id = uid and v.plot_id = pid order by v.id desc limit 1;
    set local role authenticated;
    perform issue_report(vid);
    reset role;
    select rp.code into v_code from reports rp where rp.verification_id = vid order by rp.id desc limit 1;

    set local role anon;
    select verify_report(v_code)::text into txt;
    reset role;
    insert into res values ('certificate: public page shows no owner name', 'no name', left(txt, 80),
                            txt not ilike '%Mahbub%' and txt not ilike '%Sirajul%');
    insert into res values ('certificate: genuine when fresh', 'genuine', left(txt, 80),
                            txt ilike '%genuine%' or txt ilike '%valid%' or txt ilike '%current%');

    insert into cases(plot_id, court, case_no, case_type, status, stay_order, filed_on)
    values (pid, 'Demo Court', 'CHG-TEST-1', 'other', 'pending', false, current_date);
    set local role anon;
    select verify_report(v_code)::text into txt2;
    reset role;
    insert into res values ('certificate: says changed after a new case', 'changed', left(txt2, 80), txt2 ilike '%chang%');
    delete from cases where case_no = 'CHG-TEST-1';

    update reports set payload = payload || '{"tamper":1}'::jsonb where reports.code = v_code;
    set local role anon;
    select verify_report(v_code)::text into txt3;
    reset role;
    insert into res values ('certificate: tampered payload is rejected', 'invalid', left(txt3, 80),
                            txt3 ilike '%invalid%' or txt3 ilike '%tamper%' or txt3 ilike '%not found%');

    delete from reports where reports.code = v_code;
    delete from verifications where id = vid;
  exception when others then
    insert into res values ('certificate tests', 'run', 'ERROR: ' || sqlerrm, false);
  end;
end $$;

select test, expected, got, result from (
  select 1 as o, test, expected, got, case when ok then 'PASS' else 'FAIL' end as result from res
  union all
  select 0, 'SUMMARY', '', count(*) filter (where ok) || ' of ' || count(*) || ' passed', '' from res
) x order by o, test;
