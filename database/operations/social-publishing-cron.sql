-- Run as the database administrator after configuring the matching server
-- secrets. Never put a literal OAuth token or cron secret in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store postflow_app_url and postflow_social_cron_secret through the Vault UI.
-- URL example: https://post-flow-ochre.vercel.app (no trailing slash).
select cron.schedule('postflow-social-publisher','* * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='postflow_app_url') || '/api/social/worker',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='postflow_social_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists(select 1 from vault.decrypted_secrets where name='postflow_app_url')
    and exists(select 1 from vault.decrypted_secrets where name='postflow_social_cron_secret')
$job$);
select cron.schedule('postflow-social-oauth-cleanup','17 * * * *',$job$
  delete from public.social_oauth_sessions where expires_at<now()
$job$);

-- After validation, set SOCIAL_SCHEDULER_ENABLED=true on the BFF.
-- Keep only one scheduling authority. Do not add a second Vercel Cron sender.
