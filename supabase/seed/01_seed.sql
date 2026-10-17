-- 01_seed.sql - V-Land P5 / Build Round 2 (B. Synthetic dataset)
-- Run:  supabase db query --linked -f supabase/seed/01_seed.sql
-- Re-runnable: it clears the synthetic land data first. Everything is fictional (is_synthetic = true).
-- No NID, phone or street address exists anywhere.
set search_path = public, extensions;

alter table ownerships  disable trigger trg_event;
alter table deeds       disable trigger trg_event;
alter table mutations   disable trigger trg_event;
alter table cases       disable trigger trg_event;
alter table land_flags  disable trigger trg_event;
alter table tax_records disable trigger trg_event;

-- ---------- clear old data ----------
update profiles set linked_person_id = null;
delete from reports;
delete from verifications;
delete from watches;
delete from purchase_cases;
delete from notifications;
delete from objections;
delete from fraud_reports;
delete from fraud_signals;
delete from plot_events;
delete from deed_parties;
delete from mutations;
delete from ownerships;
delete from cases;
delete from land_flags;
delete from tax_records;
delete from survey_records;
delete from deeds;
delete from plots;
delete from persons;
delete from acquisition_zones;
delete from mouzas;

-- ---------- helpers (temporary, vanish at the end of the session) ----------
create or replace function pg_temp.g(geom geometry, tbl regclass) returns geometry language sql as $$
  select case when exists (
    select 1 from pg_attribute a
    where a.attrelid = tbl and a.attname = 'geom'
      and format_type(a.atttypid, a.atttypmod) ilike 'geometry(multi%')
  then ST_Multi(geom) else geom end
$$;

create or replace function pg_temp.mkp(p_en text, p_bn text, p_fen text, p_fbn text, p_minor boolean default false)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into persons(id, name_bn, name_en, father_name_bn, father_name_en, village_text, name_key, is_minor, is_synthetic)
  values (v, p_bn, p_en, p_fbn, p_fen, 'Demo village S', lower(p_en), p_minor, true);
  return v;
end $$;

create or replace function pg_temp.mkd(p_plot bigint, p_no text, p_on date, p_seller uuid, p_buyer uuid)
returns bigint language plpgsql as $$
declare v bigint; a numeric;
begin
  select area_decimal into a from plots where id = p_plot;
  insert into deeds(plot_id, deed_no, year, sub_registry_office, deed_type, registered_on, area_sold, consideration, status, is_synthetic)
  values (p_plot, p_no, extract(year from p_on)::int, 'Demo Sub-Registry A', 'sale', p_on, a, round(a * 40000), 'registered', true)
  returning id into v;
  insert into deed_parties(deed_id, person_id, role) values (v, p_seller, 'seller'), (v, p_buyer, 'buyer');
  return v;
end $$;

create or replace function pg_temp.mkm(p_plot bigint, p_deed bigint, p_status text, p_filed date, p_decided date)
returns void language plpgsql as $$
begin
  insert into mutations(plot_id, case_no, deed_id, status, filed_on, decided_on, office)
  values (p_plot, 'M-S' || p_deed, p_deed, p_status::mutation_status, p_filed, p_decided, 'Demo AC Land Office');
end $$;

create or replace function pg_temp.mko(p_plot bigint, p_person uuid, p_num int, p_den int, p_via text, p_deed bigint, p_from date, p_to date)
returns void language plpgsql as $$
begin
  insert into ownerships(plot_id, person_id, share_num, share_den, acquired_via, source_deed_id, from_date, to_date)
  values (p_plot, p_person, p_num, p_den, p_via, p_deed, p_from, p_to);
end $$;

-- survey records (RS + BS) and six paid tax years for a scenario plot
create or replace function pg_temp.base(p_plot bigint) returns void language plpgsql as $$
declare a numeric;
begin
  select area_decimal into a from plots where id = p_plot;
  insert into survey_records(plot_id, survey_type, khatian_no, dag_no, recorded_area, khatian_kind, is_synthetic) values
    (p_plot, 'RS', 'RS-S' || p_plot, 'S' || p_plot,          a, 'private', true),
    (p_plot, 'BS', 'BS-S' || p_plot, 'S' || (p_plot + 5000), a, 'private', true);
  insert into tax_records(plot_id, fiscal_year, amount, paid_on, receipt_no)
  select p_plot, fy, round(a * 20), make_date(fy, 12, 15), 'RC-S' || p_plot || '-' || fy from generate_series(2020, 2025) fy;
end $$;

-- ---------- name lists ----------
create temp table fn as
select (ord - 1)::int as i, en, bn from unnest(
  array['Abdul','Rahim','Karim','Jamal','Salim','Kamal','Nasir','Faruk','Habib','Monir','Rafiq','Shafiq','Anwar','Delwar','Harun','Idris','Jashim','Lutfor','Mizan','Nurul'],
  array['আব্দুল','রহিম','করিম','জামাল','সেলিম','কামাল','নাসির','ফারুক','হাবিব','মনির','রফিক','শফিক','আনোয়ার','দেলোয়ার','হারুন','ইদ্রিস','জসিম','লুৎফর','মিজান','নূরুল']
) with ordinality as t(en, bn, ord);

create temp table ln as
select (ord - 1)::int as i, en, bn from unnest(
  array['Mia','Sheikh','Hossain','Uddin','Ahmed','Khan','Islam','Chowdhury','Mondal','Sarker','Biswas','Talukder','Howlader','Miah','Bhuiyan'],
  array['মিয়া','শেখ','হোসেন','উদ্দিন','আহমেদ','খান','ইসলাম','চৌধুরী','মণ্ডল','সরকার','বিশ্বাস','তালুকদার','হাওলাদার','মিঞা','ভুঁইয়া']
) with ordinality as t(en, bn, ord);

-- ---------- four upazilas (spread over different divisions) ----------
create temp table up(k int, pat text, lat float8, lng float8, gid bigint);
insert into up(k, pat, lat, lng) values
  (0, 'Uttara',        23.8759, 90.3795),
  (1, 'Gazipur Sadar', 24.0023, 90.4203),
  (2, 'Sylhet Sadar',  24.8949, 91.8687),
  (3, 'Khulna Sadar',  22.8456, 89.5403);
update up set gid = coalesce(
  (select id from geo_units g where g.level = 'area' and g.name_en ilike '%' || up.pat || '%' order by id limit 1),
  (select id from geo_units where level = 'area' order by id offset up.k * 100 limit 1));

-- ---------- twelve fictional mouzas ----------
create temp table nm as
select (ord - 1)::int as m, en, bn from unnest(
  array['Shonaipur','Kolmidanga','Boroichara','Noapara','Ujanpur','Dhalpara','Haturia','Chandpara','Moynagar','Rupashi','Tentulia','Bakultola'],
  array['শোনাইপুর','কলমিডাঙ্গা','বড়ইছড়া','নোয়াপাড়া','উজানপুর','ঢালপাড়া','হাতুরিয়া','চাঁদপাড়া','ময়নগর','রূপাশী','তেঁতুলিয়া','বকুলতলা']
) with ordinality as t(en, bn, ord);

insert into mouzas(upazila_id, name_en, name_bn, jl_no, is_synthetic)
select u.gid, nm.en, nm.bn, (100 + nm.m)::text, true
from nm join up u on u.k = nm.m / 3
order by nm.m;

-- Give every remaining upazila one synthetic mouza so the geography picker
-- remains usable outside the four plot-rich demo upazilas.
insert into mouzas(upazila_id, name_en, name_bn, jl_no, is_synthetic)
select g.id, g.name_en || ' Mouza', g.name_bn || ' মৌজা', 'AUTO-' || g.id, true
from geo_units g
where g.level = 'area'
  and not exists (select 1 from mouzas m where m.upazila_id = g.id);

-- ---------- 2,400 ordinary plots (12 mouzas x 200, jittered-free grid so neighbours share edges) ----------
create temp table pl as
select m, g, (m * 200 + g + 1) as n, (g % 20) as col, (g / 20) as row
from generate_series(0, 11) m, generate_series(0, 199) g;

insert into plots(mouza_id, area_decimal, land_class, geom, is_synthetic)
select mo.id, 25,
  (case when pl.n % 20 < 12 then 'residential' when pl.n % 20 < 17 then 'agricultural'
        when pl.n % 20 < 19 then 'commercial' else 'other' end)::land_class,
  pg_temp.g(ST_SetSRID(ST_MakeEnvelope(c.x1::float8, c.y1::float8, c.x2::float8, c.y2::float8), 4326), 'public.plots'::regclass),
  true
from pl
join nm on nm.m = pl.m
join mouzas mo on mo.name_en = nm.en
join up u on u.k = pl.m / 3
cross join lateral (select
    round(u.lng::numeric, 6) + (pl.m % 3) * 0.0075 + pl.col * 0.0003       as x1,
    round(u.lng::numeric, 6) + (pl.m % 3) * 0.0075 + (pl.col + 1) * 0.0003 as x2,
    round(u.lat::numeric, 6) - 0.004 + pl.row * 0.0003                     as y1,
    round(u.lat::numeric, 6) - 0.004 + (pl.row + 1) * 0.0003               as y2) c
order by pl.n;

-- area computed from the shape itself (1 decimal = 40.4686 m2)
update plots set area_decimal = round((ST_Area(geom::geography) / 40.4686)::numeric, 2);

create temp table pp as select (row_number() over (order by id))::int as n, id from plots;

-- ---------- people ----------
create temp table po as select n, gen_random_uuid() as id from pl;

insert into persons(id, name_bn, name_en, father_name_bn, father_name_en, village_text, name_key, is_minor, is_synthetic)
select po.id, f.bn || ' ' || l.bn, f.en || ' ' || l.en, ff.bn || ' ' || l.bn, ff.en || ' ' || l.en,
       'Demo village ' || (po.n % 40 + 1), lower(f.en || ' ' || l.en), false, true
from po
join fn f  on f.i  = (po.n * 7) % 20
join ln l  on l.i  = (po.n * 3) % 15
join fn ff on ff.i = (po.n * 11 + 5) % 20;

create temp table sp as select i, gen_random_uuid() as id from generate_series(1, 40) i;
insert into persons(id, name_bn, name_en, father_name_bn, father_name_en, village_text, name_key, is_minor, is_synthetic)
select id, 'ডেমো বিক্রেতা ' || i, 'Demo Seller ' || i, 'ডেমো পিতা ' || i, 'Demo Father ' || i, 'Demo village S', lower('Demo Seller ' || i), false, true
from sp;

-- ---------- deeds, parties, ownership, mutations ----------
insert into deeds(plot_id, deed_no, year, sub_registry_office, deed_type, registered_on, area_sold, consideration, status, is_synthetic)
select pp.id, 'DEMO-' || pl.n, 2012 + pl.n % 8,
       'Demo Sub-Registry ' || (array['A','B','C','D','E'])[pl.n % 5 + 1],
       'sale'::deed_type, make_date(2012 + pl.n % 8, 1 + pl.n % 12, 1 + pl.n % 27),
       p.area_decimal, round(p.area_decimal * 40000 + (pl.n % 50) * 1000), 'registered'::deed_status, true
from pl join pp on pp.n = pl.n join plots p on p.id = pp.id;

create temp table dd as
select pl.n, d.id as deed_id, pp.id as plot_id, d.registered_on
from pl join pp on pp.n = pl.n join deeds d on d.deed_no = 'DEMO-' || pl.n;

insert into deed_parties(deed_id, person_id, role)
select dd.deed_id, sp.id, 'seller'::deed_role from dd join sp on sp.i = dd.n % 40 + 1
union all
select dd.deed_id, po.id, 'buyer'::deed_role from dd join po on po.n = dd.n;

insert into ownerships(plot_id, person_id, share_num, share_den, acquired_via, source_deed_id, from_date, to_date)
select dd.plot_id, po.id, 1, 1, 'deed', dd.deed_id, dd.registered_on, null from dd join po on po.n = dd.n;

-- mostly approved; about 4% still pending (a small, realistic issue)
insert into mutations(plot_id, case_no, deed_id, status, filed_on, decided_on, office)
select dd.plot_id, 'M-' || dd.n,  dd.deed_id,
       (case when dd.n % 25 = 3 then 'pending' else 'approved' end)::mutation_status,
       dd.registered_on + 20,
       case when dd.n % 25 = 3 then null else dd.registered_on + 45 end,
       'Demo AC Land Office'
from dd;

-- ---------- tax: six years, about 4% have the latest year unpaid ----------
insert into tax_records(plot_id, fiscal_year, amount, paid_on, receipt_no)
select dd.plot_id, fy, round(p.area_decimal * 20),
       case when dd.n % 25 = 7 and fy = 2025 then null else make_date(fy, 12, 15) end,
       case when dd.n % 25 = 7 and fy = 2025 then null else 'RC-' || dd.n || '-' || fy end
from dd join plots p on p.id = dd.plot_id, generate_series(2020, 2025) fy;

-- ---------- survey records: RS + BS always, CS for half ----------
insert into survey_records(plot_id, survey_type, khatian_no, dag_no, recorded_area, khatian_kind, is_synthetic)
select pp.id, 'RS'::survey_type, 'RS-' || (500 + pp.n), pp.n::text,          p.area_decimal, 'private'::khatian_kind, true from pp join plots p on p.id = pp.id
union all
select pp.id, 'BS'::survey_type, 'BS-' || (500 + pp.n), (pp.n + 5000)::text, p.area_decimal, 'private'::khatian_kind, true from pp join plots p on p.id = pp.id
union all
select pp.id, 'CS'::survey_type, 'CS-' || (500 + pp.n), (pp.n + 9000)::text, p.area_decimal, 'private'::khatian_kind, true from pp join plots p on p.id = pp.id where pp.n % 2 = 0;

-- Five browseable RS records for every other upazila-backed mouza.
insert into plots(mouza_id, area_decimal, land_class, geom, scenario_code, is_synthetic)
select m.id, 10 + s.n, 'residential'::land_class,
      st_setsrid(st_makeenvelope((89 + mod(m.id, 1000) * 0.001 + s.n * 0.0001)::double precision,
                  (22 + mod(m.id, 500) * 0.0002)::double precision,
                  (89 + mod(m.id, 1000) * 0.001 + s.n * 0.0001 + 0.00005)::double precision,
                  (22 + mod(m.id, 500) * 0.0002 + 0.00005)::double precision), 4326),
       'DEMO-MOUZA-' || m.id || '-' || s.n, true
from mouzas m cross join generate_series(1, 5) s(n)
where not exists (select 1 from plots p where p.mouza_id = m.id);

insert into survey_records(plot_id, survey_type, khatian_no, dag_no, recorded_area, khatian_kind, is_synthetic)
select p.id, 'RS'::survey_type, 'RS-' || p.id, 'D-' || p.id, p.area_decimal, 'private'::khatian_kind, true
from plots p
where p.scenario_code like 'DEMO-MOUZA-%'
  and not exists (select 1 from survey_records s where s.plot_id = p.id and s.survey_type = 'RS');

-- ============================================================
-- The 15 hand-built scenario plots (fixed codes SCN-01 .. SCN-15)
-- ============================================================
create or replace function pg_temp.scn(p_code text, p_k int, p_cls land_class, p_en text, p_bn text, p_fen text, p_fbn text, p_minor boolean default false)
returns table(o_plot bigint, o_person uuid, o_deed bigint) language plpgsql as $$
declare v_plot bigint; v_p uuid; v_d bigint; v_x numeric; v_y numeric; v_m bigint; v_sell uuid; v_dd date := date '2019-03-10';
begin
  select round(u.lng::numeric, 6) + p_k * 0.003, round(u.lat::numeric, 6) + 0.006 into v_x, v_y from up u where u.k = 0;
  select min(id) into v_m from mouzas;
  insert into plots(mouza_id, area_decimal, land_class, geom, scenario_code, is_synthetic)
  values (v_m, 25, p_cls,
          pg_temp.g(ST_SetSRID(ST_MakeEnvelope(v_x::float8, v_y::float8, (v_x + 0.0003)::float8, (v_y + 0.0003)::float8), 4326), 'public.plots'::regclass),
          p_code, true)
  returning id into v_plot;
  update plots set area_decimal = round((ST_Area(geom::geography) / 40.4686)::numeric, 2) where id = v_plot;
  perform pg_temp.base(v_plot);
  v_p := pg_temp.mkp(p_en, p_bn, p_fen, p_fbn, p_minor);
  select id into v_sell from persons where name_en = 'Demo Seller 1';
  v_d := pg_temp.mkd(v_plot, 'DEMO-' || p_code, v_dd, v_sell, v_p);
  perform pg_temp.mko(v_plot, v_p, 1, 1, 'deed', v_d, v_dd, null);
  perform pg_temp.mkm(v_plot, v_d, 'approved', v_dd + 20, v_dd + 45);
  return query select v_plot, v_p, v_d;
end $$;

do $$
declare
  s record; x float8; y float8; b uuid; c uuid; e uuid; d bigint; d2 bigint; sel uuid;
begin
  select round(lng::numeric, 6), round(lat::numeric, 6) + 0.006 into x, y from up where k = 0;
  select id into sel from persons where name_en = 'Demo Seller 2';

  -- SCN-01 clean plot (also the demo citizen's "My land")
  select * into s from pg_temp.scn('SCN-01', 0, 'residential', 'Mahbub Alam', 'মাহবুব আলম', 'Sirajul Alam', 'সিরাজুল আলম');
  update profiles set linked_person_id = s.o_person
   where id = (select id from auth.users where email = 'citizen.demo@example.com');

  -- SCN-02 recorded in a khas khatian; the seller tested is not the recorded name
  select * into s from pg_temp.scn('SCN-02', 1, 'residential', 'Rahim Mia', 'রহিম মিয়া', 'Hafizur Mia', 'হাফিজুর মিয়া');
  update survey_records set khatian_kind = 'khas' where plot_id = s.o_plot;

  -- SCN-03 vested property list
  select * into s from pg_temp.scn('SCN-03', 2, 'residential', 'Selim Reza', 'সেলিম রেজা', 'Abdur Reza', 'আব্দুর রেজা');
  update survey_records set khatian_kind = 'vested' where plot_id = s.o_plot;
  insert into land_flags(plot_id, flag, authority, ref_no, status, from_date, to_date)
  values (s.o_plot, 'vested', 'Demo Land Ministry', 'VP-DEMO-1', 'active', date '2020-01-01', null);

  -- SCN-04 active acquisition notice covering the plot
  select * into s from pg_temp.scn('SCN-04', 3, 'residential', 'Tofazzal Hossain', 'তোফাজ্জল হোসেন', 'Nurul Hossain', 'নূরুল হোসেন');
  insert into acquisition_zones(project, notice_ref, stage, geom) values ('Demo Road Project', 'ACQ-DEMO-1', 'active',
    pg_temp.g(ST_SetSRID(ST_MakeEnvelope(x + 3 * 0.003 - 0.0001, y - 0.0001, x + 3 * 0.003 + 0.0004, y + 0.0004), 4326), 'public.acquisition_zones'::regclass));

  -- SCN-05 title suit with stay order
  select * into s from pg_temp.scn('SCN-05', 4, 'residential', 'Anisur Rahman', 'আনিসুর রহমান', 'Mokbul Rahman', 'মকবুল রহমান');
  insert into cases(plot_id, court, case_no, case_type, status, stay_order, filed_on, next_hearing)
  values (s.o_plot, 'Demo District Court', 'TS-501/2026', 'title_suit', 'pending', true, current_date - 90, current_date + 30);

  -- SCN-06 partition suit, no stay
  select * into s from pg_temp.scn('SCN-06', 5, 'residential', 'Golam Mostafa', 'গোলাম মোস্তফা', 'Fazlul Mostafa', 'ফজলুল মোস্তফা');
  insert into cases(plot_id, court, case_no, case_type, status, stay_order, filed_on, next_hearing)
  values (s.o_plot, 'Demo District Court', 'PS-602/2026', 'partition_suit', 'pending', false, current_date - 120, current_date + 45);

  -- SCN-07 recorded owner is Abdul Karim; the test seller only sounds similar
  select * into s from pg_temp.scn('SCN-07', 6, 'residential', 'Abdul Karim', 'আব্দুল করিম', 'Yunus Ali', 'ইউনুস আলী');

  -- SCN-08 three heirs hold one third each; the seller offers the whole plot
  select * into s from pg_temp.scn('SCN-08', 7, 'residential', 'Nazrul Islam', 'নজরুল ইসলাম', 'Rafiqul Islam', 'রফিকুল ইসলাম');
  update ownerships set share_num = 1, share_den = 3, acquired_via = 'inheritance', source_deed_id = null where plot_id = s.o_plot;
  b := pg_temp.mkp('Shahidul Islam', 'শহিদুল ইসলাম', 'Rafiqul Islam', 'রফিকুল ইসলাম');
  c := pg_temp.mkp('Zahidul Islam',  'জাহিদুল ইসলাম', 'Rafiqul Islam', 'রফিকুল ইসলাম');
  perform pg_temp.mko(s.o_plot, b, 1, 3, 'inheritance', null, date '2019-03-10', null);
  perform pg_temp.mko(s.o_plot, c, 1, 3, 'inheritance', null, date '2019-03-10', null);

  -- SCN-09 the same seller signed two sale deeds 12 days apart
  select * into s from pg_temp.scn('SCN-09', 8, 'residential', 'Habibur Rahman', 'হাবিবুর রহমান', 'Lutfur Rahman', 'লুৎফুর রহমান');
  b := pg_temp.mkp('Ruhul Amin', 'রুহুল আমিন', 'Sultan Amin', 'সুলতান আমিন');
  c := pg_temp.mkp('Mizanur Rahman', 'মিজানুর রহমান', 'Kuddus Rahman', 'কুদ্দুস রহমান');
  d  := pg_temp.mkd(s.o_plot, 'DEMO-SCN-09A', current_date - 40, s.o_person, b);
  d2 := pg_temp.mkd(s.o_plot, 'DEMO-SCN-09B', current_date - 28, s.o_person, c);
  perform pg_temp.mkm(s.o_plot, d, 'pending', current_date - 30, null);

  -- SCN-10 deed registered about five months ago, mutation never filed
  select * into s from pg_temp.scn('SCN-10', 9, 'residential', 'Idris Ali', 'ইদ্রিস আলী', 'Yakub Ali', 'ইয়াকুব আলী');
  update ownerships set to_date = current_date - 150 where plot_id = s.o_plot and to_date is null;
  b := pg_temp.mkp('Shamim Ahmed', 'শামীম আহমেদ', 'Jahangir Ahmed', 'জাহাঙ্গীর আহমেদ');
  d := pg_temp.mkd(s.o_plot, 'DEMO-SCN-10B', current_date - 150, s.o_person, b);
  perform pg_temp.mko(s.o_plot, b, 1, 1, 'deed', d, current_date - 150, null);

  -- SCN-11 four owners in 18 months
  select * into s from pg_temp.scn('SCN-11', 10, 'residential', 'Kabir Hossain', 'কবির হোসেন', 'Manik Hossain', 'মানিক হোসেন');
  update ownerships set from_date = (current_date - interval '18 months')::date, to_date = (current_date - interval '13 months')::date where plot_id = s.o_plot;
  b := pg_temp.mkp('Lalon Mia', 'লালন মিয়া', 'Bashir Mia', 'বশির মিয়া');
  c := pg_temp.mkp('Munna Sheikh', 'মুন্না শেখ', 'Alamgir Sheikh', 'আলমগীর শেখ');
  e := pg_temp.mkp('Nuruzzaman Talukder', 'নূরুজ্জামান তালুকদার', 'Ershad Talukder', 'এরশাদ তালুকদার');
  d := pg_temp.mkd(s.o_plot, 'DEMO-SCN-11B', (current_date - interval '13 months')::date, s.o_person, b);
  perform pg_temp.mko(s.o_plot, b, 1, 1, 'deed', d, (current_date - interval '13 months')::date, (current_date - interval '8 months')::date);
  perform pg_temp.mkm(s.o_plot, d, 'approved', (current_date - interval '13 months')::date + 10, (current_date - interval '13 months')::date + 30);
  d := pg_temp.mkd(s.o_plot, 'DEMO-SCN-11C', (current_date - interval '8 months')::date, b, c);
  perform pg_temp.mko(s.o_plot, c, 1, 1, 'deed', d, (current_date - interval '8 months')::date, (current_date - interval '3 months')::date);
  perform pg_temp.mkm(s.o_plot, d, 'approved', (current_date - interval '8 months')::date + 10, (current_date - interval '8 months')::date + 30);
  d := pg_temp.mkd(s.o_plot, 'DEMO-SCN-11D', (current_date - interval '3 months')::date, c, e);
  perform pg_temp.mko(s.o_plot, e, 1, 1, 'deed', d, (current_date - interval '3 months')::date, null);
  perform pg_temp.mkm(s.o_plot, d, 'approved', (current_date - interval '3 months')::date + 5, (current_date - interval '3 months')::date + 20);

  -- SCN-12 three unpaid tax years and an active mortgage
  select * into s from pg_temp.scn('SCN-12', 11, 'residential', 'Obaidul Haque', 'ওবায়দুল হক', 'Fazlul Haque', 'ফজলুল হক');
  update tax_records set paid_on = null, receipt_no = null where plot_id = s.o_plot and fiscal_year in (2023, 2024, 2025);
  insert into land_flags(plot_id, flag, authority, ref_no, status, from_date, to_date)
  values (s.o_plot, 'mortgage', 'Demo Bank', 'ML-DEMO-77', 'active', date '2024-02-01', null);

  -- SCN-13 deed area 25% off, and RS vs BS records disagree
  select * into s from pg_temp.scn('SCN-13', 12, 'residential', 'Parvez Ahmed', 'পারভেজ আহমেদ', 'Mansur Ahmed', 'মনসুর আহমেদ');
  update deeds set area_sold = round(area_sold * 1.25, 2) where id = s.o_deed;
  update survey_records set recorded_area = round(recorded_area * 0.75, 2) where plot_id = s.o_plot and survey_type = 'RS';
  update survey_records set dag_no = (select dag_no from survey_records where plot_id = s.o_plot and survey_type = 'RS')
   where plot_id = s.o_plot and survey_type = 'BS';

  -- SCN-14 clean plot about 60 m from a planned railway corridor
  select * into s from pg_temp.scn('SCN-14', 13, 'residential', 'Quddus Mia', 'কুদ্দুস মিয়া', 'Ruhul Mia', 'রুহুল মিয়া');
  insert into acquisition_zones(project, notice_ref, stage, geom) values ('Demo Railway Corridor', 'PLAN-DEMO-1', 'planned',
    pg_temp.g(ST_SetSRID(ST_MakeEnvelope(x + 13 * 0.003 - 0.0005, y + 0.0003 + 0.00054, x + 13 * 0.003 + 0.0008, y + 0.0003 + 0.0007), 4326), 'public.acquisition_zones'::regclass));

  -- SCN-15 inherited agricultural land with a minor co-sharer
  select * into s from pg_temp.scn('SCN-15', 14, 'agricultural', 'Rokeya Begum', 'রোকেয়া বেগম', 'Abdus Samad', 'আব্দুস সামাদ');
  update ownerships set share_num = 1, share_den = 2, acquired_via = 'inheritance' where plot_id = s.o_plot;
  b := pg_temp.mkp('Sakib Hasan', 'সাকিব হাসান', 'Mahmud Hasan', 'মাহমুদ হাসান', true);
  perform pg_temp.mko(s.o_plot, b, 1, 2, 'inheritance', null, date '2019-03-10', null);
end $$;

alter table ownerships  enable trigger trg_event;
alter table deeds       enable trigger trg_event;
alter table mutations   enable trigger trg_event;
alter table cases       enable trigger trg_event;
alter table land_flags  enable trigger trg_event;
alter table tax_records enable trigger trg_event;

-- If the project has a demo snapshot function, take the snapshot now so reset_demo_data() has something to restore.
do $$
declare r record;
begin
  for r in select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.proname ilike '%snapshot%' and p.pronargs = 0 loop
    execute format('select %I.%I()', r.nspname, r.proname);
    raise notice 'snapshot taken via %.%', r.nspname, r.proname;
  end loop;
end $$;

-- ---------- summary ----------
select what, n from (
  select 1 o, 'plots' what, count(*)::text n from plots
  union all select 2, 'scenario plots (expect 15)', count(*)::text from plots where scenario_code is not null
  union all select 3, 'persons', count(*)::text from persons
  union all select 4, 'deeds', count(*)::text from deeds
  union all select 5, 'ownerships', count(*)::text from ownerships
  union all select 6, 'survey_records', count(*)::text from survey_records
  union all select 7, 'tax_records', count(*)::text from tax_records
  union all select 8, 'acquisition_zones (expect 2)', count(*)::text from acquisition_zones
  union all select 9, 'upazila ' || up.pat, coalesce(g.glb_key, '?') from up left join geo_units g on g.id = up.gid
) x order by o, what;

update deeds d set area_sold = round(p.area_decimal * o.share_num::numeric / o.share_den, 2)
from ownerships o join plots p on p.id = o.plot_id
where o.source_deed_id = d.id and o.to_date is null and p.scenario_code = 'SCN-15';
