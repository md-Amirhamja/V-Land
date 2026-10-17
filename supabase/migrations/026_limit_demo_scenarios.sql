create or replace function public.list_scenarios() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', scenario_code, 'plot_id', id) order by scenario_code), '[]'::jsonb)
  from public.plots
  where scenario_code like 'SCN-%';
$$;
revoke all on function public.list_scenarios() from public;
grant execute on function public.list_scenarios() to anon, authenticated;

select 'ok' as status;