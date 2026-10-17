-- Ensure every upazila has a synthetic mouza for the geography picker.
insert into public.mouzas(upazila_id, name_en, name_bn, jl_no, is_synthetic)
select g.id, g.name_en || ' Mouza', g.name_bn || ' মৌজা', 'AUTO-' || g.id, true
from public.geo_units g
where g.level = 'area'
  and not exists (select 1 from public.mouzas m where m.upazila_id = g.id);

select 'ok' as status;