-- 002_demo_roles.sql  -  run AFTER creating the two demo users in Authentication > Users.
-- Promotes the admin demo user. The citizen demo user keeps the default 'citizen' role.
update public.profiles
   set role = 'admin', display_name = 'Demo Admin'
 where id = (select id from auth.users where email = 'admin.demo@example.com');

update public.profiles
   set display_name = 'Demo Citizen'
 where id = (select id from auth.users where email = 'citizen.demo@example.com');

-- check query: expect one admin and one citizen
select u.email, p.role from public.profiles p join auth.users u on u.id = p.id order by 1;
