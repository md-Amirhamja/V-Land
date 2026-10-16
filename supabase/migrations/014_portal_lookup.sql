create or replace function public.list_mouzas() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name_en',m.name_en,'name_bn',m.name_bn,'jl_no',m.jl_no,'area',g.glb_key) order by g.glb_key,m.name_en),'[]'::jsonb)
  from mouzas m join geo_units g on g.id = m.upazila_id;
$$;
create or replace function public.list_scenarios() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code',scenario_code,'plot_id',id) order by scenario_code),'[]'::jsonb)
  from plots where scenario_code is not null;
$$;
revoke all on function public.list_mouzas(), public.list_scenarios() from public;
grant execute on function public.list_mouzas(), public.list_scenarios() to anon, authenticated;
select 'ok' as status;
