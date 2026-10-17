do $$
declare
  demo_person uuid;
begin
  select p.linked_person_id into demo_person
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'citizen.demo@example.com';

  if demo_person is not null then
    insert into public.ownerships(plot_id, person_id, share_num, share_den, acquired_via, from_date)
    select target.id, demo_person, 1, 1, 'deed', date '2024-01-01'
    from (
      select id, 0 as priority from public.plots where scenario_code = 'SCN-01'
      union all
      select id, 1 as priority from public.plots where scenario_code like 'DEMO-MOUZA-%'
      order by priority, id limit 3
    ) target
    where not exists (
      select 1 from public.ownerships o
      where o.plot_id = target.id and o.person_id = demo_person and o.to_date is null
    );
  end if;
end $$;

select 'ok' as status;