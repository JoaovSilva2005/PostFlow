-- BFF-only social integration. No token/job table is exposed to clients.
create table public.social_connections (
  id uuid primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  provider text not null check (provider in ('facebook','instagram','linkedin','tiktok')),
  external_account_id text not null,
  display_name text not null,
  account_type text not null,
  encrypted_tokens text not null,
  refresh_lease_token uuid,
  refresh_lease_expires_at timestamptz,
  status text not null check (status in ('connected','needs_reconnect','disconnected')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, provider, external_account_id),
  unique (brand_id, id)
);
create table public.social_oauth_sessions (
  id uuid primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  provider text not null check (provider in ('facebook','instagram','linkedin','tiktok')),
  state_hash text not null unique,
  encrypted_verifier text not null,
  encrypted_accounts text,
  redirect_uri text not null,
  status text not null check (status in ('pending','exchanging','ready','failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index social_oauth_sessions_brand_user_idx on public.social_oauth_sessions(brand_id,user_id,expires_at);
create unique index post_drafts_brand_id_id_social_idx on public.post_drafts(brand_id,id);
create table public.social_publications (
  id uuid primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  draft_id uuid not null,
  connection_id uuid not null,
  provider text not null check (provider in ('facebook','instagram','linkedin','tiktok')),
  title text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  scheduled_at timestamptz not null,
  next_attempt_at timestamptz not null,
  status text not null check (status in ('queued','preparing','processing','publishing','published','retry_wait','failed','needs_reconnect','cancelled','unknown')),
  operation jsonb,
  remote_post_id text,
  remote_url text,
  error text,
  attempts integer not null default 0 check (attempts>=0),
  lease_token uuid,
  lease_expires_at timestamptz,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (brand_id,draft_id) references public.post_drafts(brand_id,id),
  foreign key (brand_id,connection_id) references public.social_connections(brand_id,id)
);
-- One intent per draft/account, including confirmed/unknown posts. Explicit cancel
-- is required to replace a scheduled snapshot; failed attempts may be resubmitted.
create unique index social_publications_active_draft_account_idx
  on public.social_publications(draft_id,connection_id)
  where status not in ('cancelled','failed');
create index social_publications_due_idx on public.social_publications(next_attempt_at)
  where status in ('queued','preparing','processing','publishing','retry_wait','unknown');
create index social_publications_brand_created_idx on public.social_publications(brand_id,created_at desc);
create index social_publications_user_idx on public.social_publications(user_id);
create index social_publications_connection_idx on public.social_publications(brand_id,connection_id);
create index social_connections_user_idx on public.social_connections(user_id);
create index social_oauth_sessions_user_idx on public.social_oauth_sessions(user_id);

create table public.social_publication_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.social_publications(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  status text not null,
  attempt integer not null,
  error text,
  remote_post_id text,
  created_at timestamptz not null default now()
);
create index social_publication_events_publication_idx on public.social_publication_events(publication_id,created_at);
create index social_publication_events_brand_idx on public.social_publication_events(brand_id);
alter table public.social_publication_events enable row level security;
revoke all on public.social_publication_events from public,anon,authenticated;
grant select,insert,delete on public.social_publication_events to service_role;
create function public.audit_social_publication() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  insert into public.social_publication_events(publication_id,brand_id,status,attempt,error,remote_post_id)
  values(new.id,new.brand_id,new.status,new.attempts,new.error,new.remote_post_id);
  return new;
end;
$$;
revoke all on function public.audit_social_publication() from public,anon,authenticated;
grant execute on function public.audit_social_publication() to service_role;
create trigger social_publication_audit after insert or update of status,attempts,remote_post_id,error on public.social_publications
for each row execute function public.audit_social_publication();

alter table public.social_connections enable row level security;
alter table public.social_oauth_sessions enable row level security;
alter table public.social_publications enable row level security;
revoke all on public.social_connections,public.social_oauth_sessions,public.social_publications from public,anon,authenticated;
grant select,insert,update,delete on public.social_connections,public.social_oauth_sessions,public.social_publications to service_role;

create function public.consume_social_oauth(p_hash text,p_user uuid,p_provider text)
returns setof public.social_oauth_sessions
language sql security invoker set search_path=''
as $$
  update public.social_oauth_sessions set status='exchanging'
  where state_hash=p_hash and user_id=p_user and provider=p_provider
    and status='pending' and expires_at>now()
  returning *;
$$;
create function public.claim_social_publications(p_limit integer default 1)
returns setof public.social_publications
language sql security invoker set search_path=''
as $$
  with candidates as (
    select id from public.social_publications
    where status in ('queued','preparing','processing','publishing','retry_wait','unknown')
      and next_attempt_at<=now()
      and (lease_expires_at is null or lease_expires_at<now())
    order by next_attempt_at,id for update skip locked limit least(greatest(p_limit,1),3)
  )
  update public.social_publications as p
  set lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',attempts=p.attempts+1,
      status=case when p.status='publishing' then 'unknown' else p.status end
  from candidates where p.id=candidates.id returning p.*;
$$;
create function public.disconnect_social_connection(p_brand uuid,p_connection uuid)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  update public.social_connections set status='disconnected',encrypted_tokens=''
    where brand_id=p_brand and id=p_connection;
  update public.social_publications set status='cancelled',error='Conta desconectada.'
    where brand_id=p_brand and connection_id=p_connection and lease_token is null
      and status in ('queued','retry_wait','preparing','processing','needs_reconnect')
      and coalesce((operation->>'_dispatched')::boolean,false)=false;
end;
$$;
revoke all on function public.consume_social_oauth(text,uuid,text),public.claim_social_publications(integer),public.disconnect_social_connection(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_social_oauth(text,uuid,text),public.claim_social_publications(integer),public.disconnect_social_connection(uuid,uuid) to service_role;

create function public.claim_social_refresh(p_brand uuid,p_connection uuid)
returns uuid language sql security invoker set search_path=''
as $$
  update public.social_connections set refresh_lease_token=gen_random_uuid(),refresh_lease_expires_at=now()+interval '1 minute'
  where brand_id=p_brand and id=p_connection and status='connected'
    and (refresh_lease_expires_at is null or refresh_lease_expires_at<now())
  returning refresh_lease_token;
$$;
revoke all on function public.claim_social_refresh(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_social_refresh(uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('social-publication-images','social-publication-images',false,5242880,array['image/jpeg'])
on conflict(id) do nothing;
-- OAuth secrets have a bounded lifetime even if the account picker is abandoned.
-- Scheduling/cleanup Cron is enabled separately once server secrets are configured.
