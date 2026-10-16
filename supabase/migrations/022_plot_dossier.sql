create or replace function public.plot_dossier(p_plot bigint)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'plot', jsonb_build_object('id', p.id, 'mouza_id', p.mouza_id, 'area_decimal', p.area_decimal, 'land_class', p.land_class::text),
    'state_hash', public.plot_state_hash(p.id),
    'survey', (select coalesce(jsonb_agg(jsonb_build_object('type', s.survey_type::text, 'khatian_no', s.khatian_no, 'dag_no', s.dag_no, 'recorded_area', s.recorded_area, 'kind', s.khatian_kind::text) order by s.id), '[]'::jsonb) from public.survey_records s where s.plot_id = p.id),
    'owners', (select coalesce(jsonb_agg(jsonb_build_object('share_num', o.share_num, 'share_den', o.share_den, 'acquired_via', o.acquired_via, 'from_date', o.from_date) order by o.id), '[]'::jsonb) from public.ownerships o where o.plot_id = p.id and o.to_date is null),
    'deeds', (select coalesce(jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'year', d.year, 'office', d.sub_registry_office, 'type', d.deed_type::text, 'registered_on', d.registered_on, 'area_sold', d.area_sold, 'status', d.status::text) order by d.registered_on), '[]'::jsonb) from public.deeds d where d.plot_id = p.id),
    'mutations', (select coalesce(jsonb_agg(jsonb_build_object('case_no', m.case_no, 'status', m.status::text, 'filed_on', m.filed_on, 'decided_on', m.decided_on, 'office', m.office) order by m.filed_on), '[]'::jsonb) from public.mutations m where m.plot_id = p.id),
    'cases', (select coalesce(jsonb_agg(jsonb_build_object('court', c.court, 'case_no', c.case_no, 'type', c.case_type::text, 'status', c.status::text, 'stay_order', c.stay_order, 'filed_on', c.filed_on, 'next_hearing', c.next_hearing) order by c.filed_on), '[]'::jsonb) from public.cases c where c.plot_id = p.id),
    'flags', (select coalesce(jsonb_agg(jsonb_build_object('flag', f.flag::text, 'authority', f.authority, 'ref_no', f.ref_no, 'status', f.status::text, 'from_date', f.from_date, 'to_date', f.to_date) order by f.id), '[]'::jsonb) from public.land_flags f where f.plot_id = p.id),
    'tax', (select coalesce(jsonb_agg(jsonb_build_object('fiscal_year', t.fiscal_year, 'amount', t.amount, 'paid_on', t.paid_on) order by t.fiscal_year), '[]'::jsonb) from public.tax_records t where t.plot_id = p.id),
    'events', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select jsonb_build_object('type', e.event_type, 'at', e.created_at) as x from public.plot_events e where e.plot_id = p.id order by e.created_at desc limit 20) q)
  )
  from public.plots p where p.id = p_plot;
$$;
revoke execute on function public.plot_dossier(bigint) from public, anon;
grant execute on function public.plot_dossier(bigint) to authenticated;
