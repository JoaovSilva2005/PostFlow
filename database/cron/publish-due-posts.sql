-- PostFlow: agendador de publicação (pg_cron -> POST /api/internal/publish-due)
--
-- Script MANUAL. Não é migração porque a URL e o segredo dependem do ambiente.
-- Rode no SQL Editor do Supabase de produção, depois de aplicar a migração
-- 20261029120000_post_publishing_scheduler.sql e de configurar CRON_SECRET na
-- Vercel com o MESMO valor guardado no Vault.
--
-- Este arquivo não contém segredos. URL e segredo são lidos do Supabase Vault
-- pelos nomes `postflow_api_url` e `postflow_cron_secret`.
--
-- PASSO 1 (uma vez, com os seus valores; não os grave neste arquivo):
--   select vault.create_secret('<URL base da API, ex.: https://seu-app.vercel.app>', 'postflow_api_url');
--   select vault.create_secret('<valor de CRON_SECRET>', 'postflow_cron_secret');
-- Para trocar um valor depois:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'postflow_cron_secret'),
--     '<novo valor>'
--   );
--
-- PASSO 2: executar o restante deste script.
--
-- Para DESFAZER o agendamento:
--   select cron.unschedule('postflow-publish-due');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Seguro para reexecutar: remove o agendamento anterior, se existir.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'postflow-publish-due') then
    perform cron.unschedule('postflow-publish-due');
  end if;
end
$$;

select cron.schedule(
  'postflow-publish-due',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := rtrim(
      (select decrypted_secret from vault.decrypted_secrets where name = 'postflow_api_url'),
      '/'
    ) || '/api/internal/publish-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'postflow_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

-- Conferência:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'postflow-publish-due';
--   select status_code, content, created from net._http_response order by created desc limit 5;
--   select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;
