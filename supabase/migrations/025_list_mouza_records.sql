-- Return five safe plot summaries for the judge-friendly mouza preview.
create or replace function public.list_mouza_records(p_mouza bigint) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(private.plot_summary(p.id) order by random()), '[]'::jsonb)
  from (
    select id
    from public.plots
    where mouza_id = p_mouza
    order by random()
    limit 5
  ) p;
$$;
revoke all on function public.list_mouza_records(bigint) from public;
grant execute on function public.list_mouza_records(bigint) to authenticated;

select 'ok' as status;