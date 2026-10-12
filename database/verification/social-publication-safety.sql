-- Live Postgres verification, never calls a social API. All fixtures roll back.
-- Run only with an empty social queue; requires two existing workspaces and a draft.
begin;
do $test$
declare b uuid; d uuid; u uuid; other_brand uuid; c uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); n integer; s text;
begin
 if exists(select 1 from public.social_publications where status not in ('published','failed','cancelled')) then raise exception 'Run only when the social queue is empty'; end if;
 select p.brand_id,p.id,m.user_id into b,d,u from public.post_drafts p join public.brand_members m on m.brand_id=p.brand_id limit 1;
 if b is null then raise exception 'fixture requires an existing workspace/draft'; end if;
 select id into other_brand from public.brands where id<>b limit 1;
 if other_brand is null then raise exception 'fixture requires two workspaces'; end if;
 insert into public.social_connections(id,brand_id,user_id,provider,external_account_id,display_name,account_type,encrypted_tokens,status)
 values(c,b,u,'facebook',c::text,'Integration rollback fixture','Page','not-a-real-token','connected');
 insert into public.social_publications(id,brand_id,user_id,draft_id,connection_id,provider,title,snapshot,scheduled_at,next_attempt_at,status)
 values(j,b,u,d,c,'facebook','Rollback fixture','{"approvalHash":"fixture","title":"Fixture","caption":"Never posted","imagePath":"not-uploaded","timezone":"America/Sao_Paulo"}',now(),now(),'queued');
 begin
  insert into public.social_publications(id,brand_id,user_id,draft_id,connection_id,provider,title,snapshot,scheduled_at,next_attempt_at,status)
  values(gen_random_uuid(),b,u,d,c,'facebook','Duplicate','{}',now(),now(),'queued');
  raise exception 'duplicate intent was not rejected';
 exception when unique_violation then null; end;
 begin
  insert into public.social_publications(id,brand_id,user_id,draft_id,connection_id,provider,title,snapshot,scheduled_at,next_attempt_at,status)
  values(gen_random_uuid(),other_brand,u,d,c,'facebook','Cross tenant','{}',now(),now(),'failed');
  raise exception 'cross tenant foreign key was not enforced';
 exception when foreign_key_violation then null; end;
 select count(*) into n from public.claim_social_publications(1);
 if n<>1 then raise exception 'initial claim failed'; end if;
 select count(*) into n from public.claim_social_publications(1);
 if n<>0 then raise exception 'lease allowed duplicate claim'; end if;
 update public.social_publications set status='publishing',operation='{"_dispatched":true}',lease_expires_at=now()-interval '1 second',next_attempt_at=now() where id=j;
 perform public.claim_social_publications(1);
 select status into s from public.social_publications where id=j;
 if s<>'unknown' then raise exception 'expired dispatched lease did not become unknown'; end if;
 perform public.disconnect_social_connection(b,c);
 select status into s from public.social_publications where id=j;
 if s<>'unknown' then raise exception 'disconnect falsely cancelled an accepted dispatch'; end if;
 select count(*) into n from public.social_publication_events where publication_id=j;
 if n<3 then raise exception 'publication audit is incomplete'; end if;
 if has_table_privilege('authenticated','public.social_connections','select') then raise exception 'credentials are exposed'; end if;
 if has_function_privilege('authenticated','public.claim_social_publications(integer)','execute') then raise exception 'worker RPC is exposed'; end if;
end $test$;
rollback;
select json_build_object('transactional_checks','passed','remaining_jobs',(select count(*) from public.social_publications),'rls_enabled',(select bool_and(relrowsecurity) from pg_class where oid in ('public.social_connections'::regclass,'public.social_oauth_sessions'::regclass,'public.social_publications'::regclass,'public.social_publication_events'::regclass))) as verification;
