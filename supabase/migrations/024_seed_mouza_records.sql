-- Add five synthetic browseable records to every mouza without plot data.
insert into public.plots(mouza_id, area_decimal, land_class, geom, scenario_code, is_synthetic)
select m.id, 10 + s.n, 'residential'::public.land_class,
      extensions.st_setsrid(extensions.st_makeenvelope((89 + mod(m.id, 1000) * 0.001 + s.n * 0.0001)::double precision,
                  (22 + mod(m.id, 500) * 0.0002)::double precision,
                  (89 + mod(m.id, 1000) * 0.001 + s.n * 0.0001 + 0.00005)::double precision,
                  (22 + mod(m.id, 500) * 0.0002 + 0.00005)::double precision), 4326),
       'DEMO-MOUZA-' || m.id || '-' || s.n, true
from public.mouzas m cross join generate_series(1, 5) s(n)
where not exists (select 1 from public.plots p where p.mouza_id = m.id);

insert into public.survey_records(plot_id, survey_type, khatian_no, dag_no, recorded_area, khatian_kind, is_synthetic)
select p.id, 'RS'::public.survey_type, 'RS-' || p.id, 'D-' || p.id, p.area_decimal, 'private'::public.khatian_kind, true
from public.plots p
where p.scenario_code like 'DEMO-MOUZA-%'
  and not exists (select 1 from public.survey_records s where s.plot_id = p.id and s.survey_type = 'RS');

select 'ok' as status;