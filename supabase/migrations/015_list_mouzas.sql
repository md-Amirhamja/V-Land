create or replace function public.list_mouzas(p_glb text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name_bn', m.name_bn, 'name_en', m.name_en, 'jl_no', m.jl_no) order by m.name_en), '[]'::jsonb)
  from public.mouzas m join public.geo_units g on g.id = m.upazila_id
  where g.glb_key = p_glb;
$$;
revoke all on function public.list_mouzas(text) from public;
grant execute on function public.list_mouzas(text) to anon, authenticated;
select 'ok' as status;
