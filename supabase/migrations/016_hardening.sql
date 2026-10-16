revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['plots','persons','ownerships','deeds','deed_parties','mutations','cases','land_flags','tax_records','survey_records','mouzas','acquisition_zones','fraud_signals','risk_rules','risk_rules_history','reports','plot_events','audit_log'] loop
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
  end loop;
end $$;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
select 'ok' as status;
